"""Pin the household calculator's SPM poverty measurement.

The household calculator (``compute_household_sweep`` in
``scripts/modal_cpid_endpoint.py``) sends only a state. policyengine-us 2.x
sets SPM thresholds by county and raises ``SPMInputError`` for a household
without one, and the endpoint reads each output through a helper that turns
an error into 0 — so a broken SPM selection would silently report every
household as "not in poverty". These tests run the endpoint's own
``HOUSEHOLD_SPM_SELECTION`` (read from the source, so no Modal install is
needed) on state-only households and check that the flag still moves with
income and that the threshold is national: no geographic adjustment, and the
same value in a high-cost and a low-cost state.
"""

from __future__ import annotations

import ast
from functools import cache
from pathlib import Path

import pytest
from policyengine.tax_benefit_models.us.spm import resolve_spm_selection
from policyengine_us import Simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
ENDPOINT_PATH = REPO_ROOT / "scripts" / "modal_cpid_endpoint.py"
YEAR = 2026


def _endpoint_spm_selection() -> dict:
    module = ast.parse(ENDPOINT_PATH.read_text())
    for node in module.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "HOUSEHOLD_SPM_SELECTION"
            for target in node.targets
        ):
            return ast.literal_eval(node.value)
    raise AssertionError(f"HOUSEHOLD_SPM_SELECTION not found in {ENDPOINT_PATH}")


def _state_only_situation(state: str, employment_income: float) -> dict:
    """Single parent with children aged 3 and 8, geography as the endpoint's
    ``_build_household_situation`` sends it (``state_name`` only)."""
    members = ["head", "dep0", "dep1"]
    return {
        "people": {
            "head": {
                "age": {YEAR: 35},
                "employment_income": {YEAR: employment_income},
            },
            "dep0": {"age": {YEAR: 3}},
            "dep1": {"age": {YEAR: 8}},
        },
        "tax_units": {"tax_unit": {"members": members}},
        "households": {"household": {"members": members, "state_name": {YEAR: state}}},
    }


@cache
def _household_value(state: str, employment_income: float, variable: str) -> float:
    simulation = Simulation(
        situation=_state_only_situation(state, employment_income),
        spm=resolve_spm_selection(_endpoint_spm_selection()),
    )
    return float(simulation.calculate(variable, period=YEAR)[0])


@pytest.mark.parametrize("state", ["CA", "MS"])
def test_poverty_flag_moves_with_income(state: str):
    assert _household_value(state, 0.0, "in_poverty") > 0
    assert _household_value(state, 150_000.0, "in_poverty") == 0


def test_threshold_is_national():
    for state in ("CA", "MS"):
        assert _household_value(state, 0.0, "spm_unit_geographic_adjustment") == 1.0
    assert _household_value("CA", 0.0, "spm_unit_spm_threshold") == _household_value(
        "MS", 0.0, "spm_unit_spm_threshold"
    )
