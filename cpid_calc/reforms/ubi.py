"""
Universal Basic Income / Child Allowance reform implementations.

This module contains UBI and child allowance reform scenarios,
including various benefit structures and phaseout options.
"""

from dataclasses import dataclass
from typing import Dict, Any
from cpid_calc.reforms.config import UBIConfig, AgeEligibility


@dataclass
class UBIReform:
    """
    Universal Basic Income / Child Allowance reform.

    Supports various UBI designs including child-focused allowances,
    full UBI, and means-tested versions.
    """
    config: UBIConfig

    @classmethod
    def child_allowance(
        cls,
        amount: float = 3600,
        age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17,
    ) -> "UBIReform":
        """
        Create a universal child allowance program.

        Args:
            amount: Annual amount per child
            age_eligibility: Age range for eligible children

        Returns:
            UBIReform with child allowance
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=amount,
                amount_per_adult=0,
                age_eligibility=age_eligibility,
                phase_out_with_income=False,
            )
        )

    @classmethod
    def young_child_allowance(
        cls,
        amount: float = 4200,
    ) -> "UBIReform":
        """
        Create a child allowance focused on young children (0-5).

        Args:
            amount: Annual amount per young child

        Returns:
            UBIReform for young children
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=amount,
                amount_per_adult=0,
                age_eligibility=AgeEligibility.AGES_0_5,
                phase_out_with_income=False,
            )
        )

    @classmethod
    def means_tested_child_allowance(
        cls,
        amount: float = 4000,
        phaseout_start: float = 75000,
        phaseout_rate: float = 0.05,
    ) -> "UBIReform":
        """
        Create a means-tested child allowance.

        This version phases out at higher incomes, reducing cost
        while targeting benefits to lower-income families.

        Args:
            amount: Maximum annual amount per child
            phaseout_start: Income at which phaseout begins
            phaseout_rate: Rate at which benefit phases out

        Returns:
            UBIReform with means-tested child allowance
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=amount,
                amount_per_adult=0,
                age_eligibility=AgeEligibility.AGES_0_17,
                phase_out_with_income=True,
                phaseout_start=phaseout_start,
                phaseout_rate=phaseout_rate,
            )
        )

    @classmethod
    def full_ubi(
        cls,
        adult_amount: float = 12000,
        child_amount: float = 4000,
    ) -> "UBIReform":
        """
        Create a full Universal Basic Income for all individuals.

        Args:
            adult_amount: Annual amount per adult
            child_amount: Annual amount per child

        Returns:
            UBIReform with full UBI
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=child_amount,
                amount_per_adult=adult_amount,
                age_eligibility=AgeEligibility.AGES_0_17,
                phase_out_with_income=False,
            )
        )

    @classmethod
    def negative_income_tax(
        cls,
        guarantee: float = 15000,
        phaseout_rate: float = 0.50,
    ) -> "UBIReform":
        """
        Create a Negative Income Tax structure.

        The NIT provides a guaranteed minimum income that phases out
        as earnings increase, preserving work incentives.

        Args:
            guarantee: Base guarantee amount per household
            phaseout_rate: Rate at which benefit phases out with income

        Returns:
            UBIReform with NIT structure
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=guarantee / 4,  # Approximate per-person
                amount_per_adult=guarantee / 2,
                age_eligibility=AgeEligibility.AGES_0_17,
                phase_out_with_income=True,
                phaseout_start=0,
                phaseout_rate=phaseout_rate,
            )
        )

    @classmethod
    def canada_child_benefit_style(cls) -> "UBIReform":
        """
        Create a child benefit modeled on Canada's CCB.

        The Canada Child Benefit provides up to CAD $7,437 per child
        under 6 and CAD $6,275 per child 6-17, phasing out at higher incomes.

        Returns:
            UBIReform based on CCB model
        """
        return cls(
            config=UBIConfig(
                enabled=True,
                amount_per_child=6000,  # USD approximation
                amount_per_adult=0,
                age_eligibility=AgeEligibility.AGES_0_17,
                phase_out_with_income=True,
                phaseout_start=35000,
                phaseout_rate=0.07,
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_ubi_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(ubi=self.config)
        return _build_ubi_reform(config)
