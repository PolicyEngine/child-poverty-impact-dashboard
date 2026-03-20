"""
Modal application for running PolicyEngine microsimulations.

This module defines Modal functions for both population-level (Microsimulation)
and household-level (Simulation) calculations.
"""

import modal

app = modal.App("child-poverty-dashboard")

# Define the image with PolicyEngine dependencies and local package
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "policyengine-us>=1.0.0",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "microdf-python>=0.3.0",
    )
    .add_local_python_source("cpid_calc")
)


@app.function(image=image, timeout=600, memory=4096)
def run_population_analysis(
    reform_config_dict: dict,
    states: list,
    year: int,
) -> dict:
    """
    Run full population analysis on Modal.

    This runs microsimulation ONCE and calculates all metrics (poverty, fiscal,
    distributional) from the cached simulation objects.

    Args:
        reform_config_dict: Serialized ReformConfig
        states: List of state codes to filter (empty = all states)
        year: Year for calculations

    Returns:
        Dictionary with poverty, fiscal, and distributional results
    """
    import numpy as np
    from policyengine_us import Microsimulation

    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.reforms.builder import create_reform
    from cpid_calc.calculations.microsim import (
        get_state_filter,
        get_child_filter,
        get_young_child_filter,
        get_person_weight,
        get_household_weight,
        calculate_weighted_sum,
        calculate_weighted_mean,
    )
    from cpid_calc.calculations.impact import PovertyImpact
    from cpid_calc.calculations.fiscal import FiscalCost
    from cpid_calc.calculations.distributional import (
        DistributionalImpact,
        DecileImpact,
        calculate_gini,
        get_income_decile,
    )

    # Reconstruct config from dict
    config = ReformConfig.from_dict(reform_config_dict)

    # Create the reform
    reform = create_reform(config)

    # Run microsimulation ONCE
    dataset = "enhanced_cps_2024"
    baseline = Microsimulation(dataset=dataset)
    reform_sim = Microsimulation(reform=reform, dataset=dataset)

    # ===== POVERTY IMPACT CALCULATION =====
    state_filter = get_state_filter(baseline, states or [])
    child_filter = get_child_filter(baseline)
    young_child_filter = get_young_child_filter(baseline)

    children = state_filter & child_filter
    young_children = state_filter & young_child_filter

    person_weights = get_person_weight(baseline, year)

    baseline_in_poverty = baseline.calculate("in_poverty", period=year)
    reform_in_poverty = reform_sim.calculate("in_poverty", period=year)
    baseline_in_deep_poverty = baseline.calculate("in_deep_poverty", period=year)
    reform_in_deep_poverty = reform_sim.calculate("in_deep_poverty", period=year)

    baseline_child_poverty_rate = calculate_weighted_mean(
        baseline_in_poverty, person_weights, children
    )
    reform_child_poverty_rate = calculate_weighted_mean(
        reform_in_poverty, person_weights, children
    )

    baseline_young_child_poverty_rate = calculate_weighted_mean(
        baseline_in_poverty, person_weights, young_children
    )
    reform_young_child_poverty_rate = calculate_weighted_mean(
        reform_in_poverty, person_weights, young_children
    )

    baseline_deep_child_poverty_rate = calculate_weighted_mean(
        baseline_in_deep_poverty, person_weights, children
    )
    reform_deep_child_poverty_rate = calculate_weighted_mean(
        reform_in_deep_poverty, person_weights, children
    )

    lifted_out = baseline_in_poverty & ~reform_in_poverty
    children_lifted = int(np.sum(lifted_out[children] * person_weights[children]))
    young_children_lifted = int(np.sum(lifted_out[young_children] * person_weights[young_children]))

    child_poverty_change = reform_child_poverty_rate - baseline_child_poverty_rate
    child_poverty_pct_change = (
        child_poverty_change / baseline_child_poverty_rate
        if baseline_child_poverty_rate > 0 else 0
    )

    young_child_poverty_change = reform_young_child_poverty_rate - baseline_young_child_poverty_rate
    young_child_poverty_pct_change = (
        young_child_poverty_change / baseline_young_child_poverty_rate
        if baseline_young_child_poverty_rate > 0 else 0
    )

    deep_poverty_change = reform_deep_child_poverty_rate - baseline_deep_child_poverty_rate

    poverty_impact = PovertyImpact(
        baseline_child_poverty_rate=baseline_child_poverty_rate,
        reform_child_poverty_rate=reform_child_poverty_rate,
        child_poverty_change=child_poverty_change,
        child_poverty_percent_change=child_poverty_pct_change,
        baseline_young_child_poverty_rate=baseline_young_child_poverty_rate,
        reform_young_child_poverty_rate=reform_young_child_poverty_rate,
        young_child_poverty_change=young_child_poverty_change,
        young_child_poverty_percent_change=young_child_poverty_pct_change,
        children_lifted_out_of_poverty=children_lifted,
        young_children_lifted_out_of_poverty=young_children_lifted,
        baseline_deep_child_poverty_rate=baseline_deep_child_poverty_rate,
        reform_deep_child_poverty_rate=reform_deep_child_poverty_rate,
        deep_poverty_change=deep_poverty_change,
        state=states[0] if states and len(states) == 1 else None,
    )

    # ===== FISCAL COST CALCULATION =====
    hh_weights = get_household_weight(baseline, year)

    baseline_income_tax = baseline.calculate("income_tax", period=year)
    reform_income_tax = reform_sim.calculate("income_tax", period=year)

    baseline_ctc = baseline.calculate("ctc", period=year)
    reform_ctc = reform_sim.calculate("ctc", period=year)

    baseline_eitc = baseline.calculate("eitc", period=year)
    reform_eitc = reform_sim.calculate("eitc", period=year)

    baseline_snap = baseline.calculate("snap", period=year)
    reform_snap = reform_sim.calculate("snap", period=year)

    ctc_cost = calculate_weighted_sum(reform_ctc - baseline_ctc, hh_weights)
    eitc_cost = calculate_weighted_sum(reform_eitc - baseline_eitc, hh_weights)
    snap_cost = calculate_weighted_sum(reform_snap - baseline_snap, hh_weights)
    income_tax_change = calculate_weighted_sum(
        reform_income_tax - baseline_income_tax, hh_weights
    )

    ubi_cost = 0.0
    dependent_exemption_cost = 0.0
    state_ctc_cost = 0.0

    if config.ubi.enabled:
        try:
            baseline_ubi = baseline.calculate("ubi", period=year)
            reform_ubi = reform_sim.calculate("ubi", period=year)
            ubi_cost = calculate_weighted_sum(reform_ubi - baseline_ubi, hh_weights)
        except Exception:
            child_count = baseline.calculate("ctc_qualifying_children", period=year)
            ubi_cost = calculate_weighted_sum(
                child_count * config.ubi.amount_per_child, hh_weights
            )

    if config.state_ctc.enabled:
        try:
            baseline_state_ctc = baseline.calculate(
                f"{config.state_ctc.state.lower()}_ctc", period=year
            )
            reform_state_ctc = reform_sim.calculate(
                f"{config.state_ctc.state.lower()}_ctc", period=year
            )
            state_ctc_cost = calculate_weighted_sum(
                reform_state_ctc - baseline_state_ctc, hh_weights
            )
        except Exception:
            pass

    federal_cost = ctc_cost + eitc_cost + snap_cost + ubi_cost - income_tax_change
    state_cost = state_ctc_cost + dependent_exemption_cost
    total_cost = federal_cost + state_cost

    total_children = calculate_weighted_sum(
        baseline.calculate("ctc_qualifying_children", period=year),
        hh_weights
    )

    cost_per_child = total_cost / total_children if total_children > 0 else 0
    cost_per_lifted = (
        total_cost / children_lifted
        if children_lifted > 0 else float("inf")
    )

    fiscal_cost = FiscalCost(
        total_cost=total_cost,
        federal_cost=federal_cost,
        state_cost=state_cost,
        ctc_cost=ctc_cost,
        eitc_cost=eitc_cost,
        dependent_exemption_cost=dependent_exemption_cost,
        ubi_cost=ubi_cost,
        snap_cost=snap_cost,
        state_ctc_cost=state_ctc_cost,
        income_tax_change=income_tax_change,
        payroll_tax_change=0,
        cost_per_child=cost_per_child,
        cost_per_child_lifted_from_poverty=cost_per_lifted,
        state=states[0] if states and len(states) == 1 else None,
    )

    # ===== DISTRIBUTIONAL IMPACT CALCULATION =====
    baseline_income = baseline.calculate("household_net_income", period=year)
    reform_income = reform_sim.calculate("household_net_income", period=year)
    income_change = reform_income - baseline_income

    deciles = get_income_decile(baseline, year)

    total_benefit = calculate_weighted_sum(income_change, hh_weights)
    decile_impacts = []

    for d in range(1, 11):
        decile_mask = deciles == d
        decile_weights = hh_weights[decile_mask]
        decile_changes = income_change[decile_mask]

        avg_gain = calculate_weighted_mean(decile_changes, decile_weights)
        pct_gaining = float(np.sum((decile_changes > 0.01) * decile_weights) / np.sum(decile_weights))
        pct_losing = float(np.sum((decile_changes < -0.01) * decile_weights) / np.sum(decile_weights))
        decile_total = calculate_weighted_sum(decile_changes, decile_weights)
        share = decile_total / total_benefit if total_benefit != 0 else 0

        decile_impacts.append(DecileImpact(
            decile=d,
            average_gain=avg_gain,
            percent_gaining=pct_gaining,
            percent_losing=pct_losing,
            total_benefit=decile_total,
            share_of_total_benefit=share,
        ))

    avg_gain_all = calculate_weighted_mean(income_change, hh_weights)

    bottom_50_mask = deciles <= 5
    avg_gain_bottom_50 = calculate_weighted_mean(
        income_change[bottom_50_mask], hh_weights[bottom_50_mask]
    )

    top_10_mask = deciles == 10
    avg_gain_top_10 = calculate_weighted_mean(
        income_change[top_10_mask], hh_weights[top_10_mask]
    )

    bottom_20_benefit = sum(d.total_benefit for d in decile_impacts[:2])
    bottom_50_benefit = sum(d.total_benefit for d in decile_impacts[:5])
    top_20_benefit = sum(d.total_benefit for d in decile_impacts[8:])
    top_10_benefit = decile_impacts[9].total_benefit

    share_bottom_20 = bottom_20_benefit / total_benefit if total_benefit != 0 else 0
    share_bottom_50 = bottom_50_benefit / total_benefit if total_benefit != 0 else 0
    share_top_20 = top_20_benefit / total_benefit if total_benefit != 0 else 0
    share_top_10 = top_10_benefit / total_benefit if total_benefit != 0 else 0

    baseline_gini = calculate_gini(baseline_income, hh_weights)
    reform_gini = calculate_gini(reform_income, hh_weights)

    total_weight = np.sum(hh_weights)
    pct_gaining = float(np.sum((income_change > 0.01) * hh_weights) / total_weight)
    pct_losing = float(np.sum((income_change < -0.01) * hh_weights) / total_weight)
    pct_unchanged = 1 - pct_gaining - pct_losing

    distributional_impact = DistributionalImpact(
        decile_impacts=decile_impacts,
        average_gain_all=avg_gain_all,
        average_gain_bottom_50=avg_gain_bottom_50,
        average_gain_top_10=avg_gain_top_10,
        share_to_bottom_20=share_bottom_20,
        share_to_bottom_50=share_bottom_50,
        share_to_top_20=share_top_20,
        share_to_top_10=share_top_10,
        baseline_gini=baseline_gini,
        reform_gini=reform_gini,
        gini_change=reform_gini - baseline_gini,
        percent_gaining=pct_gaining,
        percent_losing=pct_losing,
        percent_unchanged=pct_unchanged,
        state=states[0] if states and len(states) == 1 else None,
    )

    return {
        "poverty": poverty_impact.to_dict(),
        "fiscal": fiscal_cost.to_dict(),
        "distributional": distributional_impact.to_dict(),
    }


@app.function(image=image, timeout=120, memory=2048)
def run_household_baseline(
    household_config_dict: dict,
    year: int,
) -> dict:
    """
    Run single household baseline simulation on Modal.

    Args:
        household_config_dict: Serialized HouseholdConfig
        year: Tax year

    Returns:
        Dictionary with household results
    """
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.household.simulation import run_household_simulation

    config = HouseholdConfig.from_dict(household_config_dict)
    result = run_household_simulation(config, year=year)
    return result.to_dict()


@app.function(image=image, timeout=120, memory=2048)
def run_household_impact(
    household_config_dict: dict,
    reform_config_dict: dict,
    year: int,
) -> dict:
    """
    Run household impact comparison on Modal.

    Args:
        household_config_dict: Serialized HouseholdConfig
        reform_config_dict: Serialized ReformConfig
        year: Tax year

    Returns:
        Dictionary with baseline vs reform comparison
    """
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.household.simulation import calculate_household_impact

    h_config = HouseholdConfig.from_dict(household_config_dict)
    r_config = ReformConfig.from_dict(reform_config_dict)

    impact = calculate_household_impact(h_config, r_config, year=year)
    return impact.to_dict()


@app.function(image=image, timeout=300, memory=2048)
def run_income_sweep(
    household_config_dict: dict,
    reform_config_dict: dict | None,
    income_range: list[float],
    year: int,
) -> list[dict]:
    """
    Run income sweep analysis on Modal.

    Args:
        household_config_dict: Serialized HouseholdConfig
        reform_config_dict: Optional serialized ReformConfig
        income_range: List of income values to test
        year: Tax year

    Returns:
        List of (income, results) tuples as dicts
    """
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.reforms.builder import create_reform
    from cpid_calc.household.simulation import run_household_simulation

    config = HouseholdConfig.from_dict(household_config_dict)
    reform = None
    if reform_config_dict:
        r_config = ReformConfig.from_dict(reform_config_dict)
        reform = create_reform(r_config)

    results = []
    for income in income_range:
        config_copy = HouseholdConfig.from_dict(config.to_dict())
        config_copy.income.employment_income = income

        household_results = run_household_simulation(config_copy, reform=reform, year=year)
        results.append({
            "income": income,
            "results": household_results.to_dict(),
        })

    return results
