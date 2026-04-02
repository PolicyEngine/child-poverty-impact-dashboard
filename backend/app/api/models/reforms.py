"""
Pydantic models for reform request payloads.
"""

from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field


class AgeEligibility(str, Enum):
    """Age eligibility categories."""
    PRENATAL_3 = "prenatal_3"
    AGES_0_5 = "0_5"
    AGES_0_17 = "0_17"
    AGES_6_17 = "6_17"


class IncomeBasis(str, Enum):
    """Income basis for benefits."""
    AGI = "agi"
    EARNED_INCOME = "earned"
    GROSS_INCOME = "gross"


class PhaseoutStructure(str, Enum):
    """Phaseout structure types."""
    NONE = "none"
    SYMMETRIC = "symmetric"
    ASYMMETRIC = "asymmetric"


class CTCRequest(BaseModel):
    """Child Tax Credit reform parameters."""
    enabled: bool = False
    amount_young: float = Field(default=0, ge=0, description="Credit for children under 6")
    amount_older: float = Field(default=0, ge=0, description="Credit for children 6-17")
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    income_basis: IncomeBasis = IncomeBasis.AGI
    phaseout_structure: PhaseoutStructure = PhaseoutStructure.ASYMMETRIC
    phaseout_start_single: float = Field(default=200000, ge=0)
    phaseout_start_joint: float = Field(default=400000, ge=0)
    phaseout_rate: float = Field(default=0.05, ge=0, le=1)
    refundable: bool = True
    refundable_amount: Optional[float] = Field(default=None, ge=0)


class EITCRequest(BaseModel):
    """EITC reform parameters."""
    enabled: bool = False
    individualized: bool = Field(default=False, description="Individual vs household basis")
    expansion_percent: float = Field(default=0, ge=0, description="Percentage expansion")
    childless_expansion: bool = False
    age_floor_reduction: int = Field(default=0, ge=0, le=10)
    age_ceiling_increase: int = Field(default=0, ge=0, le=20)


class DependentExemptionRequest(BaseModel):
    """Dependent exemption reform parameters."""
    enabled: bool = False
    amount_per_dependent: float = Field(default=0, ge=0)
    refundable: bool = False
    income_limit_single: Optional[float] = Field(default=None, ge=0)
    income_limit_joint: Optional[float] = Field(default=None, ge=0)


class UBIRequest(BaseModel):
    """UBI/Child Allowance reform parameters."""
    enabled: bool = False
    amount_per_child: float = Field(default=0, ge=0)
    amount_per_adult: float = Field(default=0, ge=0)
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    phase_out_with_income: bool = False
    phaseout_start: float = Field(default=0, ge=0)
    phaseout_rate: float = Field(default=0, ge=0, le=1)


class SNAPRequest(BaseModel):
    """SNAP reform parameters."""
    enabled: bool = False
    benefit_increase_percent: float = Field(default=0, ge=0)
    expand_eligibility_percent: float = Field(default=0, ge=0)
    remove_asset_test: bool = False
    increase_child_allotment: float = Field(default=0, ge=0)


class StateCTCRequest(BaseModel):
    """State CTC reform parameters."""
    enabled: bool = False
    state: str = Field(default="", max_length=2, description="Two-letter state code")
    amount_young: float = Field(default=0, ge=0)
    amount_older: float = Field(default=0, ge=0)
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    income_limit: Optional[float] = Field(default=None, ge=0)
    refundable: bool = True
    matches_federal: bool = False
    match_percent: float = Field(default=0, ge=0, le=100)


class ReformRequest(BaseModel):
    """Complete reform configuration request."""
    name: str = Field(default="Custom Reform", max_length=100)
    description: str = Field(default="", max_length=500)
    year: int = Field(default=2026, ge=2026, le=2035)
    states: List[str] = Field(default_factory=list, description="States to analyze")

    # Individual reforms
    ctc: CTCRequest = Field(default_factory=CTCRequest)
    eitc: EITCRequest = Field(default_factory=EITCRequest)
    dependent_exemption: DependentExemptionRequest = Field(default_factory=DependentExemptionRequest)
    ubi: UBIRequest = Field(default_factory=UBIRequest)
    snap: SNAPRequest = Field(default_factory=SNAPRequest)
    state_ctc: StateCTCRequest = Field(default_factory=StateCTCRequest)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Expanded CTC",
                "description": "Expand the CTC to $3,600 for young children",
                "year": 2024,
                "states": [],
                "ctc": {
                    "enabled": True,
                    "amount_young": 3600,
                    "amount_older": 3000,
                    "refundable": True,
                },
            }
        }
