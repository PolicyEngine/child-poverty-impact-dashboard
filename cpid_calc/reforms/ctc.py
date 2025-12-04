"""
Child Tax Credit reform implementations.

This module contains predefined CTC reform scenarios that can be modeled,
including variations by amount, age eligibility, income basis, and phaseout structure.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
from cpid_calc.reforms.config import (
    CTCConfig,
    AgeEligibility,
    IncomeBasis,
    PhaseoutStructure,
)


@dataclass
class CTCReform:
    """
    Child Tax Credit reform with various configurable parameters.

    This class provides factory methods for common CTC reform scenarios
    and allows for custom configurations.
    """
    config: CTCConfig

    @classmethod
    def expanded_ctc(
        cls,
        amount_young: float = 3600,
        amount_older: float = 3000,
        fully_refundable: bool = True,
    ) -> "CTCReform":
        """
        Create an expanded CTC similar to the 2021 American Rescue Plan.

        Args:
            amount_young: Credit amount for children under 6 (default $3,600)
            amount_older: Credit amount for children 6-17 (default $3,000)
            fully_refundable: Whether the credit is fully refundable

        Returns:
            CTCReform with expanded CTC configuration
        """
        return cls(
            config=CTCConfig(
                enabled=True,
                amount_young=amount_young,
                amount_older=amount_older,
                age_eligibility=AgeEligibility.AGES_0_17,
                phaseout_start_single=75000,
                phaseout_start_joint=150000,
                phaseout_rate=0.05,
                refundable=fully_refundable,
                refundable_amount=None if fully_refundable else 1600,
            )
        )

    @classmethod
    def young_child_ctc(
        cls,
        amount: float = 4000,
        age_limit: AgeEligibility = AgeEligibility.AGES_0_5,
    ) -> "CTCReform":
        """
        Create a young child-focused CTC (ages 0-5 or prenatal-3).

        Args:
            amount: Credit amount for young children
            age_limit: Age eligibility (PRENATAL_3 or AGES_0_5)

        Returns:
            CTCReform focused on young children
        """
        return cls(
            config=CTCConfig(
                enabled=True,
                amount_young=amount,
                amount_older=0,  # Only for young children
                age_eligibility=age_limit,
                refundable=True,
            )
        )

    @classmethod
    def universal_child_allowance(
        cls,
        amount: float = 3000,
    ) -> "CTCReform":
        """
        Create a universal child allowance with no income phaseout.

        Args:
            amount: Credit amount per child

        Returns:
            CTCReform with no income limits
        """
        return cls(
            config=CTCConfig(
                enabled=True,
                amount_young=amount,
                amount_older=amount,
                age_eligibility=AgeEligibility.AGES_0_17,
                phaseout_structure=PhaseoutStructure.NONE,
                phaseout_start_single=float("inf"),
                phaseout_start_joint=float("inf"),
                phaseout_rate=0,
                refundable=True,
            )
        )

    @classmethod
    def romney_family_security_act(cls) -> "CTCReform":
        """
        Create a CTC based on Senator Romney's Family Security Act proposal.

        This provides:
        - $4,200/year for children under 6
        - $3,000/year for children 6-17
        - Fully refundable
        - Monthly payments

        Returns:
            CTCReform based on FSA proposal
        """
        return cls(
            config=CTCConfig(
                enabled=True,
                amount_young=4200,
                amount_older=3000,
                age_eligibility=AgeEligibility.AGES_0_17,
                phaseout_start_single=200000,
                phaseout_start_joint=400000,
                phaseout_rate=0.05,
                refundable=True,
            )
        )

    @classmethod
    def bennet_brown_proposal(cls) -> "CTCReform":
        """
        Create a CTC based on the Bennet-Brown American Family Act proposal.

        Returns:
            CTCReform based on AFA proposal
        """
        return cls(
            config=CTCConfig(
                enabled=True,
                amount_young=3600,
                amount_older=3000,
                age_eligibility=AgeEligibility.AGES_0_17,
                phaseout_start_single=75000,
                phaseout_start_joint=150000,
                phaseout_rate=0.05,
                refundable=True,
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_ctc_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(ctc=self.config)
        return _build_ctc_reform(config)
