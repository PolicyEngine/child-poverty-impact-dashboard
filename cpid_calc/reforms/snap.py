"""
SNAP (Supplemental Nutrition Assistance Program) reform implementations.

This module contains SNAP modification scenarios including benefit
expansions, eligibility changes, and structural reforms.
"""

from dataclasses import dataclass
from typing import Dict, Any
from cpid_calc.reforms.config import SNAPConfig


@dataclass
class SNAPReform:
    """
    SNAP reform with configurable parameters.

    Supports benefit increases, eligibility expansions, and
    structural modifications.
    """
    config: SNAPConfig

    @classmethod
    def benefit_increase(
        cls,
        percent_increase: float = 15,
    ) -> "SNAPReform":
        """
        Increase SNAP benefits by a percentage.

        Args:
            percent_increase: Percentage increase in benefits

        Returns:
            SNAPReform with increased benefits
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                benefit_increase_percent=percent_increase,
            )
        )

    @classmethod
    def eligibility_expansion(
        cls,
        income_limit_increase: float = 30,
        remove_asset_test: bool = True,
    ) -> "SNAPReform":
        """
        Expand SNAP eligibility.

        Args:
            income_limit_increase: Percentage increase in income eligibility
            remove_asset_test: Whether to remove the asset test

        Returns:
            SNAPReform with expanded eligibility
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                expand_eligibility_percent=income_limit_increase,
                remove_asset_test=remove_asset_test,
            )
        )

    @classmethod
    def child_nutrition_boost(
        cls,
        additional_per_child: float = 50,  # Monthly amount
    ) -> "SNAPReform":
        """
        Add additional SNAP benefits per child.

        This reform provides extra nutrition assistance for households
        with children.

        Args:
            additional_per_child: Additional monthly amount per child

        Returns:
            SNAPReform with child nutrition boost
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                increase_child_allotment=additional_per_child * 12,  # Annual
            )
        )

    @classmethod
    def pandemic_ebt_continuation(cls) -> "SNAPReform":
        """
        Continue pandemic-era EBT benefits.

        During COVID-19, SNAP recipients received emergency allotments
        bringing benefits to the maximum level. This reform continues
        that policy.

        Returns:
            SNAPReform with pandemic-level benefits
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                benefit_increase_percent=25,  # Approximate effect
            )
        )

    @classmethod
    def comprehensive_expansion(
        cls,
        benefit_increase: float = 20,
        eligibility_increase: float = 30,
        child_boost: float = 40,
    ) -> "SNAPReform":
        """
        Comprehensive SNAP expansion combining multiple reforms.

        Args:
            benefit_increase: Percentage increase in base benefits
            eligibility_increase: Percentage increase in income limits
            child_boost: Additional monthly amount per child

        Returns:
            SNAPReform with comprehensive expansion
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                benefit_increase_percent=benefit_increase,
                expand_eligibility_percent=eligibility_increase,
                remove_asset_test=True,
                increase_child_allotment=child_boost * 12,
            )
        )

    @classmethod
    def thrifty_food_plan_update(cls) -> "SNAPReform":
        """
        Update based on revised Thrifty Food Plan.

        The USDA updates the Thrifty Food Plan periodically. This reform
        reflects a more generous TFP baseline.

        Returns:
            SNAPReform with updated TFP
        """
        return cls(
            config=SNAPConfig(
                enabled=True,
                benefit_increase_percent=21,  # 2021 TFP update amount
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_snap_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(snap=self.config)
        return _build_snap_reform(config)
