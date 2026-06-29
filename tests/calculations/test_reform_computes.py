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


def _sharded(entries: list[dict]) -> list[dict]:
    """Select this shard's slice when ``CPID_SHARDS`` is set (CI fans the full
    compute out across that many parallel jobs, each ``CPID_SHARD`` = 0..N-1).
    Index-modulo keeps the split stable and balanced. No sharding → all."""
    n = os.environ.get("CPID_SHARDS")
    if not n:
        return entries
    shards = int(n)
    shard = int(os.environ.get("CPID_SHARD", "0"))
    return [e for i, e in enumerate(entries) if i % shards == shard]


# Run the exhaustive compute when explicitly requested (CPID_FULL_COMPUTE=1)
# or when sharded across CI jobs (CPID_SHARDS set).
_RUN_FULL = (
    os.environ.get("CPID_FULL_COMPUTE") == "1" or "CPID_SHARDS" in os.environ
)


def _dedupe_by_reform(entries: list[dict]) -> list[dict]:
    """Collapse entries that emit the same reform dict to one.

    The manifest keeps one entry per ``(state, option)`` so the cost sweep can
    score national reforms (SNAP, child allowance, federal switches) in every
    state. But a household compute is fully determined by the reform dict — an
    identical dict computes identically whatever the state tag — so the
    exhaustive per-entry compute would otherwise redo the same national reform
    ~50× and balloon per-PR CI. Dedupe by dict to keep this matrix flat;
    per-state cost variation is the cost sweep's job, not this test's.
    """
    seen: set[str] = set()
    out: list[dict] = []
    for e in entries:
        key = json.dumps(e["reform"], sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


_FULL_ENTRIES = _sharded(_dedupe_by_reform(_NONEMPTY))


@pytest.mark.skipif(
    not _RUN_FULL,
    reason="full per-entry compute is slow (~30s each); set CPID_FULL_COMPUTE=1 "
    "to run all locally, or CPID_SHARDS/CPID_SHARD to run a CI shard",
)
@pytest.mark.parametrize(
    "entry", _FULL_ENTRIES, ids=[_case_id(e) for e in _FULL_ENTRIES]
)
def test_reform_computes_all(entry: dict) -> None:
    """Exhaustive: a full compute for every non-empty reform.

    Off by default (slow); on in CI via sharding, or locally via
    ``CPID_FULL_COMPUTE=1``.
    """
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


# ---- Inert-option regression guard ---------------------------------------
# The 1.745.0 sweep surfaced state EITC options that resolved valid parameter
# paths yet moved nothing (paid $0): "create a new EITC" contrib states whose
# match slider never emitted the contrib ``in_effect`` on-switch, and VT, whose
# flat ``match`` param is overridden by an enhanced bracketed structure. A path
# check can't catch "the path exists but is inert" -- these tests do.

_EITC_REFORMS = json.loads(
    (REPO_ROOT / "frontend" / "data" / "eitc-reforms.json").read_text()
)
_CREATE_CREDIT_STATES = sorted(
    st
    for st, v in _EITC_REFORMS.items()
    if isinstance(v, dict)
    and v.get("creates_credit")
    and not v.get("in_development")
)


def _single_edited_eitc(state: str) -> dict | None:
    oid = f"{state.lower()}_eitc"
    cands = [
        e
        for e in _ENTRIES
        if e["state"] == state
        and e["ids"] == [oid]
        and e["kind"] == "single-edited"
    ]
    return cands[0] if cands else None


@pytest.mark.parametrize("state", _CREATE_CREDIT_STATES)
def test_create_credit_eitc_emits_in_effect(state: str) -> None:
    """Every ``creates_credit`` state must switch the contrib credit on.

    These states have no baseline EITC, so the contrib ``in_effect`` flag is the
    on-switch -- without it the match slider sets a rate on a credit that stays
    off and the reform pays $0. Cheap dict check (no PE-US), so it covers every
    such state and catches a forgotten ``creates_credit`` tag instantly.
    """
    entry = _single_edited_eitc(state)
    assert entry is not None, f"no single-edited {state.lower()}_eitc entry"
    in_effect = _EITC_REFORMS[state]["in_effect"]
    assert entry["reform"].get(in_effect) is True, (
        f"{state} create-state EITC does not emit {in_effect}=true, so the "
        f"credit is never switched on (inert option, pays $0)."
    )


def _low_income_eitc_household(state: str, year: int) -> dict:
    """A single parent, two young children, earnings squarely in the EITC range
    -- a refundable state EITC pays out here once it's actually switched on."""
    y = str(year)
    members = ["head", "child_a", "child_b"]
    return {
        "people": {
            "head": {"age": {y: 30}, "employment_income": {y: 18_000}},
            "child_a": {"age": {y: 3}},
            "child_b": {"age": {y: 6}},
        },
        "tax_units": {"tax_unit": {"members": members}},
        "families": {"family": {"members": members}},
        "spm_units": {"spm_unit": {"members": members}},
        "households": {
            "household": {"members": members, "state_name": {y: state}},
        },
    }


# One per active mechanism: child_poverty_impact_dashboard contrib (GA, AL)
# and VT's enhanced structure. (NC's contrib variant is gated -- see #8775.)
@pytest.mark.parametrize("state", ["GA", "AL", "VT"])
def test_state_eitc_slider_actually_moves_credit(state: str) -> None:
    """A touched state-EITC match slider must raise a low-income family's net
    income -- not silently pay $0 (the inert-option bug class)."""
    entry = _single_edited_eitc(state)
    assert entry is not None, f"no single-edited {state.lower()}_eitc entry"
    year = int(entry["year"])
    situation = _low_income_eitc_household(state, year)
    base = Simulation(situation=situation).calculate("household_net_income", year)[0]
    core = _build_core_reform_dict(entry["reform"], year)
    reform = Reform.from_dict(core, country_id="us")
    reformed = Simulation(situation=situation, reform=reform).calculate(
        "household_net_income", year
    )[0]
    assert reformed > base + 1.0, (
        f"{state} EITC slider produced no change (base={base:.2f}, "
        f"reform={reformed:.2f}) -- the option is inert."
    )
