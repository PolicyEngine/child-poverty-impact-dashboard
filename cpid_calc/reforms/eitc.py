"""
Earned Income Tax Credit reform implementations.

This module contains EITC reform scenarios including individualization,
expansion options, and eligibility modifications.
"""

from dataclasses import dataclass
from typing import Dict, Any
from cpid_calc.reforms.config import EITCConfig


@dataclass
class EITCReform:
    """
    EITC reform with configurable parameters.

    Supports individualization, percentage expansions, and
    modifications to age eligibility.
    """
    config: EITCConfig

    @classmethod
    def standard_expansion(
        cls,
        expansion_percent: float = 50,
    ) -> "EITCReform":
        """
        Create an EITC expansion by a percentage.

        Args:
            expansion_percent: Percentage to expand EITC (e.g., 50 = 50% increase)

        Returns:
            EITCReform with expanded benefits
        """
        return cls(
            config=EITCConfig(
                enabled=True,
                expansion_percent=expansion_percent,
            )
        )

    @classmethod
    def individualized_eitc(cls) -> "EITCReform":
        """
        Create an individualized EITC that calculates on individual earnings.

        This reform changes the EITC from a household-based calculation
        to an individual-based calculation, which can benefit secondary
        earners in married households.

        Returns:
            EITCReform with individual basis
        """
        return cls(
            config=EITCConfig(
                enabled=True,
                individualized=True,
            )
        )

    @classmethod
    def childless_worker_expansion(
        cls,
        max_credit: float = 1500,
        age_floor: int = 19,
        age_ceiling: int = 67,
    ) -> "EITCReform":
        """
        Create an expanded EITC for childless workers.

        This reform increases the EITC for workers without qualifying children
        and expands age eligibility.

        Args:
            max_credit: Maximum credit for childless workers
            age_floor: Minimum age for eligibility
            age_ceiling: Maximum age for eligibility

        Returns:
            EITCReform for childless workers
        """
        return cls(
            config=EITCConfig(
                enabled=True,
                childless_expansion=True,
                age_floor_reduction=25 - age_floor,  # Default is 25
                age_ceiling_increase=age_ceiling - 65 if age_ceiling > 65 else 0,
            )
        )

    @classmethod
    def booker_earned_income_boost(cls) -> "EITCReform":
        """
        Create an EITC based on Senator Booker's RISE Credit proposal.

        Key features:
        - Nearly triples the maximum credit for childless workers
        - Expands age eligibility (19-67)
        - Increases phase-in and phase-out ranges

        Returns:
            EITCReform based on RISE Credit proposal
        """
        return cls(
            config=EITCConfig(
                enabled=True,
                expansion_percent=100,  # Double the EITC
                childless_expansion=True,
                age_floor_reduction=6,  # 25 -> 19
                age_ceiling_increase=2,  # 65 -> 67
            )
        )

    @classmethod
    def marriage_penalty_reduction(cls) -> "EITCReform":
        """
        Create an EITC reform that reduces the marriage penalty.

        This reform adjusts thresholds for married couples to reduce
        the penalty they face compared to filing as individuals.

        Returns:
            EITCReform reducing marriage penalty
        """
        return cls(
            config=EITCConfig(
                enabled=True,
                individualized=True,  # Most effective way to reduce penalty
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_eitc_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(eitc=self.config)
        return _build_eitc_reform(config)
