"""
Fiscal cost calculation module.

Calculates the budgetary impact of policy reforms at federal and state levels.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.calculations.microsim import (
    run_microsimulation,
    get_state_filter,
    micro_sum,
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
            "dependent_exemption_cost_billions": round(
                self.dependent_exemption_cost / 1e9, 2
            ),
            "ubi_cost_billions": round(self.ubi_cost / 1e9, 2),
            "snap_cost_billions": round(self.snap_cost / 1e9, 2),
            "state_ctc_cost_billions": round(self.state_ctc_cost / 1e9, 2),
            "income_tax_change_billions": round(self.income_tax_change / 1e9, 2),
            "payroll_tax_change_billions": round(self.payroll_tax_change / 1e9, 2),
            "cost_per_child": round(self.cost_per_child, 0),
            "cost_per_child_lifted_from_poverty": round(
                self.cost_per_child_lifted_from_poverty, 0
            ),
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
    # Run simulations - use state-specific dataset if single state provided
    state = states[0] if states and len(states) == 1 else None
    baseline, reform = run_microsimulation(config, state=state)

    # Note: When using state-specific dataset, no state filter is needed as all
    # records are already from that state.
    household_filter = (
        None
        if state is not None
        else get_state_filter(baseline, states or [], map_to="household")
    )

    baseline_net_income = baseline.calc(
        "household_net_income", period=year, map_to="household"
    )
    reform_net_income = reform.calc(
        "household_net_income", period=year, map_to="household"
    )

    # Calculate tax and benefit changes
    baseline_income_tax = baseline.calc(
        "income_tax", period=year, map_to="household"
    )
    reform_income_tax = reform.calc("income_tax", period=year, map_to="household")

    baseline_ctc = baseline.calc("ctc", period=year, map_to="household")
    reform_ctc = reform.calc("ctc", period=year, map_to="household")

    baseline_eitc = baseline.calc("eitc", period=year, map_to="household")
    reform_eitc = reform.calc("eitc", period=year, map_to="household")

    baseline_snap = baseline.calc("snap", period=year, map_to="household")
    reform_snap = reform.calc("snap", period=year, map_to="household")
    baseline_state_income_tax = baseline.calc(
        "state_income_tax", period=year, map_to="household"
    )
    reform_state_income_tax = reform.calc(
        "state_income_tax", period=year, map_to="household"
    )

    # Calculate costs (positive = government spending increases)
    ctc_cost = micro_sum(reform_ctc - baseline_ctc, household_filter)

    eitc_cost = micro_sum(reform_eitc - baseline_eitc, household_filter)

    snap_cost = micro_sum(reform_snap - baseline_snap, household_filter)

    # Income tax change (negative means less revenue)
    income_tax_change = micro_sum(
        reform_income_tax - baseline_income_tax, household_filter
    )
    state_income_tax_change = micro_sum(
        reform_state_income_tax - baseline_state_income_tax, household_filter
    )

    # UBI and dependent exemption costs would be calculated from
    # custom variables if those reforms are enabled
    ubi_cost = 0.0
    dependent_exemption_cost = 0.0
    state_ctc_cost = 0.0

    if config.ubi.enabled:
        # Calculate from UBI variable if it exists
        try:
            baseline_ubi = baseline.calc("ubi", period=year, map_to="household")
            reform_ubi = reform.calc("ubi", period=year, map_to="household")
            ubi_cost = micro_sum(reform_ubi - baseline_ubi, household_filter)
        except Exception:
            # UBI variable not defined, estimate from config
            child_count = baseline.calc(
                "ctc_qualifying_children", period=year, map_to="household"
            )
            ubi_cost = micro_sum(
                child_count * config.ubi.amount_per_child,
                household_filter,
            )

    if config.state_ctc.enabled:
        # Calculate state CTC cost
        try:
            baseline_state_ctc = baseline.calc(
                f"{config.state_ctc.state.lower()}_ctc",
                period=year,
                map_to="household",
            )
            reform_state_ctc = reform.calc(
                f"{config.state_ctc.state.lower()}_ctc",
                period=year,
                map_to="household",
            )
            state_ctc_cost = micro_sum(
                reform_state_ctc - baseline_state_ctc, household_filter
            )
        except Exception:
            # State CTC variable not defined
            pass

    # Total cost follows the PolicyEngine API scoring pattern: positive means
    # households gain net income and the budgetary position worsens.
    total_cost = micro_sum(reform_net_income - baseline_net_income, household_filter)
    state_cost = state_ctc_cost - state_income_tax_change
    federal_cost = total_cost - state_cost

    # Per-child metrics
    total_children = micro_sum(
        baseline.calc("ctc_qualifying_children", period=year, map_to="household"),
        household_filter,
    )

    # Get children lifted from poverty
    from cpid_calc.calculations.impact import calculate_poverty_impact

    poverty_impact = calculate_poverty_impact(config, states, year)

    cost_per_child = total_cost / total_children if total_children > 0 else 0
    cost_per_lifted = (
        total_cost / poverty_impact.children_lifted_out_of_poverty
        if poverty_impact.children_lifted_out_of_poverty > 0
        else float("inf")
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
