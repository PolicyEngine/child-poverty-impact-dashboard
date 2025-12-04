"""
Reform configuration dataclasses for policy modeling.
"""

from dataclasses import dataclass, field
from typing import Optional, Literal
from enum import Enum


class AgeEligibility(str, Enum):
    """Age eligibility categories for child-related reforms."""
    PRENATAL_3 = "prenatal_3"  # Prenatal to age 3
    AGES_0_5 = "0_5"           # Ages 0-5
    AGES_0_17 = "0_17"         # Ages 0-17 (all children)
    AGES_6_17 = "6_17"         # Ages 6-17


class IncomeBasis(str, Enum):
    """Income basis for calculating benefits."""
    AGI = "agi"                 # Adjusted Gross Income
    EARNED_INCOME = "earned"    # Earned income only
    GROSS_INCOME = "gross"      # Total gross income


class PhaseoutStructure(str, Enum):
    """Phaseout structure types."""
    NONE = "none"              # No phaseout (universal)
    SYMMETRIC = "symmetric"    # Same rate for phase-in and phase-out
    ASYMMETRIC = "asymmetric"  # Different rates


@dataclass
class CTCConfig:
    """Child Tax Credit configuration."""
    enabled: bool = False
    amount_young: float = 0  # Amount for young children (under 6)
    amount_older: float = 0  # Amount for older children (6-17)
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    income_basis: IncomeBasis = IncomeBasis.AGI
    phaseout_structure: PhaseoutStructure = PhaseoutStructure.ASYMMETRIC
    phaseout_start_single: float = 200000
    phaseout_start_joint: float = 400000
    phaseout_rate: float = 0.05
    refundable: bool = True
    refundable_amount: Optional[float] = None  # If None, fully refundable


@dataclass
class EITCConfig:
    """Earned Income Tax Credit configuration."""
    enabled: bool = False
    individualized: bool = False  # Individual vs. household basis
    expansion_percent: float = 0  # Percentage expansion of current EITC
    childless_expansion: bool = False  # Expand for childless workers
    age_floor_reduction: int = 0  # Reduce minimum age by this many years
    age_ceiling_increase: int = 0  # Increase maximum age (0 = no ceiling)


@dataclass
class DependentExemptionConfig:
    """Dependent exemption configuration."""
    enabled: bool = False
    amount_per_dependent: float = 0
    refundable: bool = False
    income_limit_single: Optional[float] = None
    income_limit_joint: Optional[float] = None


@dataclass
class UBIConfig:
    """Universal Basic Income / Child Allowance configuration."""
    enabled: bool = False
    amount_per_child: float = 0
    amount_per_adult: float = 0
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    phase_out_with_income: bool = False
    phaseout_start: float = 0
    phaseout_rate: float = 0


@dataclass
class SNAPConfig:
    """SNAP (food stamps) modification configuration."""
    enabled: bool = False
    benefit_increase_percent: float = 0  # Percentage increase in benefits
    expand_eligibility_percent: float = 0  # Expand income eligibility threshold
    remove_asset_test: bool = False
    increase_child_allotment: float = 0  # Additional per-child amount


@dataclass
class StateCTCConfig:
    """State-level Child Tax Credit configuration."""
    enabled: bool = False
    state: str = ""  # Two-letter state code
    amount_young: float = 0
    amount_older: float = 0
    age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17
    income_limit: Optional[float] = None
    refundable: bool = True

    # State-specific parameters
    matches_federal: bool = False  # If True, piggybacks on federal CTC
    match_percent: float = 0  # Percentage of federal CTC to match


@dataclass
class ReformConfig:
    """
    Complete reform configuration combining all policy options.

    This is the main configuration object passed to the calculation engine.
    """
    name: str = "Custom Reform"
    description: str = ""
    year: int = 2024

    # Target states (empty = all states)
    states: list[str] = field(default_factory=list)

    # Individual reform configurations
    ctc: CTCConfig = field(default_factory=CTCConfig)
    eitc: EITCConfig = field(default_factory=EITCConfig)
    dependent_exemption: DependentExemptionConfig = field(
        default_factory=DependentExemptionConfig
    )
    ubi: UBIConfig = field(default_factory=UBIConfig)
    snap: SNAPConfig = field(default_factory=SNAPConfig)
    state_ctc: StateCTCConfig = field(default_factory=StateCTCConfig)

    def get_enabled_reforms(self) -> list[str]:
        """Return list of enabled reform types."""
        enabled = []
        if self.ctc.enabled:
            enabled.append("ctc")
        if self.eitc.enabled:
            enabled.append("eitc")
        if self.dependent_exemption.enabled:
            enabled.append("dependent_exemption")
        if self.ubi.enabled:
            enabled.append("ubi")
        if self.snap.enabled:
            enabled.append("snap")
        if self.state_ctc.enabled:
            enabled.append("state_ctc")
        return enabled

    def to_dict(self) -> dict:
        """Convert configuration to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "ReformConfig":
        """Create configuration from dictionary."""
        # Handle nested dataclasses
        if "ctc" in data and isinstance(data["ctc"], dict):
            data["ctc"] = CTCConfig(**data["ctc"])
        if "eitc" in data and isinstance(data["eitc"], dict):
            data["eitc"] = EITCConfig(**data["eitc"])
        if "dependent_exemption" in data and isinstance(data["dependent_exemption"], dict):
            data["dependent_exemption"] = DependentExemptionConfig(**data["dependent_exemption"])
        if "ubi" in data and isinstance(data["ubi"], dict):
            data["ubi"] = UBIConfig(**data["ubi"])
        if "snap" in data and isinstance(data["snap"], dict):
            data["snap"] = SNAPConfig(**data["snap"])
        if "state_ctc" in data and isinstance(data["state_ctc"], dict):
            data["state_ctc"] = StateCTCConfig(**data["state_ctc"])
        return cls(**data)
