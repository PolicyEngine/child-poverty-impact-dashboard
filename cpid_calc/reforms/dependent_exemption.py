"""
Dependent exemption reform implementations.

This module contains reforms related to federal and state-level
dependent exemptions and deductions.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
from cpid_calc.reforms.config import DependentExemptionConfig


@dataclass
class DependentExemptionReform:
    """
    Dependent exemption reform with configurable parameters.

    Supports various exemption amounts, refundability, and income limits.
    """
    config: DependentExemptionConfig

    @classmethod
    def restore_personal_exemption(
        cls,
        amount: float = 4300,
        inflation_adjusted: bool = True,
    ) -> "DependentExemptionReform":
        """
        Restore the personal exemption that was suspended by TCJA.

        The Tax Cuts and Jobs Act (2017) suspended personal exemptions
        through 2025. This reform restores them.

        Args:
            amount: Exemption amount per person (default $4,300, 2017 value)
            inflation_adjusted: Whether to adjust for inflation

        Returns:
            DependentExemptionReform restoring exemptions
        """
        # Inflation adjust from 2017 to current year if needed
        adjusted_amount = amount * 1.25 if inflation_adjusted else amount

        return cls(
            config=DependentExemptionConfig(
                enabled=True,
                amount_per_dependent=adjusted_amount,
                refundable=False,
            )
        )

    @classmethod
    def refundable_child_exemption(
        cls,
        amount: float = 4000,
        income_limit: Optional[float] = None,
    ) -> "DependentExemptionReform":
        """
        Create a refundable exemption for child dependents.

        Unlike traditional exemptions which only reduce taxable income,
        this reform makes the exemption refundable for low-income families.

        Args:
            amount: Exemption amount per child
            income_limit: Optional income limit for full benefit

        Returns:
            DependentExemptionReform with refundable exemption
        """
        return cls(
            config=DependentExemptionConfig(
                enabled=True,
                amount_per_dependent=amount,
                refundable=True,
                income_limit_single=income_limit,
                income_limit_joint=income_limit * 2 if income_limit else None,
            )
        )

    @classmethod
    def enhanced_dependent_credit(
        cls,
        amount: float = 500,
    ) -> "DependentExemptionReform":
        """
        Enhance the credit for other dependents (non-child dependents).

        This increases the $500 credit for non-child dependents established
        by TCJA.

        Args:
            amount: Credit amount per non-child dependent

        Returns:
            DependentExemptionReform with enhanced credit
        """
        return cls(
            config=DependentExemptionConfig(
                enabled=True,
                amount_per_dependent=amount,
                refundable=False,
            )
        )

    @classmethod
    def biden_2024_proposal(cls) -> "DependentExemptionReform":
        """
        Create dependent exemption based on Biden 2024 budget proposals.

        Returns:
            DependentExemptionReform based on Biden proposals
        """
        return cls(
            config=DependentExemptionConfig(
                enabled=True,
                amount_per_dependent=5000,
                refundable=True,
                income_limit_single=200000,
                income_limit_joint=400000,
            )
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_dependent_exemption_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(dependent_exemption=self.config)
        return _build_dependent_exemption_reform(config)
