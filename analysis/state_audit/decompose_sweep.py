"""Separate the DATA effect from the MODEL effect in a dataset sweep.

Cells (all GQ-masked "measured" SPM rates):
    P   production data, production model   (Build P @ policyengine-us 1.825.2)
    O1  new data,        production model   (Build O 10/17 @ 1.825.2)
    O2  new data,        certified model    (Build O 10/17 @ 2.2.1)
    O3  new data,        candidate model    (Build O 10/17 @ 2.30.1)

data effect = O1 - P; model effect = O3 - O1 (O2 shows how much of it is
already present at the release's certified version).

    python analysis/state_audit/decompose_sweep.py
"""

from __future__ import annotations

import csv
import json
import os
import statistics as stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")

CELLS = {
    "P": {2024: "buildp_v2", 2025: "buildp_v2_y25", 2026: "buildp_v2"},
    "O1": {2024: "o1017_18252", 2025: "o1017_18252", 2026: "o1017_18252"},
    "O2": {2024: "o1017_221", 2026: "o1017_221"},
    "O3": {2024: "o1017_2301", 2025: "o1017_2301_y25", 2026: "o1017_2301"},
}
LABELS = {
    "P": "Build P @ 1.825.2 (production)",
    "O1": "Build O 10/17 @ 1.825.2",
    "O2": "Build O 10/17 @ 2.2.1 (certified)",
    "O3": "Build O 10/17 @ 2.30.1 (candidate)",
}
# Census P60-290: child SPM 2025 13.4%; 2024 re-based 13.5%.
CENSUS_NATIONAL = {2024: 13.5, 2025: 13.4}


def _load(label, year):
    path = os.path.join(OUT, f"state_audit_{label}_{year}_raw.json")
    if not os.path.exists(path):
        return None
    rows = [r for r in json.load(open(path, encoding="utf-8")) if r.get("status") == "ok"]
    return {r["state"]: r for r in rows} if len(rows) == 51 else None


def _m(r, k):
    return r.get(f"{k}_measured", r[k])


def national(pe, key="poverty_child", weight="pop_under_18"):
    return sum(_m(r, key) * r[weight] for r in pe.values()) / sum(r[weight] for r in pe.values())


def main():
    cps = {r["state"]: (float(r["child_spm_rate"]), float(r["child_spm_moe"]))
           for r in csv.DictReader(open(os.path.join(HERE, "targets", "census_child_spm_cps3yr_2023_2025.csv"), encoding="utf-8"))}
    data = {c: {y: _load(lab, y) for y, lab in yl.items()} for c, yl in CELLS.items()}

    print("National child SPM (GQ masked), % — Census 2024 13.5 (re-based), 2025 13.4")
    print(f"{'cell':<38}" + "".join(f"{y:>9}" for y in (2024, 2025, 2026)) + "   24->26")
    for c in CELLS:
        vals = {y: national(data[c][y]) if data[c].get(y) else None for y in (2024, 2025, 2026)}
        trend = (f"{vals[2026] - vals[2024]:+.2f}" if vals[2024] and vals[2026] else "")
        print(f"{LABELS[c]:<38}" + "".join(f"{v:>9.2f}" if v else f"{'-':>9}" for v in vals.values()) + f"   {trend}")

    print("\nState fit vs Census CPS 3-yr (2023-25), 2024: median % diff | within ±25% | within MOE | MAE pp")
    for c in CELLS:
        pe = data[c].get(2024)
        if not pe:
            continue
        d = [(_m(r, "poverty_child") - cps[st][0]) / cps[st][0] * 100 for st, r in pe.items()]
        moe = sum(abs(_m(r, "poverty_child") - cps[st][0]) <= cps[st][1] for st, r in pe.items())
        mae = stats.mean(abs(_m(r, "poverty_child") - cps[st][0]) for st, r in pe.items())
        print(f"  {LABELS[c]:<38} {stats.median(d):+6.1f}% | {sum(abs(x) <= 25 for x in d):>2}/51 | {moe:>2}/51 | {mae:.2f}")

    print("\nDecomposition of the change vs production (national child SPM, pp)")
    for y in (2024, 2025, 2026):
        p, o1, o3 = (data[c].get(y) for c in ("P", "O1", "O3"))
        if not (p and o1 and o3):
            continue
        dp, d1, d3 = national(p), national(o1), national(o3)
        print(f"  {y}: total {d3 - dp:+.2f} = data {d1 - dp:+.2f} + model {d3 - d1:+.2f}")

    print("\nReference reform (restore 2021 CTC), national child SPM change, pp")
    for c in CELLS:
        vals = []
        for y in (2024, 2026):
            pe = data[c].get(y)
            vals.append(f"{national(pe, 'ref_ctc2021_child_pov_change_pp'):+.2f}" if pe else "-")
        print(f"  {LABELS[c]:<38} 2024 {vals[0]:>6}   2026 {vals[1]:>6}")

    # Benchmarks: OASDI benefits paid CY2024 $1.47T (2025 Trustees Report,
    # ssa.gov/oact/TR/2025/II_A_highlights.html); SNAP BENEFITS FY2024 $93.7B
    # of $100.3B federal spending (USDA ERS EIB, FY2024 Food and Nutrition
    # Assistance Landscape) — compare `snap` to benefits, not total spending.
    print("\nProgram totals 2024, $bn (benchmarks: OASDI benefits CY2024 ~1,470; SNAP benefits FY2024 ~93.7)")
    for c in CELLS:
        pe = data[c].get(2024)
        if pe:
            tot = lambda k: sum(r.get(k) or 0 for r in pe.values()) / 1e9
            print(f"  {LABELS[c]:<38} SS {tot('social_security_total'):>7.1f}  SNAP {tot('snap_total'):>6.1f}  SSI {tot('ssi_total'):>5.1f}  fed EITC {tot('federal_eitc_total'):>5.1f}")


if __name__ == "__main__":
    main()
