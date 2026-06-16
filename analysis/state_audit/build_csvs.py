"""Merge the Modal audit output with external targets and write two CSVs.

Inputs
  output/state_audit_raw.json          - per-state PE values (from Modal)
  <pe-us-data>/.../population_by_state.csv, age_state.csv  - population targets
  targets/census_child_spm.csv         - Census SPM child poverty by state (3-yr)
  targets/state_credit_costs.csv       - hand-compiled state EITC/CTC cost targets

Outputs
  output/state_populations_poverty.csv
  output/state_credit_costs.csv

Each output carries a pct_diff = (pe - target) / target * 100 wherever a
target is available; blank otherwise.
"""

from __future__ import annotations

import csv
import json
import os

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "output")
TARGETS = os.path.join(HERE, "targets")

# Local checkout of the data repo's calibration targets.
CALIB = os.path.normpath(
    os.path.join(
        HERE,
        "..", "..", "..",
        "policyengine-us-data", "policyengine_us_data",
        "storage", "calibration_targets",
    )
)


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


def load_pe():
    with open(os.path.join(OUT, "state_audit_raw.json"), encoding="utf-8") as f:
        rows = json.load(f)
    return {r["state"].upper(): r for r in rows}


def load_pop_targets():
    """total + under-5 (exact) and under-18 (approx from 5-yr brackets)."""
    pop = {}
    for r in _read_csv(os.path.join(CALIB, "population_by_state.csv")):
        pop[r["state"].upper()] = {
            "total": float(r["population"]),
            "under_5": float(r["population_under_5"]),
        }
    for r in _read_csv(os.path.join(CALIB, "age_state.csv")):
        st = r.get("GEO_NAME", "").upper()
        if st not in pop:
            pop[st] = {}
        # under-18 ~ 0-4 + 5-9 + 10-14 + 15-19 (overcounts 18-19yo).
        try:
            pop[st]["under_18_approx"] = sum(
                float(r[b]) for b in ("0-4", "5-9", "10-14", "15-19")
            )
            # under-6 ~ 0-4 + 1/5 * 5-9 (approx).
            pop[st]["under_6_approx"] = float(r["0-4"]) + float(r["5-9"]) / 5
        except (KeyError, ValueError):
            pass
    return pop


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


def build():
    pe = load_pe()
    pop_t = load_pop_targets()
    spm_t = load_spm_targets()
    cost_t = load_cost_targets()
    states = sorted(pe)

    # --- CSV 1: populations + poverty ---
    pop_path = os.path.join(OUT, "state_populations_poverty.csv")
    with open(pop_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "state",
            "pe_pop_total", "target_pop_total", "pop_total_pct_diff",
            "pe_pop_under_1",
            "pe_pop_under_5", "target_pop_under_5", "pop_under_5_pct_diff",
            "pe_pop_under_6", "target_pop_under_6_approx", "pop_under_6_pct_diff",
            "pe_pop_under_18", "target_pop_under_18_approx", "pop_under_18_pct_diff",
            "pe_child_poverty_spm", "target_child_poverty_spm", "child_poverty_pct_diff",
            "pe_young_child_poverty_spm", "pe_under_1_poverty_spm",
            "pe_deep_child_poverty_spm", "pe_all_poverty_spm",
        ])
        for st in states:
            r = pe[st]
            pt = pop_t.get(st, {})
            tgt_total = pt.get("total")
            tgt_u5 = pt.get("under_5")
            tgt_u6 = pt.get("under_6_approx")
            tgt_u18 = pt.get("under_18_approx")
            tgt_pov = spm_t.get(st, "")
            w.writerow([
                st,
                round(r["pop_total"]), tgt_total and round(tgt_total),
                _pct(r["pop_total"], tgt_total),
                round(r["pop_under_1"]),
                round(r["pop_under_5"]), tgt_u5 and round(tgt_u5),
                _pct(r["pop_under_5"], tgt_u5),
                round(r["pop_under_6"]), tgt_u6 and round(tgt_u6),
                _pct(r["pop_under_6"], tgt_u6),
                round(r["pop_under_18"]), tgt_u18 and round(tgt_u18),
                _pct(r["pop_under_18"], tgt_u18),
                round(r["poverty_child"], 2), tgt_pov,
                _pct(r["poverty_child"], tgt_pov),
                round(r["poverty_young_child"], 2),
                round(r["poverty_under_1"], 2),
                round(r["poverty_deep_child"], 2),
                round(r["poverty_all"], 2),
            ])
    print(f"wrote {pop_path}")

    # --- CSV 2: state EITC/CTC cost (repeal budgetary impact) ---
    cost_path = os.path.join(OUT, "state_credit_costs.csv")
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
    build()
