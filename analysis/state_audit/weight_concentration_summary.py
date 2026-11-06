"""Summarize weight concentration in the state slices, before and after the
Census-age balance (microcosm#1528).

Reads ``output/weight_concentration_{label}.json`` from
``census_age_reweight_modal.py collect-concentration`` and checks it against an
independent run on the same slices before it writes
``output/weight_concentration_{label}_summary.md`` and
``output/weight_concentration_{label}_by_state.csv``:

- By default, against the projection in ``output/census_age_reweight_{label}.json``:
  the same balance from the same start must reach the same Kish effective
  samples, and both runs simulate the same datasets, so their 2026 counts of
  children under 4, their 2026 child SPM poverty and Indiana's cost must agree.
- With ``--audit-label``, for slices with no projection, against the audit
  sweep in ``output/state_audit_{audit_label}_2026_raw.json``: the production
  run's 2026 child SPM poverty, household count, slice and policyengine-us
  version must match the sweep's.

::

    python analysis/state_audit/weight_concentration_summary.py buildp_18252
    python analysis/state_audit/weight_concentration_summary.py buildo_18252 --audit-label o1017_18252
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics

from census_age_fit import state_coverage_problems

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
RUNS = ("production", "reweighted")
#: How closely this run must match the others. Counts, rates and the Kish of
#: the balanced float64 weights match the projection to rounding. The
#: projection summed float32 weights for its Kish before the balance, and the
#: audit sweep sums them another way for its poverty rates. Both reweight runs
#: take Indiana's cost as a difference of float32 dot products, and all four
#: costs are multiples of $4,096 that differ between runs by one and three such
#: steps.
REL_TOL = 1e-9
FLOAT32_TOL = 1e-6
FLOAT32_COST_TOL = 5e-5
#: Children a state must lift before one household's share of the lift counts
#: in the large-lift rows. Without it, the District of Columbia counts on Build
#: P with a net lift under 0.001 children.
LARGE_LIFT = 1_000


def load(label: str) -> list[dict]:
    with open(os.path.join(OUT, f"weight_concentration_{label}.json"), encoding="utf-8") as f:
        rows = json.load(f)
    problems = [r["state"] for r in rows if r.get("status") != "ok"]
    problems += [r["state"] for r in rows if r.get("status") == "ok" and not r["balance"]["converged"]]
    problems += [r["state"] for r in rows if r.get("status") == "ok" and not r["spine_available"]]
    coverage = state_coverage_problems(r["state"] for r in rows)
    if problems or coverage:
        raise SystemExit(
            f"refusing: errors, unconverged or no spine in {sorted(set(problems))}; "
            f"states left out, repeated or unknown: {coverage}"
        )
    return rows


def _by_state(path: str) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {r["state"]: r for r in json.load(f)}


def _close(a: float, b: float, tol: float = REL_TOL) -> bool:
    return abs(a - b) <= tol * max(abs(a), abs(b), 1.0)


def check_against_projection(rows: list[dict], projection: dict[str, dict]) -> list[str]:
    """Differences from the projection run; an empty list means they agree."""

    issues = []
    for r in rows:
        st = r["state"]
        p = projection.get(st)
        if p is None or p.get("status") != "ok":
            issues.append(f"{st}: no projection row")
            continue
        if r["versions"]["policyengine-us"] != p["versions"]["policyengine-us"]:
            issues.append(f"{st}: policyengine-us {r['versions']['policyengine-us']} against {p['versions']['policyengine-us']}")
        for run, key, tol in (
            ("production", "kish_ess_before", FLOAT32_TOL),
            ("reweighted", "kish_ess_after", REL_TOL),
        ):
            mine, theirs = r["weights_2024"][run]["kish_ess"], p["balance"][key]
            if not _close(mine, theirs, tol):
                issues.append(f"{st} {run}: Kish {mine} against the projection's {theirs}")
        if r["weights_2024"]["production"]["n_households"] != p["balance"]["n_households"]:
            issues.append(f"{st}: household counts differ")
        lift = r["universal_under4_2000"]
        for run in RUNS:
            proj_2026 = p["years"]["2026"][run]
            for mine_key, theirs_key in (
                ("children_under_4", "children_under_4"),
                ("child_poverty_baseline", "child_poverty"),
            ):
                if not _close(lift[run][mine_key], proj_2026[theirs_key]):
                    issues.append(f"{st} {run}: {mine_key} {lift[run][mine_key]} against {proj_2026[theirs_key]}")
            if "universal_under4_2000" in p and not _close(
                lift[run]["cost"], p["universal_under4_2000"][run]["cost"], FLOAT32_COST_TOL
            ):
                issues.append(f"{st} {run}: cost {lift[run]['cost']} against {p['universal_under4_2000'][run]['cost']}")
    return issues


def check_against_audit(rows: list[dict], audit: dict[str, dict]) -> list[str]:
    """Differences from the audit sweep at 2026; an empty list means they agree."""

    issues = []
    for r in rows:
        st = r["state"]
        a = audit.get(st)
        if a is None or a.get("status") != "ok":
            issues.append(f"{st}: no audit row")
            continue
        if a["year"] != r["universal_under4_2000"]["year"]:
            issues.append(f"{st}: the audit ran {a['year']}")
        if a["slice_tag"] != r["slice_tag"]:
            issues.append(f"{st}: audit slice {a['slice_tag']} against {r['slice_tag']}")
        if a["pe_us"] != r["versions"]["policyengine-us"]:
            issues.append(f"{st}: audit policyengine-us {a['pe_us']} against {r['versions']['policyengine-us']}")
        if a["n_households"] != r["weights_2024"]["production"]["n_households"]:
            issues.append(f"{st}: household counts differ")
        mine = r["universal_under4_2000"]["production"]["child_poverty_baseline"]
        if not _close(mine, a["poverty_child"], FLOAT32_TOL):
            issues.append(f"{st}: child poverty {mine} against the audit's {a['poverty_child']}")
    return issues


def med_range(values: list[float]) -> tuple[float, float, float]:
    return statistics.median(values), min(values), max(values)


def pct(x: float, digits: int = 1) -> str:
    return f"{100 * x:.{digits}f}%"


def large_lift_counts(rows: list[dict], run: str) -> tuple[int, int]:
    """States lifting at least ``LARGE_LIFT`` children, and how many of those
    have one household accounting for more than half of the lift."""

    lifts = [r["universal_under4_2000"][run] for r in rows]
    large = [lift for lift in lifts if lift["children_lifted_net"] >= LARGE_LIFT]
    return len(large), sum(1 for lift in large if (lift["top1_share"] or 0) > 0.5)


def by_state_rows(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        row = {"state": r["state"]}
        for run in RUNS:
            w = r["weights_2024"][run]
            lift = r["universal_under4_2000"][run]
            short = "p" if run == "production" else "r"
            row.update({
                f"{short}_households": w["n_households"],
                f"{short}_kish_ess": round(w["kish_ess"], 1),
                f"{short}_kish_share": round(w["kish_ess"] / w["n_households"], 5),
                f"{short}_top1pct_share": round(w["top1pct_share"], 5),
                f"{short}_max_weight": round(w["max_weight"], 1),
                f"{short}_child_kish_ess": round(w["child_kish_ess"], 1),
                f"{short}_asec_households": w["asec_households"],
                f"{short}_asec_weight_share": round(w["asec_weight_share"], 5),
                f"{short}_asec_child_weight_share": round(w["asec_child_weight_share"], 5),
                f"{short}_asec_kish_ess": round(w["asec_kish_ess"], 1),
                f"{short}_other_kish_ess": round(w["other_kish_ess"], 1),
                f"{short}_u4_cost": round(lift["cost"], -4),
                f"{short}_children_under_4_2026": round(lift["children_under_4"], 0),
                f"{short}_child_poverty_2026": round(lift["child_poverty_baseline"], 4),
                f"{short}_child_poverty_reform_2026": round(lift["child_poverty_reform"], 4),
                f"{short}_children_lifted_net": round(lift["children_lifted_net"], 0),
                f"{short}_households_with_net_lift": lift["households_with_net_lift"],
                f"{short}_households_with_net_entry": lift["households_with_net_entry"],
                f"{short}_top1_share_of_lifted": None if lift["top1_share"] is None else round(lift["top1_share"], 5),
                f"{short}_top5_share_of_lifted": None if lift["top5_share"] is None else round(lift["top5_share"], 5),
                f"{short}_asec_share_of_lifted": None if lift["asec_share"] is None else round(lift["asec_share"], 5),
                f"{short}_top_lifting_household_spine": lift["top_household_spine"],
                f"{short}_lifters_kish_ess": round(lift["lifters_kish_ess"], 2),
                f"{short}_young_poor_households": lift["young_poor_households"],
                f"{short}_young_poor_kish_ess": round(lift["young_poor_kish_ess"], 2),
            })
        out.append(row)
    return out


def summary_md(label: str, rows: list[dict]) -> str:
    lines = [f"# Weight concentration in the state slices: {label}", ""]
    lines += [
        (
            f"Slices `{rows[0]['slice_tag']}`, policyengine-us {rows[0]['versions']['policyengine-us']}. "
            "Household weights at 2024 for the slices as published (P) and for the same slices balanced to"
        ),
        "Census Vintage 2025 ages (R, `census_age_reweight_modal.py`). Top 1% = the heaviest",
        "max(1, n // 100) households. ASEC-by-PUF = households whose `household_spine` is `asec_puf`;",
        "ACS = every other household.",
        "",
        "## Weights, 51 states: median (lowest to highest)",
        "",
        "| Measure | Production | Reweighted |",
        "|---|---:|---:|",
    ]

    def stat(fn, fmt):
        cells = []
        for run in RUNS:
            m, lo, hi = med_range([fn(r["weights_2024"][run]) for r in rows])
            cells.append(f"{fmt(m)} ({fmt(lo)} to {fmt(hi)})")
        return cells

    for name, fn, fmt in (
        ("Kish effective sample, households", lambda w: w["kish_ess"], lambda x: f"{x:,.0f}"),
        ("Kish effective sample, % of households", lambda w: w["kish_ess"] / w["n_households"], pct),
        ("Top 1% of households' share of weight", lambda w: w["top1pct_share"], pct),
        ("ASEC-by-PUF households' share of weight", lambda w: w["asec_weight_share"], pct),
        ("ASEC-by-PUF households' share of child weight", lambda w: w["asec_child_weight_share"], pct),
        ("Kish effective sample, ASEC-by-PUF households", lambda w: w["asec_kish_ess"], lambda x: f"{x:,.0f}"),
        ("Kish effective sample, ACS households", lambda w: w["other_kish_ess"], lambda x: f"{x:,.0f}"),
    ):
        lines.append(f"| {name} | " + " | ".join(stat(fn, fmt)) + " |")

    lines += ["", "## $2,000 for each child under 4, 2026", ""]
    lines += ["| Measure | Production | Reweighted |", "|---|---:|---:|"]
    for name, fn in (
        ("Children lifted out of SPM poverty, net, 51 states", lambda run: f"{sum(r['universal_under4_2000'][run]['children_lifted_net'] for r in rows):,.0f}"),
        ("ASEC-by-PUF households' share of them", lambda run: pct(
            sum(r["universal_under4_2000"][run]["children_lifted_net"] * (r["universal_under4_2000"][run]["asec_share"] or 0) for r in rows)
            / sum(r["universal_under4_2000"][run]["children_lifted_net"] for r in rows))),
        ("Sample households lifting a child, median state", lambda run: f"{statistics.median(r['universal_under4_2000'][run]['households_with_net_lift'] for r in rows):,.0f}"),
        ("Top household's share of a state's children lifted, median state", lambda run: pct(statistics.median(
            r["universal_under4_2000"][run]["top1_share"] for r in rows if r["universal_under4_2000"][run]["top1_share"] is not None))),
        ("States where one household accounts for more than half", lambda run: str(sum(
            1 for r in rows if (r["universal_under4_2000"][run]["top1_share"] or 0) > 0.5))),
        ("States where one household accounts for more than a quarter", lambda run: str(sum(
            1 for r in rows if (r["universal_under4_2000"][run]["top1_share"] or 0) > 0.25))),
        (f"States lifting at least {LARGE_LIFT:,} children", lambda run: str(large_lift_counts(rows, run)[0])),
        ("Of those, states where one household accounts for more than half", lambda run: str(large_lift_counts(rows, run)[1])),
        ("States where the top lifting household comes from ASEC-by-PUF", lambda run: str(sum(
            1 for r in rows if r["universal_under4_2000"][run]["top_household_spine"] == "asec_puf"))),
        ("States with no net lift", lambda run: str(sum(
            1 for r in rows if r["universal_under4_2000"][run]["top1_share"] is None))),
    ):
        lines.append(f"| {name} | {fn('production')} | {fn('reweighted')} |")

    lines += ["", "## By state", ""]
    lines += [
        (
            "| State | Households | Kish, P | Kish, R | Top 1%, P | Top 1%, R | ASEC weight, P | ASEC weight, R "
            "| Lifted, P | Lifted, R | Lifting households, P | Top household, P | Top household, R |"
        ),
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in rows:
        wp, wr = r["weights_2024"]["production"], r["weights_2024"]["reweighted"]
        lp, lr = r["universal_under4_2000"]["production"], r["universal_under4_2000"]["reweighted"]

        def share(x):
            return "n/a" if x is None else pct(x, 0)

        lines.append(
            f"| {r['state']} | {wp['n_households']:,} | {wp['kish_ess']:,.0f} | {wr['kish_ess']:,.0f} "
            f"| {pct(wp['top1pct_share'], 0)} | {pct(wr['top1pct_share'], 0)} "
            f"| {pct(wp['asec_weight_share'], 0)} | {pct(wr['asec_weight_share'], 0)} "
            f"| {lp['children_lifted_net']:,.0f} | {lr['children_lifted_net']:,.0f} "
            f"| {lp['households_with_net_lift']} | {share(lp['top1_share'])} | {share(lr['top1_share'])} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("label")
    parser.add_argument("--audit-label", help="check against this audit sweep instead of a projection")
    args = parser.parse_args()
    rows = load(args.label)
    if args.audit_label:
        against = f"audit sweep {args.audit_label}"
        issues = check_against_audit(
            rows, _by_state(os.path.join(OUT, f"state_audit_{args.audit_label}_2026_raw.json"))
        )
    else:
        against = "projection"
        issues = check_against_projection(
            rows, _by_state(os.path.join(OUT, f"census_age_reweight_{args.label}.json"))
        )
    if issues:
        raise SystemExit(f"refusing: the run disagrees with the {against}:\n  " + "\n  ".join(issues[:20]))
    table = by_state_rows(rows)
    csv_path = os.path.join(OUT, f"weight_concentration_{args.label}_by_state.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(table[0]))
        writer.writeheader()
        writer.writerows(table)
    md_path = os.path.join(OUT, f"weight_concentration_{args.label}_summary.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(summary_md(args.label, rows))
    print(f"wrote {md_path} and {csv_path}; checks against the {against}: all {len(rows)} states agree")


if __name__ == "__main__":
    main()
