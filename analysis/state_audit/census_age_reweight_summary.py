"""Summarize the Census-age reweight projection.

``census_age_reweight_modal.py`` reweights each production state slice to
Census Vintage 2025 age groups and simulates the result. This script reads its
output, checks it, and writes the tables::

    python analysis/state_audit/census_age_reweight_summary.py buildp_18252 \\
        --audit-2024 state_audit_buildp_v2_2024_raw.json \\
        --audit-2026 state_audit_buildp_v2_2026_raw.json

It refuses unless every state ran and converged, each state's 2024 reweighted
age groups equal Census's, and each state's production figures equal the
audit sweep's for the same slices and pin. It writes
``output/census_age_reweight_{label}_by_state.csv`` (one row per state) and
``output/census_age_reweight_{label}_summary.md`` (national tables).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CENSUS = os.path.join(HERE, "targets", "census_pep_v2025_state_single_age.csv")
CPS = os.path.join(HERE, "targets", "census_child_spm_cps3yr_2023_2025.csv")

#: Reweight metric -> (Census column, audit sweep field).
COUNTS = {
    "population": ("total", "pop_total"),
    "children_under_1": ("under_1", "pop_under_1"),
    "children_under_4": ("under_4", None),
    "children_under_5": ("under_5", "pop_under_5"),
    "children_under_6": ("under_6", "pop_under_6"),
    "children_under_18": ("under_18", "pop_under_18"),
    "adults": ("adults", None),
}
LABELS = {
    "population": "All ages",
    "children_under_1": "Under 1",
    "children_under_4": "Under 4",
    "children_under_5": "Under 5",
    "children_under_6": "Under 6",
    "children_under_18": "Under 18",
    "adults": "18 and over",
}
#: Reweight rate -> audit sweep field.
RATES = {"child_poverty": "poverty_child", "child_poverty_measured": "poverty_child_measured"}


def pct(value: float, target: float) -> float:
    return (value - target) / target * 100


def load_rows(label: str) -> dict[str, dict]:
    with open(os.path.join(OUT, f"census_age_reweight_{label}.json"), encoding="utf-8") as f:
        rows = json.load(f)
    bad = {r["state"]: r.get("error", "") for r in rows if r.get("status") != "ok"}
    if bad:
        raise SystemExit(f"states without status ok: {bad}")
    unconverged = [r["state"] for r in rows if not r["balance"]["converged"]]
    if unconverged:
        raise SystemExit(f"balance did not converge: {unconverged}")
    if len(rows) != 51:
        raise SystemExit(f"{len(rows)} states, not 51")
    return {r["state"]: r for r in rows}


def load_census(year: int) -> dict[str, dict[str, float]]:
    with open(CENSUS, newline="", encoding="utf-8") as f:
        return {
            r["state"]: {k: float(v) for k, v in r.items() if k not in ("state", "state_fips", "year")}
            for r in csv.DictReader(f)
            if int(r["year"]) == year
        }


def load_audit(name: str) -> dict[str, dict]:
    with open(os.path.join(OUT, name), encoding="utf-8") as f:
        return {r["state"].upper(): r for r in json.load(f)}


def check_against_audit(rows: dict, audit: dict, year: int) -> list[str]:
    """Production figures must equal the audit sweep's (same slices and pin)."""

    problems = []
    for st, r in rows.items():
        prod, a = r["years"][str(year)]["production"], audit[st]
        for metric, (_, field) in COUNTS.items():
            if field and abs(pct(prod[metric], a[field])) > 1e-4:
                problems.append(f"{st} {year} {metric}: {prod[metric]:.1f} vs audit {a[field]:.1f}")
        for metric, field in RATES.items():
            if abs(prod[metric] - a[field]) > 1e-3:
                problems.append(f"{st} {year} {metric}: {prod[metric]:.4f} vs audit {a[field]:.4f}")
    return problems


def census_fit_gap(rows: dict, census: dict) -> float:
    """Largest relative gap between a 2024 reweighted count and Census's."""

    return max(
        abs(rows[st]["years"]["2024"]["reweighted"][metric] / census[st][column] - 1)
        for st in rows
        for metric, (column, _) in COUNTS.items()
    )


def check_census_fit(rows: dict, census: dict) -> list[str]:
    """The 2024 reweighted counts must equal Census's, up to the float32
    rounding of the simulated weights (relative 1e-6)."""

    problems = []
    for st, r in rows.items():
        rew = r["years"]["2024"]["reweighted"]
        for metric, (column, _) in COUNTS.items():
            if abs(rew[metric] / census[st][column] - 1) > 1e-6:
                problems.append(f"{st} {metric}: {rew[metric]:.1f} vs Census {census[st][column]:.0f}")
    return problems


def national(rows: dict, year: int, run: str, metric: str) -> float:
    return sum(r["years"][str(year)][run][metric] for r in rows.values())


def child_poverty(rows: dict, year: int, run: str) -> float:
    """National child SPM poverty from counts: children in poverty over children."""

    return national(rows, year, run, "children_in_poverty") / national(rows, year, run, "children_under_18") * 100


def cps_fit(rows: dict, run: str) -> dict:
    """2024 measured child SPM poverty against Census's CPS 3-year state rates
    (P60-290 Table 18, 2023-25), as summarize_sweep.py scores it."""

    with open(CPS, newline="", encoding="utf-8") as f:
        cps = {r["state"]: (float(r["child_spm_rate"]), float(r["child_spm_moe"])) for r in csv.DictReader(f)}
    rates = {st: r["years"]["2024"][run]["child_poverty_measured"] for st, r in rows.items()}
    diffs = [pct(rates[st], cps[st][0]) for st in rows]
    return {
        "median_pct": statistics.median(diffs),
        "within_25": sum(abs(d) <= 25 for d in diffs),
        "within_moe": sum(abs(rates[st] - cps[st][0]) <= cps[st][1] for st in rows),
        "mean_abs_pp": statistics.mean(abs(rates[st] - cps[st][0]) for st in rows),
    }


def spread(values: list[float]) -> str:
    return "median {:+.2f}, min {:+.2f}, max {:+.2f}".format(
        statistics.median(values), min(values), max(values)
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("label")
    parser.add_argument("--audit-2024", required=True)
    parser.add_argument("--audit-2026", required=True)
    args = parser.parse_args()
    rows = load_rows(args.label)
    census = load_census(2024)
    problems = (
        check_against_audit(rows, load_audit(args.audit_2024), 2024)
        + check_against_audit(rows, load_audit(args.audit_2026), 2026)
        + check_census_fit(rows, census)
    )
    if problems:
        raise SystemExit("checks failed:\n  " + "\n  ".join(problems[:40]))

    lines = [f"# Census-age reweight projection: {args.label}", ""]
    lines += [
        "Checks passed: 51 states ran and converged; each state's 2024 reweighted "
        f"counts match Census's to within {census_fit_gap(rows, census):.1e} (float32 weights); "
        "each state's production figures equal the audit "
        f"sweep's ({args.audit_2024}, {args.audit_2026}).",
        "",
        "## Population by age, 2024, against Census Vintage 2025",
        "",
        "| Ages | Census | Production | vs Census | Reweighted | vs Census |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for metric, (column, _) in COUNTS.items():
        c = sum(census[st][column] for st in rows)
        p = national(rows, 2024, "production", metric)
        w = national(rows, 2024, "reweighted", metric)
        lines.append(
            f"| {LABELS[metric]} | {c:,.0f} | {p:,.0f} | {pct(p, c):+.2f}% | {w:,.0f} | {pct(w, c):+.2f}% |"
        )
    prod_u18 = [pct(r["years"]["2024"]["production"]["children_under_18"], census[st]["under_18"]) for st, r in rows.items()]
    lines += [
        "",
        f"Production under-18 by state against Census (%): {spread(prod_u18)}; "
        f"over +5% in {sum(d > 5 for d in prod_u18)} of 51.",
        "",
        "## Child SPM poverty",
        "",
        "National rates divide children in poverty by children, summed over the 51 slices.",
        "",
        "| Year | Production | Reweighted | Change (pp) | Children in poverty, production | Reweighted |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for year in (2024, 2026):
        p, w = child_poverty(rows, year, "production"), child_poverty(rows, year, "reweighted")
        lines.append(
            f"| {year} | {p:.2f}% | {w:.2f}% | {w - p:+.2f} | "
            f"{national(rows, year, 'production', 'children_in_poverty'):,.0f} | "
            f"{national(rows, year, 'reweighted', 'children_in_poverty'):,.0f} |"
        )
    for year in (2024, 2026):
        kids = {run: national(rows, year, run, "children_under_18") for run in ("production", "reweighted")}
        poor = {run: national(rows, year, run, "children_in_poverty") for run in ("production", "reweighted")}
        lines.append(
            f"\n{year}: the reweight changes the number of children in poverty by "
            f"{pct(poor['reweighted'], poor['production']):+.1f}% and of other children by "
            f"{pct(kids['reweighted'] - poor['reweighted'], kids['production'] - poor['production']):+.1f}%."
        )
    for year in (2024, 2026):
        diffs = {
            st: r["years"][str(year)]["reweighted"]["child_poverty"] - r["years"][str(year)]["production"]["child_poverty"]
            for st, r in rows.items()
        }
        ordered = sorted(diffs, key=diffs.get)
        lines += [
            "",
            f"{year} change by state (pp): {spread(list(diffs.values()))}; "
            f"up in {sum(d > 0 for d in diffs.values())} of 51. "
            "Largest falls: " + ", ".join(f"{st} {diffs[st]:+.2f}" for st in ordered[:5]) + ". "
            "Largest rises: " + ", ".join(f"{st} {diffs[st]:+.2f}" for st in reversed(ordered[-5:])) + ".",
        ]

    lines += [
        "",
        "## State child SPM poverty against Census, 2024",
        "",
        "Measured rates (ACS group quarters masked) against Census's CPS 3-year state rates "
        "(P60-290 Table 18, 2023-25), scored as in summarize_sweep.py.",
        "",
        "| | Median % diff | Within ±25% | Within Census MOE | Mean abs error (pp) |",
        "|---|---:|---:|---:|---:|",
    ]
    for run in ("production", "reweighted"):
        fit = cps_fit(rows, run)
        lines.append(
            f"| {run.capitalize()} | {fit['median_pct']:+.1f}% | {fit['within_25']}/51 | "
            f"{fit['within_moe']}/51 | {fit['mean_abs_pp']:.2f} |"
        )
    flags = max(c["flags_differ_persons"] for r in rows.values() for c in r["rescore_check"].values())
    gap = max(
        abs(c["child_poverty_rescored"] - r["years"][y]["reweighted"]["child_poverty"])
        for r in rows.values()
        for y, c in r["rescore_check"].items()
    )
    bal = [r["balance"] for r in rows.values()]
    dropped = {r["state"]: r["balance"]["dropped_held_at_zero"] for r in rows.values() if r["balance"]["dropped_held_at_zero"]}
    lines += [
        "",
        "## Checks on the reweight",
        "",
        f"- Balance: every state converged, in at most {max(b['iterations'] for b in bal)} Newton steps, "
        f"with the largest constraint error {max(b['max_abs_rel_error'] for b in bal):.1e} of its target.",
        f"- Held aggregates dropped because the slice's value is zero: {dropped or 'none'}.",
        "- Household weight ratios, new over production: smallest {:.3f}, largest {:.2f}; "
        "median state's 1st and 99th percentiles {:.3f} and {:.3f}.".format(
            min(b["weight_ratio_percentiles"]["p0"] for b in bal),
            max(b["weight_ratio_percentiles"]["p100"] for b in bal),
            statistics.median(b["weight_ratio_percentiles"]["p1"] for b in bal),
            statistics.median(b["weight_ratio_percentiles"]["p99"] for b in bal),
        ),
        "- Kish effective sample size, new over production: median state {:.3f}, range {:.3f} to {:.3f}.".format(
            statistics.median(b["kish_ess_after"] / b["kish_ess_before"] for b in bal),
            min(b["kish_ess_after"] / b["kish_ess_before"] for b in bal),
            max(b["kish_ess_after"] / b["kish_ess_before"] for b in bal),
        ),
        f"- Poverty status: in every state and year, {flags} persons have a different SPM poverty "
        "status in the reweighted run than in the production run, so the reweight moves poverty "
        f"rates through weights alone (re-scoring the production run's flags differs by {gap:.1e} pp).",
        "- Newton steps above 50: " + (", ".join(
            f"{r['state']} {r['balance']['iterations']}" for r in rows.values() if r["balance"]["iterations"] > 50
        ) or "none") + ".",
        "- Largest household weight ratios: " + ", ".join(
            "{} {:.1f} (Kish {:.0f} of {:,} households)".format(
                r["state"], r["balance"]["weight_ratio_percentiles"]["p100"],
                r["balance"]["kish_ess_before"], r["balance"]["n_households"],
            )
            for r in sorted(rows.values(), key=lambda r: -r["balance"]["weight_ratio_percentiles"]["p100"])[:3]
        ) + ".",
    ]

    for st, r in rows.items():
        reform = r.get("universal_under4_2000")
        if not reform:
            continue
        lines += [
            "",
            f"## {st}: universal $2,000 for each child under 4, {reform['year']}",
            "",
            "| | Production | Reweighted |",
            "|---|---:|---:|",
        ]
        for key, name in (
            ("cost", "Cost"),
            ("basic_income_total", "Payments"),
            ("benefit_change", "Change in benefits"),
            ("federal_tax_change", "Change in federal income tax"),
            ("state_tax_change", "Change in state income tax"),
        ):
            lines.append(f"| {name} | ${reform['production'][key] / 1e6:,.1f}M | ${reform['reweighted'][key] / 1e6:,.1f}M |")
        y = str(reform["year"])
        lines.append(
            "| Children under 4 | {:,.0f} | {:,.0f} |".format(
                r["years"][y]["production"]["children_under_4"], r["years"][y]["reweighted"]["children_under_4"]
            )
        )

    md_path = os.path.join(OUT, f"census_age_reweight_{args.label}_summary.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    out_rows = []
    for st, r in sorted(rows.items()):
        row = {"state": st, "census_under_18": round(census[st]["under_18"])}
        for year in (2024, 2026):
            for run in ("production", "reweighted"):
                m = r["years"][str(year)][run]
                row[f"{run}_under_18_{year}"] = round(m["children_under_18"])
                row[f"{run}_child_poverty_{year}"] = round(m["child_poverty"], 3)
                row[f"{run}_child_poverty_measured_{year}"] = round(m["child_poverty_measured"], 3)
        row["production_under_18_vs_census_pct"] = round(pct(r["years"]["2024"]["production"]["children_under_18"], census[st]["under_18"]), 2)
        b = r["balance"]
        row.update(
            iterations=b["iterations"],
            weight_ratio_p1=b["weight_ratio_percentiles"]["p1"],
            weight_ratio_p99=b["weight_ratio_percentiles"]["p99"],
            kish_ess_before=round(b["kish_ess_before"], 1),
            kish_ess_after=round(b["kish_ess_after"], 1),
            dropped_held_at_zero=";".join(b["dropped_held_at_zero"]),
        )
        out_rows.append(row)
    fields = list(out_rows[0])
    csv_path = os.path.join(OUT, f"census_age_reweight_{args.label}_by_state.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(out_rows)
    print("\n".join(lines))
    print(f"\nwrote {md_path}\nwrote {csv_path}")


if __name__ == "__main__":
    main()
