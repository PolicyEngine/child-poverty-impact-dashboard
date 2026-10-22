"""Head-to-head summary of dataset-sweep runs (state_audit_sweep_modal.py).

Reads ``output/state_audit_{label}_{year}_raw.json`` for each label and
prints/writes the adoption scorecard: child SPM vs two Census benchmarks,
population fit, state credit costs, national program totals, and the
reference-reform (restore 2021 CTC) impact deltas between datasets.

    python analysis/state_audit/summarize_sweep.py --labels buildp,buildo --year 2024

Writes ``output/sweep_summary_{year}.json``.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics as stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
TARGETS = os.path.join(HERE, "targets")


def _csv(name):
    with open(os.path.join(TARGETS, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _raw(label, year):
    path = os.path.join(OUT, f"state_audit_{label}_{year}_raw.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    return {r["state"]: r for r in rows if r.get("status") == "ok"}, rows


def _pct(pe, tgt):
    try:
        tgt = float(tgt)
        return (float(pe) - tgt) / tgt * 100 if tgt else None
    except (TypeError, ValueError):
        return None


def _fit(diffs):
    d = [x for x in diffs if x is not None]
    if not d:
        return {}
    return {
        "n": len(d),
        "median_pct": round(stats.median(d), 1),
        "median_abs_pct": round(stats.median(abs(x) for x in d), 1),
        "within_25": sum(abs(x) <= 25 for x in d),
        "within_10": sum(abs(x) <= 10 for x in d),
    }


def _measured(pe, rate):
    """Swap in group-quarters-masked rates when asked for and available."""
    if rate != "measured":
        return pe, False
    if not all(r.get("gq_mask_available") for r in pe.values()):
        return pe, False
    keys = ("poverty_all", "poverty_child", "poverty_young_child", "poverty_deep_child",
            "ref_ctc2021_child_poverty", "ref_ctc2021_child_pov_change_pp")
    out = {}
    for st, r in pe.items():
        r = dict(r)
        for k in keys:
            if f"{k}_measured" in r:
                r[k] = r[f"{k}_measured"]
        out[st] = r
    return out, True


def summarize(label, year, rate="measured"):
    pe, rows = _raw(label, year)
    pe, masked = _measured(pe, rate)
    acs = {r["state"]: float(r["child_spm_rate"]) for r in _csv("census_child_spm.csv")}
    cps = {r["state"]: (float(r["child_spm_rate"]), float(r["child_spm_moe"]))
           for r in _csv("census_child_spm_cps3yr_2023_2025.csv")}
    costs = {r["state"]: r for r in _csv("state_credit_costs.csv")}

    spm_acs = {st: _pct(r["poverty_child"], acs.get(st)) for st, r in pe.items()}
    spm_cps = {st: _pct(r["poverty_child"], cps[st][0]) for st, r in pe.items() if st in cps}
    within_moe = sum(
        abs(r["poverty_child"] - cps[st][0]) <= cps[st][1]
        for st, r in pe.items() if st in cps
    )
    eitc = [_pct(r["eitc_cost"], costs.get(st, {}).get("eitc_cost_target"))
            for st, r in pe.items() if r.get("has_eitc")]
    ctc = [_pct(r["ctc_cost"], costs.get(st, {}).get("ctc_cost_target"))
           for st, r in pe.items() if r.get("has_ctc")]

    kids = sum(r["pop_under_18"] for r in pe.values())
    nat_child_spm = sum(r["poverty_child"] * r["pop_under_18"] for r in pe.values()) / kids
    nat_ref = sum(r["ref_ctc2021_child_pov_change_pp"] * r["pop_under_18"]
                  for r in pe.values()) / kids

    def total(k):
        return sum(r.get(k, 0) or 0 for r in pe.values())

    return {
        "label": label,
        "year": year,
        "gq_masked": masked,
        "gq_person_share_pct": round(
            sum(r.get("gq_person_share", 0) * r["pop_total"] for r in pe.values())
            / sum(r["pop_total"] for r in pe.values()), 2),
        "pe_us": sorted({r["pe_us"] for r in pe.values()}),
        "states_ok": len(pe),
        "states_error": [(r["state"], r.get("error")) for r in rows if r.get("status") != "ok"],
        "national_child_spm_pct": round(nat_child_spm, 2),
        "child_spm_vs_acs2023": _fit(spm_acs.values()),
        "child_spm_vs_cps3yr_2023_25": {**_fit(spm_cps.values()), "within_census_moe": within_moe},
        "eitc_cost_vs_official": _fit(eitc),
        "ctc_cost_vs_official": _fit(ctc),
        "totals_bn": {
            "ssi": round(total("ssi_total") / 1e9, 2),
            "social_security": round(total("social_security_total") / 1e9, 1),
            "snap": round(total("snap_total") / 1e9, 2),
            "tanf": round(total("tanf_total") / 1e9, 2),
            "federal_eitc": round(total("federal_eitc_total") / 1e9, 2),
            "federal_ctc": round(total("federal_ctc_total") / 1e9, 2),
            "ref_ctc2021_transfer": round(total("ref_ctc2021_transfer") / 1e9, 2),
        },
        "population_m": round(total("pop_total") / 1e6, 2),
        "children_m": round(kids / 1e6, 2),
        "ref_ctc2021_national_child_pov_change_pp": round(nat_ref, 2),
        "per_state": {
            st: {
                "child_spm": round(r["poverty_child"], 2),
                "vs_acs2023_pct": None if spm_acs[st] is None else round(spm_acs[st], 1),
                "vs_cps3yr_pct": None if spm_cps.get(st) is None else round(spm_cps[st], 1),
                "ref_ctc2021_pp": round(r["ref_ctc2021_child_pov_change_pp"], 2),
            }
            for st, r in sorted(pe.items())
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default="buildp,buildo")
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--rate", choices=["measured", "all"], default="measured",
                    help="measured = ACS group quarters masked (Census ACS SPM "
                         "universe); falls back to all units when unavailable")
    args = ap.parse_args()
    labels = [x.strip() for x in args.labels.split(",")]
    res = {lab: summarize(lab, args.year, args.rate) for lab in labels}

    keys = [
        ("gq_masked", None),
        ("gq_person_share_pct", None),
        ("national_child_spm_pct", None),
        ("child_spm_vs_acs2023", "median_pct"),
        ("child_spm_vs_acs2023", "within_25"),
        ("child_spm_vs_cps3yr_2023_25", "median_pct"),
        ("child_spm_vs_cps3yr_2023_25", "within_25"),
        ("child_spm_vs_cps3yr_2023_25", "within_census_moe"),
        ("eitc_cost_vs_official", "median_pct"),
        ("eitc_cost_vs_official", "within_25"),
        ("ctc_cost_vs_official", "median_pct"),
        ("ctc_cost_vs_official", "within_25"),
        ("ref_ctc2021_national_child_pov_change_pp", None),
    ]
    print(f"\n=== Sweep scorecard, {args.year} ===")
    print(f"{'metric':<52}" + "".join(f"{lab:>14}" for lab in labels))
    for k, sub in keys:
        name = k if sub is None else f"{k}.{sub}"
        vals = [res[lab][k] if sub is None else res[lab][k].get(sub) for lab in labels]
        print(f"{name:<52}" + "".join(f"{str(v):>14}" for v in vals))
    for tk in ("social_security", "ssi", "snap", "federal_eitc", "federal_ctc", "ref_ctc2021_transfer"):
        print(f"{'totals_bn.' + tk:<52}" + "".join(f"{res[lab]['totals_bn'][tk]:>14}" for lab in labels))
    for lab in labels:
        if res[lab]["states_error"]:
            print(f"{lab} errors: {res[lab]['states_error']}")

    if len(labels) == 2:
        a, b = labels
        pa, pb = res[a]["per_state"], res[b]["per_state"]
        common = sorted(set(pa) & set(pb))
        d_spm = [pb[s]["child_spm"] - pa[s]["child_spm"] for s in common]
        d_ref = [pb[s]["ref_ctc2021_pp"] - pa[s]["ref_ctc2021_pp"] for s in common]
        print(f"\n{b} minus {a}, per state (n={len(common)}):")
        print(f"  child SPM pp: median {stats.median(d_spm):+.2f}, "
              f"range {min(d_spm):+.2f} to {max(d_spm):+.2f}")
        print(f"  2021-CTC reform impact pp: median {stats.median(d_ref):+.2f}, "
              f"range {min(d_ref):+.2f} to {max(d_ref):+.2f}")
        movers = sorted(common, key=lambda s: -abs(pb[s]['child_spm'] - pa[s]['child_spm']))[:8]
        print("  biggest child-SPM movers: " + ", ".join(
            f"{s} {pa[s]['child_spm']:.1f}->{pb[s]['child_spm']:.1f}" for s in movers))

    path = os.path.join(OUT, f"sweep_summary_{'_'.join(labels)}_{args.year}_{args.rate}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)
    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
