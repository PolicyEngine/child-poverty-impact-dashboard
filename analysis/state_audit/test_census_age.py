"""Invariants for the Census age audit (microcosm#1528).

Run locally (CI does not collect analysis/)::

    uvx --with numpy --with hypothesis --with 'modal==1.6.3' \\
        pytest analysis/state_audit/test_census_age.py -q
"""

from __future__ import annotations

import csv
import json
import os

import census_age_reweight_summary
import numpy as np
import pytest
import weight_concentration_summary
from build_csvs import CENSUS_YEARS, pop_target_year
from census_age_fit import CENSUS, state_coverage_problems
from census_age_reweight_modal import (
    AGE_GROUPS,
    ASEC_SPINE,
    _balance,
    _kish,
    _lift_stats,
    _weight_stats,
)
from hypothesis import given, settings
from hypothesis import strategies as st
from weight_concentration_summary import (
    FLOAT32_COST_TOL,
    FLOAT32_TOL,
    check_against_audit,
    check_against_projection,
)


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


weights = st.lists(st.floats(0.0, 1e5, allow_nan=False), min_size=1, max_size=300)


@given(weights, st.floats(0.01, 100))
def test_kish_lies_between_one_and_the_positive_count_and_ignores_scale(w, c):
    w = np.asarray(w)
    positive = int((w > 0).sum())
    ess = _kish(w)
    if positive == 0:
        assert ess == 0.0
        return
    assert 1 - 1e-9 <= ess <= positive + 1e-9
    assert np.isclose(_kish(c * w), ess, rtol=1e-9)


@given(st.integers(1, 300), st.floats(0.01, 1e4))
def test_kish_of_equal_weights_counts_the_households(n, value):
    assert np.isclose(_kish(np.full(n, value)), n, rtol=1e-12)


@st.composite
def weighted_households(draw):
    n = draw(st.integers(1, 400))
    seed = draw(st.integers(0, 2**32 - 1))
    rng = np.random.default_rng(seed)
    w = rng.lognormal(2, draw(st.floats(0.1, 3)), size=n)
    kids = rng.integers(0, 4, size=n)
    spine = np.where(rng.random(n) < draw(st.floats(0, 1)), ASEC_SPINE, "acs_2024_1yr")
    return w, kids, spine


@settings(max_examples=150, deadline=None)
@given(weighted_households())
def test_weight_stats_shares_and_bounds(problem):
    w, kids, spine = problem
    out = _weight_stats(w, spine, kids)
    n = len(w)
    k = max(1, n // 100)
    assert k / n - 1e-12 <= out["top1pct_share"] <= 1 + 1e-12
    assert np.isclose(out["top1pct_share"], np.sort(w)[::-1][:k].sum() / w.sum(), rtol=1e-12)
    assert out["max_weight"] == w.max()
    assert 1 - 1e-9 <= out["kish_ess"] <= n + 1e-9
    assert np.isclose(out["kish_ess"], w.sum() ** 2 / (w ** 2).sum(), rtol=1e-9)
    child_w = w * kids
    if child_w.sum() > 0:
        assert np.isclose(out["child_kish_ess"], child_w.sum() ** 2 / (child_w ** 2).sum(), rtol=1e-9)
    asec = spine == ASEC_SPINE
    assert out["asec_households"] == int(asec.sum())
    assert np.isclose(out["asec_weight_share"], w[asec].sum() / w.sum())
    assert 0 <= out["asec_weight_share"] <= 1
    assert _weight_stats(w, None, kids).keys() < out.keys()


@settings(max_examples=150, deadline=None)
@given(weighted_households(), st.floats(-0.5, 0.5))
def test_lift_stats_shares_and_counts(problem, entry_share):
    w, kids, spine = problem
    rng = np.random.default_rng(len(w))
    lifted = kids * (rng.random(len(w)) < 0.2) - (rng.random(len(w)) < max(entry_share, 0) * 0.1)
    contrib = w * lifted
    out = _lift_stats(contrib, spine)
    assert np.isclose(out["children_lifted_net"], contrib.sum())
    assert out["households_with_net_lift"] == int((contrib > 0).sum())
    assert out["households_with_net_entry"] == int((contrib < 0).sum())
    if out["top1_share"] is None:
        assert out["households_with_net_lift"] == 0 or contrib.sum() <= 0
        return
    positive = contrib[contrib > 0]
    assert np.isclose(out["top1_share"], positive.max() / contrib.sum())
    assert out["top5_share"] >= out["top1_share"]
    assert out["top_household_spine"] == spine[int(np.argmax(contrib))]
    asec = spine == ASEC_SPINE
    assert np.isclose(out["asec_share"], contrib[asec].sum() / contrib.sum())


def test_lift_stats_with_one_lifting_household_gives_it_everything():
    out = _lift_stats(np.array([0.0, 500.0, 0.0]), np.array(["acs_2024_1yr", ASEC_SPINE, "acs_2024_1yr"]))
    assert out["top1_share"] == 1.0 and out["asec_share"] == 1.0
    assert out["households_with_net_lift"] == 1 and out["lifters_kish_ess"] == 1.0


def _concentration_row(kish=300.0, kish_after=290.0, under4=1000.0, poverty=12.0, cost=7e8):
    lift = {"children_under_4": under4, "child_poverty_baseline": poverty, "cost": cost}
    return {
        "state": "IN",
        "slice_tag": "592ae5d6",
        "versions": {"policyengine-us": "1.825.2"},
        "weights_2024": {
            "production": {"kish_ess": kish, "n_households": 33},
            "reweighted": {"kish_ess": kish_after},
        },
        "universal_under4_2000": {"year": 2026, "production": lift, "reweighted": lift},
    }


def _projection_row(**overrides):
    row = {
        "status": "ok",
        "versions": {"policyengine-us": "1.825.2"},
        "balance": {"kish_ess_before": 300.0, "kish_ess_after": 290.0, "n_households": 33},
        "years": {"2026": {run: {"children_under_4": 1000.0, "child_poverty": 12.0} for run in ("production", "reweighted")}},
        "universal_under4_2000": {run: {"cost": 7e8} for run in ("production", "reweighted")},
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize(
    "row",
    [
        _concentration_row(),
        _concentration_row(kish=300.0 * (1 + FLOAT32_TOL / 2)),
        _concentration_row(cost=7e8 * (1 + FLOAT32_COST_TOL / 2)),
    ],
)
def test_the_projection_check_allows_float32_rounding(row):
    assert check_against_projection([row], {"IN": _projection_row()}) == []


@pytest.mark.parametrize(
    ("row", "named"),
    [
        (_concentration_row(kish=300.0 * (1 + 2 * FLOAT32_TOL)), "Kish"),
        (_concentration_row(kish_after=290.0 * (1 + 1e-6)), "Kish"),
        (_concentration_row(under4=1000.5), "children_under_4"),
        (_concentration_row(poverty=12.0 + 1e-6), "child_poverty"),
        (_concentration_row(cost=7e8 * (1 + 2 * FLOAT32_COST_TOL)), "cost"),
    ],
)
def test_the_projection_check_names_each_difference(row, named):
    issues = check_against_projection([row], {"IN": _projection_row()})
    assert issues and all(named in issue for issue in issues)


def test_the_projection_check_needs_a_projection_row():
    assert check_against_projection([_concentration_row()], {}) == ["IN: no projection row"]


def _audit_row(**overrides):
    row = {
        "status": "ok",
        "year": 2026,
        "slice_tag": "592ae5d6",
        "pe_us": "1.825.2",
        "n_households": 33,
        "poverty_child": 12.0,
    }
    row.update(overrides)
    return row


@pytest.mark.parametrize("poverty", [12.0, 12.0 * (1 + FLOAT32_TOL / 2)])
def test_the_audit_check_passes_a_matching_sweep(poverty):
    assert check_against_audit([_concentration_row()], {"IN": _audit_row(poverty_child=poverty)}) == []


@pytest.mark.parametrize(
    "overrides",
    [
        {"year": 2024},
        {"slice_tag": "766b7c7"},
        {"pe_us": "2.2.1"},
        {"n_households": 34},
        {"poverty_child": 12.001},
        {"status": "error"},
    ],
)
def test_the_audit_check_flags_a_different_sweep(overrides):
    assert check_against_audit([_concentration_row()], {"IN": _audit_row(**overrides)})


@given(st.sampled_from(CENSUS_YEARS))
def test_target_year_follows_a_covered_audit_year(year):
    assert pop_target_year({"AL": {"year": year}, "AK": {"year": year}}) == year


@given(st.integers(2026, 2035) | st.integers(2000, 2023))
def test_target_year_falls_back_to_the_latest_census_year(year):
    assert pop_target_year({"AL": {"year": year}}) == max(CENSUS_YEARS)


def test_target_year_refuses_an_uncovered_request():
    with pytest.raises(SystemExit):
        pop_target_year({"AL": {"year": 2024}}, requested=2023)


def _census_states() -> list[str]:
    with open(CENSUS, newline="", encoding="utf-8") as f:
        return sorted({r["state"] for r in csv.DictReader(f)})


@given(st.lists(st.sampled_from([*_census_states(), "PR"]), max_size=60) | st.permutations(_census_states()))
def test_state_coverage_passes_each_census_state_once_and_nothing_else(states):
    assert (state_coverage_problems(states) == []) == (sorted(states) == _census_states())


@pytest.mark.parametrize(
    ("change", "named"),
    [
        (lambda s: [x for x in s if x != "DC"], ["DC"]),
        (lambda s: [*s, "IN"], ["IN"]),
        (lambda s: [*(x for x in s if x != "DC"), "IN"], ["DC", "IN"]),
        (lambda s: [*s, "PR"], ["PR"]),
    ],
)
def test_state_coverage_names_each_state_a_run_gets_wrong(change, named):
    assert state_coverage_problems(change(_census_states())) == named


def _summary_row(state: str) -> dict:
    return {"state": state, "status": "ok", "balance": {"converged": True}, "spine_available": True}


@pytest.mark.parametrize(
    ("module", "loader", "filename"),
    [
        (census_age_reweight_summary, "load_rows", "census_age_reweight_run.json"),
        (weight_concentration_summary, "load", "weight_concentration_run.json"),
    ],
)
def test_the_summaries_read_each_state_once(module, loader, filename, tmp_path, monkeypatch):
    monkeypatch.setattr(module, "OUT", str(tmp_path))
    path = tmp_path / filename

    # Fifty-one rows that repeat Indiana and leave out DC.
    states = [s for s in _census_states() if s != "DC"]
    path.write_text(json.dumps([_summary_row(s) for s in [*states, "IN"]]), encoding="utf-8")
    with pytest.raises(SystemExit, match=r"\['DC', 'IN'\]"):
        getattr(module, loader)("run")

    path.write_text(json.dumps([_summary_row(s) for s in _census_states()]), encoding="utf-8")
    assert len(getattr(module, loader)("run")) == 51


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
