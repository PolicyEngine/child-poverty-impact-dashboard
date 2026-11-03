"""Compare state child SPM poverty between two audit runs and a Census table.

Reads ``output/state_audit_{label}_{year}_raw.json`` for each label and a
Census benchmark from ``targets/``, and prints a Markdown table (one row per
state) plus each run's median signed % difference from Census and the number
of states within +/-25% of it, the measures the 2026-08-20 dataset adoption
quoted. Rates are the group-quarters-masked ("measured") ones where a run has
them.

    python analysis/state_audit/compare_child_spm.py \\
        --old buildp_v2 --new py6111 --year 2024

``--census acs`` (default) is targets/census_child_spm.csv, the Census ACS SPM
state table for 2023 that the 2026-08-20 comparison used; ``--census cps`` is
the CPS three-year average for 2023-2025 (P60-290 Table 18).
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
CENSUS_FILES = {
    "acs": "census_child_spm.csv",
    "cps": "census_child_spm_cps3yr_2023_2025.csv",
}


def child_rates(label: str, year: int) -> dict:
    rows = json.loads((HERE / "output" / f"state_audit_{label}_{year}_raw.json").read_text())
    rates = {}
    for row in rows:
        if row.get("status") != "ok":
            continue
        rates[row["state"]] = row.get("poverty_child_measured", row["poverty_child"])
    return rates


def census_rates(name: str) -> dict:
    with open(HERE / "targets" / CENSUS_FILES[name], encoding="utf-8") as handle:
        return {row["state"]: float(row["child_spm_rate"]) for row in csv.DictReader(handle)}


def percent_difference(model: float, census: float) -> float:
    return (model - census) / census * 100


def fit(rates: dict, census: dict) -> dict:
    differences = [percent_difference(rates[state], census[state]) for state in rates if state in census]
    return {
        "states": len(differences),
        "median_pct": statistics.median(differences),
        "within_25": sum(abs(value) <= 25 for value in differences),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--old", required=True)
    parser.add_argument("--new", required=True)
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--census", choices=sorted(CENSUS_FILES), default="acs")
    args = parser.parse_args()

    old = child_rates(args.old, args.year)
    new = child_rates(args.new, args.year)
    census = census_rates(args.census)
    print(
        f"| State | {args.old} {args.year} (%) | {args.new} {args.year} (%) | "
        f"Census ({args.census}) (%) | {args.old} vs Census | {args.new} vs Census | Change (pp) |"
    )
    print("|---|---:|---:|---:|---:|---:|---:|")
    for state in sorted(census):
        if state not in old or state not in new:
            print(f"| {state} | {old.get(state, '')} | {new.get(state, '')} | {census[state]:.1f} | | | |")
            continue
        print(
            f"| {state} | {old[state]:.1f} | {new[state]:.1f} | {census[state]:.1f} | "
            f"{percent_difference(old[state], census[state]):+.1f}% | "
            f"{percent_difference(new[state], census[state]):+.1f}% | "
            f"{new[state] - old[state]:+.1f} |"
        )
    for label, rates in ((args.old, old), (args.new, new)):
        summary = fit(rates, census)
        print(
            f"\n{label} {args.year}: median {summary['median_pct']:+.1f}% vs Census, "
            f"{summary['within_25']} of {summary['states']} states within +/-25%"
        )


if __name__ == "__main__":
    main()
