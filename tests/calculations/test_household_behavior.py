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
    if option_id == "co_fac":
        return "ctc"
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
    # MO's nonrefundable match only binds where BOTH the federal EITC and MO
    # liability are positive — a narrow window around $45k for this family.
    ("MO", "eitc"): (45_000,),
}

# Options whose operative lever is a TOGGLE the generosity bump holds by
# design: their baseline nonrefundable credit already exhausts state
# liability wherever the federal EITC is positive, so no numeric bump can
# move a household. They're exercised by
# ``test_refundability_toggle_pays_out`` (single-edited entries flip the
# make_refundable toggle) instead of the generosity matrix.
_TOGGLE_ACTIVATED: dict[tuple[str, str], str] = {
    ("OH", "oh_eitc"): "30% nonrefundable match saturates OH liability",
    ("SC", "sc_eitc"): "125% nonrefundable match saturates SC liability",
    ("UT", "ut_eitc"): "20% nonrefundable match saturates UT liability",
    ("UT", "ut_ctc"): "nonrefundable CTC saturates UT liability in-window",
}

# Options that CANNOT move a household in the coverage year, by law.
# (RI's CTC used to live here; its editor is now year-gated to 2027+, so it
# no longer appears in the 2026 manifest at all.)
_STRUCTURALLY_UNAVAILABLE: dict[tuple[str, str], str] = {}

# Options whose beneficiaries the default family can't represent.
# federal_tax_cuts_for_workers expands the CHILDLESS EITC — a family with
# two kids sees nothing, a childless adult in the credit's narrow income
# range sees hundreds of dollars.
_CHILDLESS_OPTIONS: dict[str, tuple[int, ...]] = {
    "federal_tax_cuts_for_workers": (12_000, 16_000),
}


def _incomes(entry: dict) -> tuple[int, ...]:
    cat = _category(entry["ids"][0])
    return (
        _STATE_EXTRA_INCOMES.get((entry["state"], cat), ())
        + _CATEGORY_INCOMES[cat]
    )


def _situation(
    state: str, income: int, year: int, childless: bool = False
) -> dict:
    y = str(year)
    people = {"head": {"age": {y: 35}, "employment_income": {y: income}}}
    members = ["head"]
    if not childless:
        people["child_a"] = {"age": {y: 3}}
        people["child_b"] = {"age": {y: 8}}
        members += ["child_a", "child_b"]
    return {
        "people": people,
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
        skip_key = (e["state"], e["ids"][0])
        if skip_key in _TOGGLE_ACTIVATED or skip_key in _STRUCTURALLY_UNAVAILABLE:
            continue
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
def _baseline_net(
    state: str, income: int, year: int, childless: bool = False
) -> float:
    sim = Simulation(situation=_situation(state, income, year, childless))
    return float(sim.calculate("household_net_income", year)[0])


def _assert_raises_net_income(entry: dict) -> None:
    year = int(entry["year"])
    core = _build_core_reform_dict(entry["reform"], year)
    reform = Reform.from_dict(core, country_id="us")
    childless_incomes = _CHILDLESS_OPTIONS.get(entry["ids"][0])
    childless = childless_incomes is not None
    incomes = childless_incomes or _incomes(entry)
    deltas = {}
    for income in incomes:
        base = _baseline_net(entry["state"], income, year, childless)
        reformed = float(
            Simulation(
                situation=_situation(entry["state"], income, year, childless),
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


def _single_edited_entry(state: str, option_id: str) -> dict | None:
    entries = json.loads(MANIFEST_PATH.read_text())["entries"]
    return next(
        (
            e
            for e in entries
            if e["state"] == state
            and e["ids"] == [option_id]
            and e["kind"] == "single-edited"
        ),
        None,
    )


@pytest.mark.parametrize(
    "state,option_id",
    sorted(_TOGGLE_ACTIVATED),
    ids=[f"{s}:{o}" for s, o in sorted(_TOGGLE_ACTIVATED)],
)
def test_refundability_toggle_pays_out(state: str, option_id: str) -> None:
    """Toggle-activated options (nonrefundable credits whose baseline already
    exhausts liability) must pay out once the make_refundable toggle flips —
    the single-edited manifest entry flips every toggle, so it exercises the
    option the way a user actually would. Verified deltas at $18k (2026):
    OH +$2,232, SC +$9,072 (cap also eliminated), UT EITC +$1,512,
    UT CTC +$850."""
    entry = _single_edited_entry(state, option_id)
    assert entry is not None, f"no single-edited {option_id} entry"
    year = int(entry["year"])
    core = _build_core_reform_dict(entry["reform"], year)
    reform = Reform.from_dict(core, country_id="us")
    income = 18_000
    base = _baseline_net(state, income, year)
    reformed = float(
        Simulation(
            situation=_situation(state, income, year), reform=reform
        ).calculate("household_net_income", year)[0]
    )
    assert reformed > base + 1.0, (
        f"{state}:{option_id} with make_refundable flipped paid nothing at "
        f"${income:,} (base={base:.2f}, reform={reformed:.2f}) — "
        f"the refundability lever is inert. "
        f"(Generosity-matrix skip reason: {_TOGGLE_ACTIVATED[(state, option_id)]})"
    )
