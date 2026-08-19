"""Every adjustable param's displayed default must equal current law.

The dashboard's no-op contract (untouched sliders emit nothing) protects
untouched runs, but a stale ``default_value`` still (a) shows the user a
wrong "current law" number and (b) mis-anchors every edit — the NJ CTC
pre-increase tiers and RI's $5,200-vs-$5,250 exemption were both this bug.
The report wizard offers analysis years 2026–2028, so defaults must match
the pinned engine in all three.

``npm run anchors`` (frontend/scripts/dump-default-anchors.ts) recovers, for
every (state, option, param, year), the engine-facing value the UI default
corresponds to. This test resolves each anchored path in the pinned
policyengine-us at that year's Jan 1 and compares.

Tolerance: engine values are often uprated floats (CA's $485.76 vs a UI
default of 486); a mismatch is flagged only when it exceeds BOTH $2/0.002
absolute AND 0.4% relative — real staleness (a missed law change or vintage
drift) is far larger than rounding.

The audit is one aggregated test per year (not one test per anchor): a
single system build, instant lookups, and one readable failure listing every
stale default for that year.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import pytest
from policyengine_us.system import system

REPO_ROOT = Path(__file__).resolve().parents[2]
ANCHORS_PATH = REPO_ROOT / "frontend" / "__generated__" / "default-anchors.json"


def _load() -> dict:
    if not ANCHORS_PATH.exists():
        pytest.skip(
            f"default anchors not found at {ANCHORS_PATH} — run "
            "`cd frontend && npm run anchors` first.",
            allow_module_level=True,
        )
    return json.loads(ANCHORS_PATH.read_text())


_DATA = _load()
_YEARS = _DATA["years"]


@lru_cache(maxsize=1)
def _param_index() -> dict:
    return {d.name: d for d in system.parameters.get_descendants()}


def _engine_value(path: str, year: int):
    node = _param_index().get(path)
    if node is None:
        return None
    try:
        return node(f"{year}-01-01")
    except Exception:
        return None


def _mismatch(anchor: float, engine) -> bool:
    if not isinstance(engine, (int, float)):
        return False  # non-scalar (bool/list) — not a numeric anchor check
    diff = abs(anchor - float(engine))
    if diff <= max(2.0, 0.002):
        # Dollar rounding / tiny rate wobble.
        if diff <= 2.0 and abs(anchor) > 1:
            return False
        if diff <= 0.002:
            return False
    rel = diff / max(abs(float(engine)), 1e-9)
    return diff > 2.0 and rel > 0.004 or (abs(anchor) <= 1 and diff > 0.002)


def _is_current_law_anchor(row: dict) -> bool:
    """Only baseline parameters anchor to current law. ``gov.contrib.*``
    paths are proposal levers (child allowance tiers, create-a-credit
    matches, conversion amounts) — their engine baseline is legitimately
    0/off, and their UI defaults describe the proposal, not the law."""
    return not row["path"].startswith("gov.contrib.")


@pytest.mark.parametrize("year", _YEARS)
def test_defaults_match_current_law(year: int) -> None:
    rows = [
        r
        for r in _DATA["rows"]
        if r["year"] == year and _is_current_law_anchor(r)
    ]
    assert rows, f"no anchors dumped for {year}"
    stale = []
    missing = []
    for r in rows:
        engine = _engine_value(r["path"], year)
        if engine is None:
            missing.append(f"{r['state']}:{r['option_id']}.{r['param']} → {r['path']}")
            continue
        if _mismatch(r["default_engine"], engine):
            stale.append(
                f"{r['state']}:{r['option_id']}.{r['param']} ({r['label']}): "
                f"UI default → {r['default_engine']:g} but {year} law = "
                f"{float(engine):g}  [{r['path']}]"
            )
    report = ""
    if missing:
        report += f"\n{len(missing)} anchored path(s) missing from pinned PE-US:\n  " + "\n  ".join(missing)
    if stale:
        report += f"\n{len(stale)} stale default(s) for {year}:\n  " + "\n  ".join(stale)
    assert not (stale or missing), report
