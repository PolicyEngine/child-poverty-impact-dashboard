"""Merge the Modal audit output with external targets and write two CSVs.

Inputs
  output/state_audit_raw.json          - per-state PE values (from Modal)
  targets/census_pep_v2025_state_single_age.csv - Census Vintage 2025 resident
                                         population by state and single year of
                                         age, July 1 2024 and 2025
  targets/census_child_spm.csv         - Census SPM child poverty by state (3-yr)
  targets/state_credit_costs.csv       - hand-compiled state EITC/CTC cost targets

Outputs
  output/state_populations_poverty.csv
  output/state_credit_costs.csv

Each output carries a pct_diff = (pe - target) / target * 100 wherever a
target is available; blank otherwise. Population targets come from the Census
estimates for the audit's year, or for ``--target-year``; an audit of a year
the file does not cover compares against its latest year, 2025, and the
``target_year`` column records which year each row used.

Optional args, for auditing a different dataset against the same targets
(e.g. the production Populace slices from state_audit_populace_modal.py)
without clobbering an earlier run's deliverables::

    python build_csvs.py --raw state_audit_populace_raw.json --suffix _populace
"""

from __future__ import annotations

import argparse
import csv
import json
import os

from census_age_fit import load_census

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "output")
TARGETS = os.path.join(HERE, "targets")

#: Years the Census Vintage 2025 targets file covers.
CENSUS_YEARS = (2024, 2025)


def _pct(pe, target):
    if target in (None, "", 0) or pe is None:
        return ""
    try:
        return round((float(pe) - float(target)) / float(target) * 100, 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return ""


def _read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_pe(raw_name: str = "state_audit_raw.json"):
    with open(os.path.join(OUT, raw_name), encoding="utf-8") as f:
        rows = json.load(f)
    return {r["state"].upper(): r for r in rows}


def pop_target_year(pe: dict, requested: int | None = None) -> int:
    """The Census year to compare against: requested, the audit's, or 2025."""
    if requested is not None:
        if requested not in CENSUS_YEARS:
            raise SystemExit(f"--target-year must be one of {CENSUS_YEARS}")
        return requested
    years = {r.get("year") for r in pe.values()}
    if len(years) == 1 and next(iter(years)) in CENSUS_YEARS:
        return next(iter(years))
    print(f"audit years {sorted(map(str, years))}: comparing with Census {max(CENSUS_YEARS)}")
    return max(CENSUS_YEARS)


def load_spm_targets():
    out = {}
    for r in _read_csv(os.path.join(TARGETS, "census_child_spm.csv")):
        out[r["state"].upper()] = r.get("child_spm_rate", "")
    return out


def load_cost_targets():
    out = {}
    for r in _read_csv(os.path.join(TARGETS, "state_credit_costs.csv")):
        out[r["state"].upper()] = r
    return out


def build(raw_name: str = "state_audit_raw.json", suffix: str = "", target_year: int | None = None):
    pe = load_pe(raw_name)
    year = pop_target_year(pe, target_year)
    pop_t = load_census(year)
    spm_t = load_spm_targets()
    cost_t = load_cost_targets()
    states = sorted(pe)

    # --- CSV 1: populations + poverty ---
    pop_path = os.path.join(OUT, f"state_populations_poverty{suffix}.csv")
    with open(pop_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "state",
            "target_year",
            "pe_pop_total", "target_pop_total", "pop_total_pct_diff",
            "pe_pop_under_1", "target_pop_under_1", "pop_under_1_pct_diff",
            "pe_pop_under_5", "target_pop_under_5", "pop_under_5_pct_diff",
            "pe_pop_under_6", "target_pop_under_6", "pop_under_6_pct_diff",
            "pe_pop_under_18", "target_pop_under_18", "pop_under_18_pct_diff",
            "pe_child_poverty_spm", "target_child_poverty_spm", "child_poverty_pct_diff",
            "pe_young_child_poverty_spm", "pe_under_1_poverty_spm",
            "pe_deep_child_poverty_spm", "pe_all_poverty_spm",
        ])
        for st in states:
            r = pe[st]
            pt = pop_t[st]
            tgt_pov = spm_t.get(st, "")
            row = [st, year]
            for group in ("total", "under_1", "under_5", "under_6", "under_18"):
                row += [round(r[f"pop_{group}"]), round(pt[group]), _pct(r[f"pop_{group}"], pt[group])]
            w.writerow(row + [
                round(r["poverty_child"], 2), tgt_pov,
                _pct(r["poverty_child"], tgt_pov),
                round(r["poverty_young_child"], 2),
                round(r["poverty_under_1"], 2),
                round(r["poverty_deep_child"], 2),
                round(r["poverty_all"], 2),
            ])
    print(f"wrote {pop_path}")

    # --- CSV 2: state EITC/CTC cost (repeal budgetary impact) ---
    cost_path = os.path.join(OUT, f"state_credit_costs{suffix}.csv")
    with open(cost_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "state",
            "has_eitc", "pe_eitc_cost", "target_eitc_cost", "eitc_pct_diff",
            "has_ctc", "pe_ctc_cost", "target_ctc_cost", "ctc_pct_diff",
            "cost_target_source",
        ])
        for st in states:
            r = pe[st]
            if not (r["has_eitc"] or r["has_ctc"]):
                continue
            ct = cost_t.get(st, {})
            eitc_tgt = ct.get("eitc_cost_target", "") or ""
            ctc_tgt = ct.get("ctc_cost_target", "") or ""
            w.writerow([
                st,
                r["has_eitc"], round(r["eitc_cost"]), eitc_tgt,
                _pct(r["eitc_cost"], eitc_tgt) if r["has_eitc"] else "",
                r["has_ctc"], round(r["ctc_cost"]), ctc_tgt,
                _pct(r["ctc_cost"], ctc_tgt) if r["has_ctc"] else "",
                ct.get("source", ""),
            ])
    print(f"wrote {cost_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default="state_audit_raw.json")
    parser.add_argument("--suffix", default="")
    parser.add_argument("--target-year", type=int, default=None,
                        help="Census year for population targets (default: the audit's year)")
    args = parser.parse_args()
    build(raw_name=args.raw, suffix=args.suffix, target_year=args.target_year)
