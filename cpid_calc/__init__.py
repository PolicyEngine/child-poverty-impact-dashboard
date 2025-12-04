"""
Child Poverty Impact Dashboard - Calculation Engine

A policy microsimulation toolkit for analyzing child poverty impacts
across US states.
"""

from cpid_calc.calculations.impact import calculate_poverty_impact
from cpid_calc.calculations.fiscal import calculate_fiscal_cost
from cpid_calc.calculations.distributional import calculate_distributional_impact
from cpid_calc.reforms import ReformConfig, create_reform

__version__ = "0.1.0"

__all__ = [
    "calculate_poverty_impact",
    "calculate_fiscal_cost",
    "calculate_distributional_impact",
    "ReformConfig",
    "create_reform",
]
