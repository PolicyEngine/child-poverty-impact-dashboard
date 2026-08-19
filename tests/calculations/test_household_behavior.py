"""Prove every reform option actually MOVES a household — not just computes.

``test_reform_computes.py`` proves each option's reform dict builds and a
simulation runs. It cannot catch the inert-option bug class: a parameter path
that exists and computes but never changes anyone's outcome (the 1.745.0
create-state-EITC bug, VT's overridden flat match). This suite closes that gap
systematically.

The frontend registry emits ``kind: "behavior"`` manifest entries — a
strictly-more-generous edit for every configurable option (each numeric param
bumped up one step; phase-out speeds and toggles held — see
``generosityParamValues`` in ``frontend/lib/reform-coverage.ts``). A
more-generous reform must strictly raise net income for at least one
representative household in that option's category, or the option is inert.
Federal switches (no numeric params) are covered via their ``single`` entries:
turning the switch on must raise a low-income family's net income.

Category → test households (single parent, kids 3 and 8, varying earnings):

* ``*_eitc``           $18k (refundable range) and $35k (state tax binds while
                       federal EITC is still positive — the only window where a
                       NONREFUNDABLE match can show)
* ``*_ctc``            $18k (refundable) and $80k (nonrefundable needs binding
                       tax); MD adds $10k (hard $15k AGI cap)
* ``*_dependent_exemption``  $80k and $120k (exemptions/credits against tax
                       need binding tax; CA's zero-tax threshold is high)
* ``snap_reform``      $15k and $30k (earned-income-deduction bump raises SNAP)
* ``child_allowance``  $18k (universal payment)
* ``id_grocery_credit`` $18k and $40k
* federal switches     $18k and $35k

Like the exhaustive compute, the full matrix is slow (~30s per reformed
system), so it runs sharded in CI (``CPID_SHARDS``/``CPID_SHARD``) or fully
via ``CPID_FULL_COMPUTE=1``; a one-per-category representative subset always
runs.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import pytest
from policyengine_core.reforms import Reform
from policyengine_us import Simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "frontend" / "__generated__" / "reform-manifest.json"

FEDERAL_SWITCH_IDS = [
    "federal_ctc_expanded",
    "federal_afa",
    "federal_tax_cuts_for_workers",
    "federal_working_parents_tax_relief",
]

# One always-on entry per category; everything else is gated like the
# exhaustive compute (sharded CI / CPID_FULL_COMPUTE=1).
REPRESENTATIVE_IDS = [
    "nj_ctc",
    "ca_eitc",
    "ri_dependent_exemption",
    "snap_reform",
    "child_allowance",
    "id_grocery_credit",
    "federal_ctc_expanded",
]


def _category(option_id: str) -> str:
    if option_id.endswith("_eitc"):
        return "eitc"
    if option_id.endswith("_ctc") and not option_id.startswith("federal"):
        return "ctc"
    if option_id.endswith("_dependent_exemption"):
        return "depex"
    if option_id == "snap_reform":
        return "snap"
    if option_id == "child_allowance":
        return "allowance"
    if option_id == "id_grocery_credit":
        return "grocery"
    return "federal"


_CATEGORY_INCOMES: dict[str, tuple[int, ...]] = {
    "eitc": (18_000, 35_000),
    "ctc": (18_000, 80_000),
    "depex": (80_000, 120_000),
    "snap": (15_000, 30_000),
    "allowance": (18_000,),
    "grocery": (18_000, 40_000),
    "federal": (18_000, 35_000),
}

# Per-(state, category) extra incomes for known tight eligibility windows.
_STATE_EXTRA_INCOMES: dict[tuple[str, str], tuple[int, ...]] = {
    ("MD", "ctc"): (10_000,),  # hard $15k AGI cap
}


def _incomes(entry: dict) -> tuple[int, ...]:
    cat = _category(entry["ids"][0])
    return (
        _STATE_EXTRA_INCOMES.get((entry["state"], cat), ())
        + _CATEGORY_INCOMES[cat]
    )


def _situation(state: str, income: int, year: int) -> dict:
    y = str(year)
    members = ["head", "child_a", "child_b"]
    return {
        "people": {
            "head": {"age": {y: 35}, "employment_income": {y: income}},
            "child_a": {"age": {y: 3}},
            "child_b": {"age": {y: 8}},
        },
        "tax_units": {"tax_unit": {"members": members}},
        "families": {"family": {"members": members}},
        "spm_units": {"spm_unit": {"members": members}},
        "households": {
            "household": {"members": members, "state_name": {y: state}},
        },
    }


def _build_core_reform_dict(reform: dict, year: int) -> dict:
    default_date = f"{year}-01-01"
    out: dict = {}
    for path, spec in reform.items():
        out[path] = dict(spec) if isinstance(spec, dict) else {default_date: spec}
    return out


def _load_entries() -> list[dict]:
    if not MANIFEST_PATH.exists():
        pytest.skip(
            f"reform manifest not found at {MANIFEST_PATH} — run "
            "`cd frontend && npm run manifest` first.",
            allow_module_level=True,
        )
    entries = json.loads(MANIFEST_PATH.read_text())["entries"]

    picked: list[dict] = []
    seen: set[str] = set()
    for e in entries:
        is_behavior = e["kind"] == "behavior"
        is_federal_switch = (
            e["kind"] == "single"
            and e["ids"][0] in FEDERAL_SWITCH_IDS
            and e["reform"]
        )
        if not (is_behavior or is_federal_switch):
            continue
        # National reforms repeat identically per state — one compute suffices.
        key = json.dumps([e["ids"], e["reform"]], sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        picked.append(e)
    return picked


_ENTRIES = _load_entries()


def _case_id(entry: dict) -> str:
    return f"{entry['state']}:{'+'.join(entry['ids'])}"


@lru_cache(maxsize=None)
def _baseline_net(state: str, income: int, year: int) -> float:
    sim = Simulation(situation=_situation(state, income, year))
    return float(sim.calculate("household_net_income", year)[0])


def _assert_raises_net_income(entry: dict) -> None:
    year = int(entry["year"])
    core = _build_core_reform_dict(entry["reform"], year)
    reform = Reform.from_dict(core, country_id="us")
    deltas = {}
    for income in _incomes(entry):
        base = _baseline_net(entry["state"], income, year)
        reformed = float(
            Simulation(
                situation=_situation(entry["state"], income, year),
                reform=reform,
            ).calculate("household_net_income", year)[0]
        )
        deltas[income] = reformed - base
        if reformed > base + 1.0:
            return  # moved — not inert
    pytest.fail(
        f"{_case_id(entry)}: a strictly-more-generous edit moved net income at "
        f"NO test income ({ {k: round(v, 2) for k, v in deltas.items()} }). "
        "Either the option is inert (path exists but nothing flows to the "
        "household) or the category's test incomes miss its eligibility "
        "window — fix the wiring or extend _STATE_EXTRA_INCOMES with a "
        "justified income."
    )


_REPRESENTATIVE = [
    e for e in _ENTRIES if e["ids"][0] in REPRESENTATIVE_IDS
]
# Keep one per option id (behavior + single can both match a federal id).
_seen_rep: set[str] = set()
_REPRESENTATIVE = [
    e
    for e in _REPRESENTATIVE
    if not (e["ids"][0] in _seen_rep or _seen_rep.add(e["ids"][0]))
]


@pytest.mark.parametrize(
    "entry", _REPRESENTATIVE, ids=[_case_id(e) for e in _REPRESENTATIVE]
)
def test_representative_option_moves_household(entry: dict) -> None:
    """One option per category must visibly raise a household's net income."""
    _assert_raises_net_income(entry)


def _sharded(entries: list[dict]) -> list[dict]:
    n = os.environ.get("CPID_SHARDS")
    if not n:
        return entries
    shards = int(n)
    shard = int(os.environ.get("CPID_SHARD", "0"))
    return [e for i, e in enumerate(entries) if i % shards == shard]


_RUN_FULL = (
    os.environ.get("CPID_FULL_COMPUTE") == "1" or "CPID_SHARDS" in os.environ
)
_FULL = _sharded([e for e in _ENTRIES if e not in _REPRESENTATIVE])


@pytest.mark.skipif(
    not _RUN_FULL,
    reason="full behavioral matrix is slow (~30s per reformed system); set "
    "CPID_FULL_COMPUTE=1 or CPID_SHARDS/CPID_SHARD (CI) to run it",
)
@pytest.mark.parametrize("entry", _FULL, ids=[_case_id(e) for e in _FULL])
def test_option_moves_household(entry: dict) -> None:
    """Exhaustive: every configurable option's generosity bump must land."""
    _assert_raises_net_income(entry)
