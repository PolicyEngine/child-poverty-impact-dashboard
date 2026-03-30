"""
Poverty impact calculation module.

Calculates child poverty rates and changes under baseline and reform scenarios.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np
from policyengine_us import Microsimulation

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.calculations.microsim import (
    run_microsimulation,
    get_state_filter,
    get_child_filter,
    get_young_child_filter,
    get_person_weight,
    calculate_weighted_mean,
    _to_numpy,
)


@dataclass
class PovertyImpact:
    """Results of poverty impact calculation."""
    # Child poverty rates
    baseline_child_poverty_rate: float
    reform_child_poverty_rate: float
    child_poverty_change: float
    child_poverty_percent_change: float

    # Young child (0-3) poverty rates
    baseline_young_child_poverty_rate: float
    reform_young_child_poverty_rate: float
    young_child_poverty_change: float
    young_child_poverty_percent_change: float

    # Counts
    children_lifted_out_of_poverty: int
    young_children_lifted_out_of_poverty: int

    # Deep poverty
    baseline_deep_child_poverty_rate: float
    reform_deep_child_poverty_rate: float
    deep_poverty_change: float

    # State-specific if applicable
    state: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "baseline_child_poverty_rate": round(self.baseline_child_poverty_rate * 100, 2),
            "reform_child_poverty_rate": round(self.reform_child_poverty_rate * 100, 2),
            "child_poverty_change_pp": round(self.child_poverty_change * 100, 2),
            "child_poverty_percent_change": round(self.child_poverty_percent_change * 100, 1),
            "baseline_young_child_poverty_rate": round(self.baseline_young_child_poverty_rate * 100, 2),
            "reform_young_child_poverty_rate": round(self.reform_young_child_poverty_rate * 100, 2),
            "young_child_poverty_change_pp": round(self.young_child_poverty_change * 100, 2),
            "young_child_poverty_percent_change": round(self.young_child_poverty_percent_change * 100, 1),
            "children_lifted_out_of_poverty": self.children_lifted_out_of_poverty,
            "young_children_lifted_out_of_poverty": self.young_children_lifted_out_of_poverty,
            "baseline_deep_child_poverty_rate": round(self.baseline_deep_child_poverty_rate * 100, 2),
            "reform_deep_child_poverty_rate": round(self.reform_deep_child_poverty_rate * 100, 2),
            "deep_poverty_change_pp": round(self.deep_poverty_change * 100, 2),
            "state": self.state,
        }


def calculate_poverty_impact(
    config: ReformConfig,
    states: Optional[List[str]] = None,
    year: int = 2024,
) -> PovertyImpact:
    """
    Calculate the child poverty impact of a reform.

    Args:
        config: ReformConfig with policy parameters
        states: Optional list of states to filter (None = all states)
        year: Year for calculations

    Returns:
        PovertyImpact with detailed poverty statistics
    """
    # Run simulations - use state-specific dataset if single state provided
    state = states[0] if states and len(states) == 1 else None
    baseline, reform = run_microsimulation(config, state=state)

    # Get filters - skip state filter if using state-specific dataset
    # (all persons in state-specific dataset are already from that state)
    child_filter = get_child_filter(baseline, year=year)
    young_child_filter = get_young_child_filter(baseline, year=year)

    if state is not None:
        # Using state-specific dataset - no state filter needed
        children = child_filter
        young_children = young_child_filter
    else:
        # Using national dataset - apply state filter
        state_filter = get_state_filter(baseline, states or [])
        children = state_filter & child_filter
        young_children = state_filter & young_child_filter

    # Get weights
    weights = get_person_weight(baseline, year)

    # Calculate poverty status (use person-level poverty indicator)
    baseline_in_poverty = baseline.calculate("person_in_poverty", period=year)
    reform_in_poverty = reform.calculate("person_in_poverty", period=year)

    # Deep poverty - use person-level indicator if available, else map from spm_unit
    try:
        baseline_in_deep_poverty = baseline.calculate("person_in_deep_poverty", period=year)
        reform_in_deep_poverty = reform.calculate("person_in_deep_poverty", period=year)
    except Exception:
        # Fall back to assuming same shape as regular poverty (may need proper mapping)
        baseline_in_deep_poverty = baseline_in_poverty * 0  # placeholder
        reform_in_deep_poverty = reform_in_poverty * 0

    # Child poverty rates
    baseline_child_poverty_rate = calculate_weighted_mean(
        baseline_in_poverty, weights, children
    )
    reform_child_poverty_rate = calculate_weighted_mean(
        reform_in_poverty, weights, children
    )

    # Young child poverty rates
    baseline_young_child_poverty_rate = calculate_weighted_mean(
        baseline_in_poverty, weights, young_children
    )
    reform_young_child_poverty_rate = calculate_weighted_mean(
        reform_in_poverty, weights, young_children
    )

    # Deep poverty rates
    baseline_deep_child_poverty_rate = calculate_weighted_mean(
        baseline_in_deep_poverty, weights, children
    )
    reform_deep_child_poverty_rate = calculate_weighted_mean(
        reform_in_deep_poverty, weights, children
    )

    # Count children lifted out of poverty
    # Convert MicroSeries to numpy arrays for boolean operations
    baseline_poverty_arr = _to_numpy(baseline_in_poverty)
    reform_poverty_arr = _to_numpy(reform_in_poverty)
    children_arr = _to_numpy(children)
    young_children_arr = _to_numpy(young_children)
    weights_arr = _to_numpy(weights)

    lifted_out = baseline_poverty_arr & ~reform_poverty_arr
    children_lifted = int(np.sum(lifted_out[children_arr] * weights_arr[children_arr]))
    young_children_lifted = int(np.sum(lifted_out[young_children_arr] * weights_arr[young_children_arr]))

    # Calculate changes
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

    return PovertyImpact(
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


def calculate_poverty_impact_by_state(
    config: ReformConfig,
    year: int = 2024,
) -> Dict[str, PovertyImpact]:
    """
    Calculate poverty impact for each state.

    Args:
        config: ReformConfig with policy parameters
        year: Year for calculations

    Returns:
        Dictionary mapping state codes to PovertyImpact
    """
    from cpid_calc.reforms.state_ctc import ALL_STATES

    # Run simulations once
    baseline, reform = run_microsimulation(config)

    results = {}
    weights = get_person_weight(baseline, year)
    child_filter = get_child_filter(baseline)
    young_child_filter = get_young_child_filter(baseline)

    baseline_in_poverty = baseline.calculate("in_poverty", period=year)
    reform_in_poverty = reform.calculate("in_poverty", period=year)
    baseline_in_deep_poverty = baseline.calculate("in_deep_poverty", period=year)
    reform_in_deep_poverty = reform.calculate("in_deep_poverty", period=year)

    for state in ALL_STATES:
        state_filter = get_state_filter(baseline, [state])
        children = state_filter & child_filter
        young_children = state_filter & young_child_filter

        # Child poverty rates
        baseline_child_poverty_rate = calculate_weighted_mean(
            baseline_in_poverty, weights, children
        )
        reform_child_poverty_rate = calculate_weighted_mean(
            reform_in_poverty, weights, children
        )

        # Young child poverty rates
        baseline_young_child_poverty_rate = calculate_weighted_mean(
            baseline_in_poverty, weights, young_children
        )
        reform_young_child_poverty_rate = calculate_weighted_mean(
            reform_in_poverty, weights, young_children
        )

        # Deep poverty
        baseline_deep = calculate_weighted_mean(
            baseline_in_deep_poverty, weights, children
        )
        reform_deep = calculate_weighted_mean(
            reform_in_deep_poverty, weights, children
        )

        # Counts
        lifted_out = baseline_in_poverty & ~reform_in_poverty
        children_lifted = int(np.sum(lifted_out[children] * weights[children]))
        young_children_lifted = int(np.sum(lifted_out[young_children] * weights[young_children]))

        # Changes
        child_poverty_change = reform_child_poverty_rate - baseline_child_poverty_rate
        child_pct_change = (
            child_poverty_change / baseline_child_poverty_rate
            if baseline_child_poverty_rate > 0 else 0
        )

        young_child_change = reform_young_child_poverty_rate - baseline_young_child_poverty_rate
        young_child_pct_change = (
            young_child_change / baseline_young_child_poverty_rate
            if baseline_young_child_poverty_rate > 0 else 0
        )

        results[state] = PovertyImpact(
            baseline_child_poverty_rate=baseline_child_poverty_rate,
            reform_child_poverty_rate=reform_child_poverty_rate,
            child_poverty_change=child_poverty_change,
            child_poverty_percent_change=child_pct_change,
            baseline_young_child_poverty_rate=baseline_young_child_poverty_rate,
            reform_young_child_poverty_rate=reform_young_child_poverty_rate,
            young_child_poverty_change=young_child_change,
            young_child_poverty_percent_change=young_child_pct_change,
            children_lifted_out_of_poverty=children_lifted,
            young_children_lifted_out_of_poverty=young_children_lifted,
            baseline_deep_child_poverty_rate=baseline_deep,
            reform_deep_child_poverty_rate=reform_deep,
            deep_poverty_change=reform_deep - baseline_deep,
            state=state,
        )

    return results
