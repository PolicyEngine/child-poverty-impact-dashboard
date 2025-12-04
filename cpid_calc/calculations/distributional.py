"""
Distributional impact calculation module.

Calculates how policy reforms affect different income groups.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
from policyengine_us import Microsimulation

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.calculations.microsim import (
    run_microsimulation,
    get_state_filter,
    get_household_weight,
    calculate_weighted_sum,
    calculate_weighted_mean,
)


@dataclass
class DecileImpact:
    """Impact on a specific income decile."""
    decile: int  # 1-10
    average_gain: float
    percent_gaining: float
    percent_losing: float
    total_benefit: float
    share_of_total_benefit: float


@dataclass
class DistributionalImpact:
    """Full distributional analysis results."""
    # By income decile
    decile_impacts: List[DecileImpact]

    # Summary statistics
    average_gain_all: float
    average_gain_bottom_50: float
    average_gain_top_10: float

    # Share of benefits
    share_to_bottom_20: float
    share_to_bottom_50: float
    share_to_top_20: float
    share_to_top_10: float

    # Gini coefficient change
    baseline_gini: float
    reform_gini: float
    gini_change: float

    # Households affected
    percent_gaining: float
    percent_losing: float
    percent_unchanged: float

    # State-specific
    state: Optional[str] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "decile_impacts": [
                {
                    "decile": d.decile,
                    "average_gain": round(d.average_gain, 2),
                    "percent_gaining": round(d.percent_gaining * 100, 1),
                    "percent_losing": round(d.percent_losing * 100, 1),
                    "total_benefit_billions": round(d.total_benefit / 1e9, 3),
                    "share_of_total_benefit": round(d.share_of_total_benefit * 100, 1),
                }
                for d in self.decile_impacts
            ],
            "average_gain_all": round(self.average_gain_all, 2),
            "average_gain_bottom_50": round(self.average_gain_bottom_50, 2),
            "average_gain_top_10": round(self.average_gain_top_10, 2),
            "share_to_bottom_20_pct": round(self.share_to_bottom_20 * 100, 1),
            "share_to_bottom_50_pct": round(self.share_to_bottom_50 * 100, 1),
            "share_to_top_20_pct": round(self.share_to_top_20 * 100, 1),
            "share_to_top_10_pct": round(self.share_to_top_10 * 100, 1),
            "baseline_gini": round(self.baseline_gini, 4),
            "reform_gini": round(self.reform_gini, 4),
            "gini_change": round(self.gini_change, 4),
            "percent_gaining": round(self.percent_gaining * 100, 1),
            "percent_losing": round(self.percent_losing * 100, 1),
            "percent_unchanged": round(self.percent_unchanged * 100, 1),
            "state": self.state,
        }


def calculate_gini(
    incomes: np.ndarray,
    weights: np.ndarray,
) -> float:
    """
    Calculate weighted Gini coefficient.

    Args:
        incomes: Array of income values
        weights: Array of weights

    Returns:
        Gini coefficient (0-1)
    """
    # Sort by income
    sorted_indices = np.argsort(incomes)
    sorted_incomes = incomes[sorted_indices]
    sorted_weights = weights[sorted_indices]

    # Cumulative weights and income
    cum_weights = np.cumsum(sorted_weights)
    cum_weights = cum_weights / cum_weights[-1]  # Normalize

    cum_income = np.cumsum(sorted_incomes * sorted_weights)
    cum_income = cum_income / cum_income[-1]  # Normalize

    # Calculate Gini using trapezoidal rule
    gini = 1 - 2 * np.trapz(cum_income, cum_weights)
    return float(gini)


def get_income_decile(
    sim: Microsimulation,
    year: int,
) -> np.ndarray:
    """
    Get household income decile assignment.

    Args:
        sim: Microsimulation object
        year: Year for income calculation

    Returns:
        Array of decile assignments (1-10)
    """
    household_income = sim.calculate("household_net_income", period=year)
    weights = sim.calculate("household_weight", period=year)

    # Calculate weighted decile cutoffs
    sorted_indices = np.argsort(household_income)
    sorted_income = household_income[sorted_indices]
    sorted_weights = weights[sorted_indices]

    cum_weights = np.cumsum(sorted_weights)
    total_weight = cum_weights[-1]

    # Find decile cutoffs
    decile_cutoffs = []
    for i in range(1, 10):
        target = (i / 10) * total_weight
        idx = np.searchsorted(cum_weights, target)
        decile_cutoffs.append(sorted_income[min(idx, len(sorted_income) - 1)])

    # Assign deciles
    deciles = np.ones(len(household_income), dtype=int)
    for i, cutoff in enumerate(decile_cutoffs):
        deciles[household_income > cutoff] = i + 2

    return deciles


def calculate_distributional_impact(
    config: ReformConfig,
    states: Optional[List[str]] = None,
    year: int = 2024,
) -> DistributionalImpact:
    """
    Calculate distributional impact of a reform.

    Args:
        config: ReformConfig with policy parameters
        states: Optional list of states to filter
        year: Year for calculations

    Returns:
        DistributionalImpact with detailed distributional analysis
    """
    # Run simulations
    baseline, reform = run_microsimulation(config)

    # Get weights
    weights = get_household_weight(baseline, year)

    # Calculate income change
    baseline_income = baseline.calculate("household_net_income", period=year)
    reform_income = reform.calculate("household_net_income", period=year)
    income_change = reform_income - baseline_income

    # Get deciles
    deciles = get_income_decile(baseline, year)

    # Calculate decile impacts
    total_benefit = calculate_weighted_sum(income_change, weights)
    decile_impacts = []

    for d in range(1, 11):
        decile_mask = deciles == d
        decile_weights = weights[decile_mask]
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

    # Summary statistics
    avg_gain_all = calculate_weighted_mean(income_change, weights)

    bottom_50_mask = deciles <= 5
    avg_gain_bottom_50 = calculate_weighted_mean(
        income_change[bottom_50_mask], weights[bottom_50_mask]
    )

    top_10_mask = deciles == 10
    avg_gain_top_10 = calculate_weighted_mean(
        income_change[top_10_mask], weights[top_10_mask]
    )

    # Shares of benefits
    bottom_20_benefit = sum(d.total_benefit for d in decile_impacts[:2])
    bottom_50_benefit = sum(d.total_benefit for d in decile_impacts[:5])
    top_20_benefit = sum(d.total_benefit for d in decile_impacts[8:])
    top_10_benefit = decile_impacts[9].total_benefit

    share_bottom_20 = bottom_20_benefit / total_benefit if total_benefit != 0 else 0
    share_bottom_50 = bottom_50_benefit / total_benefit if total_benefit != 0 else 0
    share_top_20 = top_20_benefit / total_benefit if total_benefit != 0 else 0
    share_top_10 = top_10_benefit / total_benefit if total_benefit != 0 else 0

    # Gini coefficients
    baseline_gini = calculate_gini(baseline_income, weights)
    reform_gini = calculate_gini(reform_income, weights)

    # Percent gaining/losing
    total_weight = np.sum(weights)
    pct_gaining = float(np.sum((income_change > 0.01) * weights) / total_weight)
    pct_losing = float(np.sum((income_change < -0.01) * weights) / total_weight)
    pct_unchanged = 1 - pct_gaining - pct_losing

    return DistributionalImpact(
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


def calculate_distributional_impact_by_state(
    config: ReformConfig,
    year: int = 2024,
) -> Dict[str, DistributionalImpact]:
    """
    Calculate distributional impact for each state.

    Args:
        config: ReformConfig with policy parameters
        year: Year for calculations

    Returns:
        Dictionary mapping state codes to DistributionalImpact
    """
    from cpid_calc.reforms.state_ctc import ALL_STATES

    results = {}
    for state in ALL_STATES:
        results[state] = calculate_distributional_impact(config, [state], year)

    return results
