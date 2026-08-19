"""Generate frontend/data/current-law-defaults.json from the pinned engine.

The 2026-08-19 default-anchor audit found ~30 reform-editor defaults stale
for 2026 and more for 2027/2028 (the report wizard offers all three years):
static TS constants can't track uprated parameters. This script derives, for
every adjustable numeric param the anchors dump covers, the year-correct
UI default and the per-path engine values, straight from the pinned
policyengine-us. The frontend injects them at option-build time
(``currentLawDefault`` in lib/state-programs.ts), so display, the no-op
check, and multi-path emission all anchor to the same engine truth.

Skipped (keep their hardcoded defaults): ``gov.contrib.*`` paths (proposal
levers — no current-law anchor) and params whose UI default is 0 (no scale
factor to convert engine→UI units).

Regenerate after every policyengine-us pin bump::

    cd frontend && npm run anchors
    .venv/Scripts/python scripts/generate_current_law_defaults.py

``tests/calculations/test_default_anchors.py`` fails when this file drifts
from the pinned engine, so a stale regeneration can't merge silently.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from policyengine_us.system import system

REPO_ROOT = Path(__file__).resolve().parents[1]
ANCHORS = REPO_ROOT / "frontend" / "__generated__" / "default-anchors.json"
OUT = REPO_ROOT / "frontend" / "data" / "current-law-defaults.json"

PARAMS = {d.name: d for d in system.parameters.get_descendants()}


def engine_value(path: str, year: int):
    node = PARAMS.get(path)
    if node is None:
        return None
    try:
        v = node(f"{year}-01-01")
    except Exception:
        return None
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def round_ui(value: float) -> float:
    """Truthful display rounding: whole dollars for dollar-scale values,
    two decimals for rates/small amounts. Deliberately NOT snapped to the
    slider step — a coarse step (ME's $5,000) would misstate the law by
    thousands, and the no-op check compares against this same value so an
    untouched slider still emits nothing."""
    return float(round(value)) if abs(value) >= 100 else round(value, 2)


def main() -> None:
    data = json.loads(ANCHORS.read_text())
    # (option_id, param) → year → [rows] (one per emitted path)
    grouped: dict[tuple[str, str], dict[int, list[dict]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for r in data["rows"]:
        if r["path"].startswith("gov.contrib."):
            continue
        if r["default_ui"] == 0:
            continue
        grouped[(r["option_id"], r["param"])][r["year"]].append(r)

    out: dict = {}
    for (option_id, param), by_year in sorted(grouped.items()):
        entry: dict = {"ui_default": {}, "paths": {}}
        ok = False
        for year, rows in sorted(by_year.items()):
            # Engine→UI scale from the first path's extrapolated default
            # (transforms are linear with no offset: identity or /100).
            first = rows[0]
            if first["default_engine"] == 0:
                continue
            scale = first["default_ui"] / first["default_engine"]
            law = engine_value(first["path"], year)
            if law is None:
                continue
            entry["ui_default"][str(year)] = round_ui(law * scale)
            for r in rows:
                law_p = engine_value(r["path"], year)
                if law_p is None:
                    continue
                entry["paths"].setdefault(r["path"], {})[str(year)] = law_p
            ok = True
        if ok:
            out[f"{option_id}.{param}"] = entry

    # Contrib-mechanism dependent exemptions mirror a BASELINE parameter the
    # anchors dump can't see (their emitted paths are all gov.contrib.*).
    # dependent-exemption-reforms.json carries the baseline anchor_path; the
    # UI amount is 1:1 with it.
    dep_reg = json.loads(
        (REPO_ROOT / "frontend" / "data" / "dependent-exemption-reforms.json")
        .read_text()
    )
    years = data["years"]
    for st, e in dep_reg.items():
        if st == "_comment" or not isinstance(e, dict):
            continue
        anchor = e.get("anchor_path")
        if not anchor:
            continue
        entry = {"ui_default": {}, "paths": {}}
        for year in years:
            law = engine_value(anchor, year)
            if law is None:
                continue
            entry["ui_default"][str(year)] = round_ui(law)
            entry["paths"][anchor] = {
                **entry["paths"].get(anchor, {}),
                str(year): law,
            }
        if entry["ui_default"]:
            out[f"{st.lower()}_dependent_exemption.amount"] = entry

    OUT.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    print(f"wrote {len(out)} (option, param) current-law defaults to {OUT}")


if __name__ == "__main__":
    main()
