"""
Household configuration and simulation modules.

This package handles household data entry, PolicyEngine simulation setup,
and household-level impact calculations.
"""

from cpid_calc.household.config import (
    HouseholdConfig,
    PersonConfig,
    ChildConfig,
    AdultConfig,
    IncomeConfig,
    FilingStatus,
)
from cpid_calc.household.simulation import (
    run_household_simulation,
    HouseholdResults,
    calculate_household_impact,
)
from cpid_calc.household.builder import build_household_situation

__all__ = [
    "HouseholdConfig",
    "PersonConfig",
    "ChildConfig",
    "AdultConfig",
    "IncomeConfig",
    "FilingStatus",
    "run_household_simulation",
    "HouseholdResults",
    "calculate_household_impact",
    "build_household_situation",
]
