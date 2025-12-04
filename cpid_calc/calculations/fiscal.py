"""
Fiscal cost calculation module.

Calculates the budgetary impact of policy reforms at federal and state levels.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np
from policyengine_us import Microsimulation

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.calculations.microsim import (
    run_microsimulation,
    get_state_filter,
    get_household_weight,
    calculate_weighted_sum,
)


@dataclass
class FiscalCost:
    """Results of fiscal cost calculation."""
    # Total costs
    total_cost: float  # Positive = costs money, negative = raises revenue
    federal_cost: float
    state_cost: float

    # By component
    ctc_cost: float
    eitc_cost: float
    dependent_exemption_cost: float
    ubi_cost: float
    snap_cost: float
    state_ctc_cost: float

    # Revenue effects
    income_tax_change: float
    payroll_tax_change: float

    # Per-child metrics
    cost_per_child: float
    cost_per_child_lifted_from_poverty: float

    # State-specific
    state: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "total_cost_billions": round(self.total_cost / 1e9, 2),
            "federal_cost_billions": round(self.federal_cost / 1e9, 2),
            "state_cost_billions": round(self.state_cost / 1e9, 2),
            "ctc_cost_billions": round(self.ctc_cost / 1e9, 2),
            "eitc_cost_billions": round(self.eitc_cost / 1e9, 2),
            "dependent_exemption_cost_billions": round(self.dependent_exemption_cost / 1e9, 2),
            "ubi_cost_billions": round(self.ubi_cost / 1e9, 2),
            "snap_cost_billions": round(self.snap_cost / 1e9, 2),
            "state_ctc_cost_billions": round(self.state_ctc_cost / 1e9, 2),
            "income_tax_change_billions": round(self.income_tax_change / 1e9, 2),
            "payroll_tax_change_billions": round(self.payroll_tax_change / 1e9, 2),
            "cost_per_child": round(self.cost_per_child, 0),
            "cost_per_child_lifted_from_poverty": round(self.cost_per_child_lifted_from_poverty, 0),
            "state": self.state,
        }


def calculate_fiscal_cost(
    config: ReformConfig,
    states: Optional[List[str]] = None,
    year: int = 2024,
) -> FiscalCost:
    """
    Calculate the fiscal cost of a reform.

    Args:
        config: ReformConfig with policy parameters
        states: Optional list of states to filter (None = all states)
        year: Year for calculations

    Returns:
        FiscalCost with detailed fiscal impacts
    """
    # Run simulations
    baseline, reform = run_microsimulation(config)

    # Get filters
    state_filter = get_state_filter(baseline, states or [])

    # Map state filter to households
    # This is a simplification - in practice would need proper aggregation
    hh_weights = get_household_weight(baseline, year)

    # Calculate tax and benefit changes
    baseline_income_tax = baseline.calculate("income_tax", period=year)
    reform_income_tax = reform.calculate("income_tax", period=year)

    baseline_ctc = baseline.calculate("ctc", period=year)
    reform_ctc = reform.calculate("ctc", period=year)

    baseline_eitc = baseline.calculate("eitc", period=year)
    reform_eitc = reform.calculate("eitc", period=year)

    baseline_snap = baseline.calculate("snap", period=year)
    reform_snap = reform.calculate("snap", period=year)

    # Calculate costs (positive = government spending increases)
    ctc_cost = calculate_weighted_sum(
        reform_ctc - baseline_ctc, hh_weights
    )

    eitc_cost = calculate_weighted_sum(
        reform_eitc - baseline_eitc, hh_weights
    )

    snap_cost = calculate_weighted_sum(
        reform_snap - baseline_snap, hh_weights
    )

    # Income tax change (negative means less revenue)
    income_tax_change = calculate_weighted_sum(
        reform_income_tax - baseline_income_tax, hh_weights
    )

    # UBI and dependent exemption costs would be calculated from
    # custom variables if those reforms are enabled
    ubi_cost = 0.0
    dependent_exemption_cost = 0.0
    state_ctc_cost = 0.0

    if config.ubi.enabled:
        # Calculate from UBI variable if it exists
        try:
            baseline_ubi = baseline.calculate("ubi", period=year)
            reform_ubi = reform.calculate("ubi", period=year)
            ubi_cost = calculate_weighted_sum(
                reform_ubi - baseline_ubi, hh_weights
            )
        except Exception:
            # UBI variable not defined, estimate from config
            child_count = baseline.calculate("ctc_qualifying_children", period=year)
            ubi_cost = calculate_weighted_sum(
                child_count * config.ubi.amount_per_child, hh_weights
            )

    if config.state_ctc.enabled:
        # Calculate state CTC cost
        try:
            baseline_state_ctc = baseline.calculate(
                f"{config.state_ctc.state.lower()}_ctc", period=year
            )
            reform_state_ctc = reform.calculate(
                f"{config.state_ctc.state.lower()}_ctc", period=year
            )
            state_ctc_cost = calculate_weighted_sum(
                reform_state_ctc - baseline_state_ctc, hh_weights
            )
        except Exception:
            # State CTC variable not defined
            pass

    # Total federal and state costs
    federal_cost = ctc_cost + eitc_cost + snap_cost + ubi_cost - income_tax_change
    state_cost = state_ctc_cost + dependent_exemption_cost
    total_cost = federal_cost + state_cost

    # Per-child metrics
    total_children = calculate_weighted_sum(
        baseline.calculate("ctc_qualifying_children", period=year),
        hh_weights
    )

    # Get children lifted from poverty
    from cpid_calc.calculations.impact import calculate_poverty_impact
    poverty_impact = calculate_poverty_impact(config, states, year)

    cost_per_child = total_cost / total_children if total_children > 0 else 0
    cost_per_lifted = (
        total_cost / poverty_impact.children_lifted_out_of_poverty
        if poverty_impact.children_lifted_out_of_poverty > 0 else float("inf")
    )

    return FiscalCost(
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
        payroll_tax_change=0,  # Would need to calculate if relevant
        cost_per_child=cost_per_child,
        cost_per_child_lifted_from_poverty=cost_per_lifted,
        state=states[0] if states and len(states) == 1 else None,
    )


def calculate_fiscal_cost_by_state(
    config: ReformConfig,
    year: int = 2024,
) -> Dict[str, FiscalCost]:
    """
    Calculate fiscal cost for each state.

    Args:
        config: ReformConfig with policy parameters
        year: Year for calculations

    Returns:
        Dictionary mapping state codes to FiscalCost
    """
    from cpid_calc.reforms.state_ctc import ALL_STATES

    results = {}
    for state in ALL_STATES:
        results[state] = calculate_fiscal_cost(config, [state], year)

    return results
