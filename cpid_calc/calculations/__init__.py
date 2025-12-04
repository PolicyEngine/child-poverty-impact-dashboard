"""
Calculation modules for the Child Poverty Impact Dashboard.

This package contains the core calculation logic for:
- Poverty impact analysis
- Fiscal cost estimation
- Distributional effects
- Microsimulation helpers
"""

from cpid_calc.calculations.impact import calculate_poverty_impact
from cpid_calc.calculations.fiscal import calculate_fiscal_cost
from cpid_calc.calculations.distributional import calculate_distributional_impact
from cpid_calc.calculations.microsim import run_microsimulation

__all__ = [
    "calculate_poverty_impact",
    "calculate_fiscal_cost",
    "calculate_distributional_impact",
    "run_microsimulation",
]
