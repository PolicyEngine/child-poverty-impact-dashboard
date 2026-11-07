"""Score state slices' age counts against exact Census single-year estimates.

This script compares each audit output with Census Vintage 2025 resident
population by single year of age
(``targets/census_pep_v2025_state_single_age.csv``, from
``sc-est2025-alldata6.csv``: SUMLEV 040, SEX 0, ORIGIN 0, summed over RACE
1-6; July 1 estimates for 2024 and 2025).

Usage::

    python analysis/state_audit/census_age_fit.py --year 2024 \\
        buildp=state_audit_buildp_v2_2024_raw.json \\
        buildo=state_audit_o1017_221_2024_raw.json

Each ``label=file`` names a raw audit output in ``output/``. Writes
``output/census_age_fit_{year}.csv`` (one row per state and label) and
prints a national summary per label.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import statistics
from collections import Counter
from collections.abc import Iterable

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
CENSUS = os.path.join(HERE, "targets", "census_pep_v2025_state_single_age.csv")

#: Audit field -> Census column. ``adults`` is total minus under-18 on both sides.
GROUPS = {
    "pop_total": "total",
    "pop_under_1": "under_1",
    "pop_under_5": "under_5",
    "pop_under_6": "under_6",
    "pop_under_18": "under_18",
}


def state_coverage_problems(states: Iterable[str]) -> list[str]:
    """States a run leaves out, repeats or adds, against the Census file's."""
    seen = Counter(states)
    with open(CENSUS, newline="", encoding="utf-8") as f:
        census = {r["state"] for r in csv.DictReader(f)}
    return sorted(s for s in census | set(seen) if seen[s] != 1 or s not in census)


def load_census(year: int) -> dict[str, dict[str, float]]:
    with open(CENSUS, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if int(r["year"]) == year]
    if len(rows) != 51:
        raise SystemExit(f"{CENSUS} has {len(rows)} states for {year}, not 51")
    return {
        r["state"]: {k: float(v) for k, v in r.items() if k not in ("state", "state_fips", "year")}
        for r in rows
    }


def load_audit(name: str) -> dict[str, dict]:
    with open(os.path.join(OUT, name), encoding="utf-8") as f:
        rows = json.load(f)
    bad = [r["state"] for r in rows if r.get("status") != "ok"]
    if bad:
        raise SystemExit(f"{name}: states without status ok: {bad}")
    return {r["state"].upper(): r for r in rows}


def pct(pe: float, target: float) -> float:
    return (pe - target) / target * 100


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("audits", nargs="+", help="label=raw_file.json in output/")
    args = parser.parse_args()
    census = load_census(args.year)
    audits = {}
    for item in args.audits:
        label, _, name = item.partition("=")
        audits[label] = (name, load_audit(name))

    out_path = os.path.join(OUT, f"census_age_fit_{args.year}.csv")
    fields = ["label", "audit_file", "state"]
    for group in (*GROUPS, "pop_adults"):
        fields += [f"pe_{group}", f"census_{group}", f"{group}_pct_diff"]
    fields += ["poverty_child", "poverty_child_measured"]
    rows = []
    for label, (name, audit) in audits.items():
        if set(audit) != set(census):
            raise SystemExit(f"{name}: states differ from Census: {sorted(set(audit) ^ set(census))}")
        for st in sorted(census):
            r, c = audit[st], census[st]
            row = {"label": label, "audit_file": name, "state": st}
            for group, column in GROUPS.items():
                row[f"pe_{group}"] = round(r[group])
                row[f"census_{group}"] = round(c[column])
                row[f"{group}_pct_diff"] = round(pct(r[group], c[column]), 2)
            pe_adults = r["pop_total"] - r["pop_under_18"]
            row["pe_pop_adults"] = round(pe_adults)
            row["census_pop_adults"] = round(c["adults"])
            row["pop_adults_pct_diff"] = round(pct(pe_adults, c["adults"]), 2)
            row["poverty_child"] = round(r["poverty_child"], 2)
            row["poverty_child_measured"] = round(r["poverty_child_measured"], 2)
            rows.append(row)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {out_path} ({len(rows)} rows)")

    for label, (name, audit) in audits.items():
        print(f"\n{label} ({name}), year {args.year}:")
        for group, column in (*GROUPS.items(), ("pop_adults", "adults")):
            if group == "pop_adults":
                pe = sum(r["pop_total"] - r["pop_under_18"] for r in audit.values())
            else:
                pe = sum(r[group] for r in audit.values())
            target = sum(c[column] for c in census.values())
            print(f"  {group:<14} PE {pe:>14,.0f}  Census {target:>14,.0f}  {pct(pe, target):+6.2f}%")
        diffs = [pct(audit[st]["pop_under_18"], census[st]["under_18"]) for st in census]
        print(
            "  under-18 by state: median {:+.1f}%, min {:+.1f}%, max {:+.1f}%, "
            "over +5%: {} of 51".format(
                statistics.median(diffs), min(diffs), max(diffs), sum(d > 5 for d in diffs)
            )
        )


if __name__ == "__main__":
    main()
