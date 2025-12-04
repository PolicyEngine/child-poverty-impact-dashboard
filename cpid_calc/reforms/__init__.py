"""
Reform definitions for the Child Poverty Impact Dashboard.

This module contains all policy reform configurations that can be modeled,
including CTC, EITC, dependent exemptions, UBI, SNAP, and state-specific reforms.
"""

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.reforms.builder import create_reform
from cpid_calc.reforms.ctc import CTCReform
from cpid_calc.reforms.eitc import EITCReform
from cpid_calc.reforms.dependent_exemption import DependentExemptionReform
from cpid_calc.reforms.ubi import UBIReform
from cpid_calc.reforms.snap import SNAPReform
from cpid_calc.reforms.state_ctc import StateCTCReform

__all__ = [
    "ReformConfig",
    "create_reform",
    "CTCReform",
    "EITCReform",
    "DependentExemptionReform",
    "UBIReform",
    "SNAPReform",
    "StateCTCReform",
]
