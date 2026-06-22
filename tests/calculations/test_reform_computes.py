"""Prove every reform option the dashboard exposes actually computes.

The dashboard's promise: whatever options a user selects in a state, they reach
the impact page with a real result. The Modal backend turns the frontend's flat
reform dict into a policyengine-us ``Reform`` and runs a ``Microsimulation``. If
any option emits a parameter path that doesn't exist in the *pinned* PE-US
version (a typo, a stale bracket index, a contrib flag that isn't shipped yet),
``Reform.from_dict`` / the first ``calculate`` raises and that state's tab shows
"Analysis failed" instead of an impact.

This test closes that gap using the coverage manifest the frontend produces
(``npm run manifest`` → ``frontend/__generated__/reform-manifest.json``) — the
*exact* reform dicts the frontend would POST — checked against the same pinned
PE-US the Modal endpoint uses. Two complementary layers:

1. ``test_reform_path_resolves`` (every entry): assert every parameter path the
   option emits exists in the pinned system's parameter tree. Building a
   reformed PE-US system costs ~30s, so doing it for all ~200 entries is
   infeasible in CI — but an invalid path is the dominant breakage, and it shows
   up as a missing parameter name. Bracketed paths (``…arpa[0].amount``) and
   breakdown keys (``…threshold.SINGLE``) appear verbatim among the system's
   parameter descendants, so membership is exact. One system build, then instant.

2. ``test_representative_reform_computes`` (curated subset): a real
   ``Simulation(reform=…).calculate(…)`` for one reform per dispatch branch /
   mechanism (each federal switch case, a state CTC, structured + match state
   EITCs, the baseline/contrib/repeal dependent-exemption mechanisms, the child
   allowance, and a combo). Catches the rare compute-time failure a path check
   can't, while staying within a few minutes.

Set ``CPID_FULL_COMPUTE=1`` to additionally run ``test_reform_computes_all``,
which does a full compute for *every* non-empty entry (slow, ~1–2h; for a
nightly / pre-release sweep, not PR CI).

A household sim is used throughout (no microdata → fast, low-memory); an invalid
path or compute error surfaces regardless of dataset.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path

import pytest
from policyengine_core.reforms import Reform
from policyengine_us import Simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "frontend" / "__generated__" / "reform-manifest.json"

# One reform per dispatch branch / mechanism in buildReformDict — enough to
# prove the end-to-end compute path for each kind of option.
REPRESENTATIVE_IDS = [
    "federal_ctc_expanded",
    "federal_afa",
    "federal_tax_cuts_for_workers",
    "federal_working_parents_tax_relief",
    "child_allowance",
    "ca_ctc",  # state CTC builder
    "mn_eitc",  # structured EITC builder
    "ca_eitc",  # federal-match EITC builder
    "ca_dependent_exemption",  # baseline mechanism
    "ri_dependent_exemption",  # contrib (separate) mechanism
    "sc_dependent_exemption",  # repeal mechanism
]


def _build_core_reform_dict(reform: dict | None, year: int) -> dict | None:
    """Mirror of ``scripts/modal_cpid_endpoint.py``'s ``_build_core_reform_dict``.

    Coerce the frontend's flat reform dict (scalars, or ``{date: value}`` maps)
    into the ``{param.path: {date: value}}`` shape ``Reform.from_dict`` expects.
    Duplicated here so this test depends only on policyengine-us, not on the
    Modal endpoint module (which constructs a Modal app at import time).
    """
    if not reform:
        return None
    default_date = f"{year}-01-01"
    out: dict = {}
    for path, spec in reform.items():
        if isinstance(spec, dict):
            out[path] = dict(spec)
        else:
            out[path] = {default_date: spec}
    return out


def _household_situation(state: str, year: int) -> dict:
    """A married couple with two children (ages 4 and 9) and modest earnings,
    resident in ``state`` — exercises state and federal CTC/EITC, dependent
    exemptions, and a child allowance."""
    y = str(year)
    members = ["head", "spouse", "child_young", "child_older"]
    return {
        "people": {
            "head": {"age": {y: 40}, "employment_income": {y: 35_000}},
            "spouse": {"age": {y: 38}, "employment_income": {y: 18_000}},
            "child_young": {"age": {y: 4}},
            "child_older": {"age": {y: 9}},
        },
        "tax_units": {"tax_unit": {"members": members}},
        "families": {"family": {"members": members}},
        "marital_units": {
            "parents": {"members": ["head", "spouse"]},
            "child_young_unit": {"members": ["child_young"]},
            "child_older_unit": {"members": ["child_older"]},
        },
        "spm_units": {"spm_unit": {"members": members}},
        "households": {
            "household": {"members": members, "state_name": {y: state}},
        },
    }


def _load_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        pytest.skip(
            "reform manifest not found at "
            f"{MANIFEST_PATH} — run `cd frontend && npm run manifest` first "
            "(CI regenerates it before this test).",
            allow_module_level=True,
        )
    data = json.loads(MANIFEST_PATH.read_text())
    entries = data["entries"]
    assert entries, "manifest is empty — the coverage sweep found no options"
    return entries


_ENTRIES = _load_manifest()
_NONEMPTY = [e for e in _ENTRIES if e["reform"]]


@lru_cache(maxsize=1)
def _parameter_names() -> frozenset[str]:
    """Every parameter path in the pinned system, e.g.
    ``gov.irs.credits.ctc.amount.arpa[0].amount`` — built once."""
    system = Simulation(
        situation=_household_situation("CA", 2026)
    ).tax_benefit_system
    return frozenset(d.name for d in system.parameters.get_descendants())


def _case_id(entry: dict) -> str:
    return f"{entry['state']}:{entry['kind']}:{'+'.join(entry['ids'])}"


def _representative_entries() -> list[dict]:
    """The richest (most paths) non-empty entry for each representative id,
    plus the first non-empty combo."""
    out: list[dict] = []
    for want in REPRESENTATIVE_IDS:
        cands = [e for e in _NONEMPTY if e["ids"] == [want]]
        if cands:
            out.append(max(cands, key=lambda e: len(e["reform"])))
    combo = next((e for e in _NONEMPTY if e["kind"] == "combo"), None)
    if combo is not None:
        out.append(combo)
    return out


_REPRESENTATIVE = _representative_entries()


@pytest.mark.parametrize("entry", _ENTRIES, ids=[_case_id(e) for e in _ENTRIES])
def test_reform_path_resolves(entry: dict) -> None:
    """Every parameter path an option emits exists in the pinned system.

    Catches typos, renamed/removed parameters, out-of-range bracket indices,
    and wrong breakdown keys — the failure mode that silently breaks a state.
    """
    names = _parameter_names()
    missing = sorted(p for p in entry["reform"] if p not in names)
    assert not missing, (
        f"{_case_id(entry)} emits parameter path(s) absent from the pinned "
        f"policyengine-us: {missing}. Fix the registry/builder path, or mark "
        f"the option in_development until PE-US ships the lever."
    )


@pytest.mark.parametrize(
    "entry", _REPRESENTATIVE, ids=[_case_id(e) for e in _REPRESENTATIVE]
)
def test_representative_reform_computes(entry: dict) -> None:
    """One reform per dispatch branch / mechanism computes end-to-end."""
    _compute(entry)


@pytest.mark.skipif(
    os.environ.get("CPID_FULL_COMPUTE") != "1",
    reason="full per-entry compute is slow (~1-2h); set CPID_FULL_COMPUTE=1",
)
@pytest.mark.parametrize(
    "entry", _NONEMPTY, ids=[_case_id(e) for e in _NONEMPTY]
)
def test_reform_computes_all(entry: dict) -> None:
    """Exhaustive: a full compute for every non-empty reform (opt-in)."""
    _compute(entry)


def _compute(entry: dict) -> None:
    year = int(entry["year"])
    core = _build_core_reform_dict(entry["reform"], year)
    reform = Reform.from_dict(core, country_id="us") if core else None
    sim = Simulation(
        situation=_household_situation(entry["state"], year),
        reform=reform,
    )
    net_income = sim.calculate("household_net_income", year)
    sim.calculate("state_income_tax", year)
    assert net_income is not None


_PATH_RE = re.compile(r"^[A-Za-z0-9_.\[\]]+$")


def test_manifest_paths_are_wellformed() -> None:
    """Cheap sanity check that runs without policyengine-us."""
    for entry in _ENTRIES:
        for path in entry["reform"]:
            assert _PATH_RE.match(path), f"malformed path in {_case_id(entry)}: {path}"
