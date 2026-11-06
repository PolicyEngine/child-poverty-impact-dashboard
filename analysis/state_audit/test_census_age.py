"""Invariants for the Census age audit (microcosm#1528).

Run locally (CI does not collect analysis/)::

    uvx --with numpy --with hypothesis --with 'modal==1.6.3' \\
        pytest analysis/state_audit/test_census_age.py -q
"""

from __future__ import annotations

import csv
import os

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from build_csvs import CENSUS_YEARS, pop_target_year
from census_age_fit import CENSUS
from census_age_reweight_modal import AGE_GROUPS, _balance


@st.composite
def feasible_problems(draw):
    """Household counts X (every column used), starting weights w0, and
    targets that some positive weights reach exactly."""

    n = draw(st.integers(10, 120))
    k = draw(st.integers(1, 6))
    seed = draw(st.integers(0, 2**32 - 1))
    rng = np.random.default_rng(seed)
    X = rng.integers(0, 4, size=(n, k)).astype(float)
    X[rng.integers(0, n, size=k), np.arange(k)] += 1  # no empty column
    w0 = rng.uniform(0.5, 50, size=n)
    w_true = w0 * np.exp(rng.normal(0, draw(st.floats(0, 0.6)), size=n))
    return X, X.T @ w_true, w0


@settings(max_examples=150, deadline=None)
@given(feasible_problems())
def test_balance_meets_feasible_targets_with_positive_weights(problem):
    X, targets, w0 = problem
    w, _, max_rel = _balance(X, targets, w0)
    assert max_rel < 1e-8
    np.testing.assert_allclose(X.T @ w, targets, rtol=1e-8)
    assert (w > 0).all()


@settings(max_examples=100, deadline=None)
@given(feasible_problems())
def test_balance_keeps_weights_that_already_meet_targets(problem):
    X, _, w0 = problem
    w, iterations, _ = _balance(X, X.T @ w0, w0)
    np.testing.assert_allclose(w, w0, rtol=1e-10)
    assert iterations == 1


@settings(max_examples=100, deadline=None)
@given(feasible_problems(), st.floats(0.01, 100))
def test_balance_scales_with_targets_and_weights(problem, c):
    X, targets, w0 = problem
    w, _, _ = _balance(X, targets, w0)
    w_scaled, _, _ = _balance(X, c * targets, c * w0)
    np.testing.assert_allclose(w_scaled, c * w, rtol=1e-6)


@given(st.sampled_from(CENSUS_YEARS))
def test_target_year_follows_a_covered_audit_year(year):
    assert pop_target_year({"AL": {"year": year}, "AK": {"year": year}}) == year


@given(st.integers(2026, 2035) | st.integers(2000, 2023))
def test_target_year_falls_back_to_the_latest_census_year(year):
    assert pop_target_year({"AL": {"year": year}}) == max(CENSUS_YEARS)


def test_target_year_refuses_an_uncovered_request():
    with pytest.raises(SystemExit):
        pop_target_year({"AL": {"year": 2024}}, requested=2023)


def test_census_age_groups_tile_each_state_total():
    with open(CENSUS, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert sorted({r["year"] for r in rows}) == [str(y) for y in CENSUS_YEARS]
    for year in CENSUS_YEARS:
        assert len([r for r in rows if r["year"] == str(year)]) == 51
    lows = [lo for _, lo, _ in AGE_GROUPS]
    highs = [hi for _, _, hi in AGE_GROUPS]
    assert lows[0] == 0 and lows[1:] == highs[:-1]
    for r in rows:
        value = {k: int(float(v)) for k, v in r.items() if k not in ("state", "state_fips", "year")}
        assert sum(value[name] for name, _, _ in AGE_GROUPS) == value["total"]
        assert sum(value[f"age_{a}"] for a in range(18)) == value["under_18"]
        assert value["ages_6_11"] == sum(value[f"age_{a}"] for a in range(6, 12))
        assert value["ages_12_17"] == sum(value[f"age_{a}"] for a in range(12, 18))
        for cut in (1, 4, 5, 6):
            assert value[f"under_{cut}"] == sum(value[f"age_{a}"] for a in range(cut))
        assert value["adults"] == value["total"] - value["under_18"]


def test_census_file_is_in_this_directory():
    assert os.path.dirname(CENSUS) == os.path.join(os.path.dirname(os.path.abspath(__file__)), "targets")
