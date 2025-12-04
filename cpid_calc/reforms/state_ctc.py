"""
State-level Child Tax Credit reform implementations.

This module contains state CTC configurations for all 50 states and DC,
including existing programs and proposed reforms.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from cpid_calc.reforms.config import StateCTCConfig, AgeEligibility


# States with existing CTCs or similar programs
EXISTING_STATE_CTCS = {
    "CA": {"name": "Young Child Tax Credit", "amount": 1117, "age": AgeEligibility.AGES_0_5},
    "CO": {"name": "Child Tax Credit", "amount": 1200, "age": AgeEligibility.AGES_0_5},
    "CT": {"name": "Child Tax Rebate", "amount": 250, "age": AgeEligibility.AGES_0_17},
    "ID": {"name": "Child Tax Credit", "amount": 205, "age": AgeEligibility.AGES_0_17},
    "MA": {"name": "Child and Family Tax Credit", "amount": 440, "age": AgeEligibility.AGES_0_17},
    "MD": {"name": "Child Tax Credit", "amount": 500, "age": AgeEligibility.AGES_0_17},
    "ME": {"name": "Child Tax Credit", "amount": 300, "age": AgeEligibility.AGES_0_17},
    "MN": {"name": "Child Tax Credit", "amount": 1750, "age": AgeEligibility.AGES_0_17},
    "NJ": {"name": "Child Tax Credit", "amount": 1000, "age": AgeEligibility.AGES_0_5},
    "NM": {"name": "Child Income Tax Credit", "amount": 600, "age": AgeEligibility.AGES_0_17},
    "NY": {"name": "Empire State Child Credit", "amount": 330, "age": AgeEligibility.AGES_0_17},
    "OK": {"name": "Child Tax Credit", "amount": 100, "age": AgeEligibility.AGES_0_17},
    "OR": {"name": "Oregon Kids Credit", "amount": 1000, "age": AgeEligibility.AGES_0_5},
    "RI": {"name": "Child Tax Rebate", "amount": 250, "age": AgeEligibility.AGES_0_17},
    "VT": {"name": "Child Tax Credit", "amount": 1000, "age": AgeEligibility.AGES_0_5},
}

# All US states and DC
ALL_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]


@dataclass
class StateCTCReform:
    """
    State-level Child Tax Credit reform.

    Supports creating new state CTCs or modifying existing ones
    across all 50 states and DC.
    """
    config: StateCTCConfig

    @classmethod
    def new_state_ctc(
        cls,
        state: str,
        amount_young: float = 2000,
        amount_older: float = 1500,
        age_eligibility: AgeEligibility = AgeEligibility.AGES_0_17,
        income_limit: Optional[float] = None,
        refundable: bool = True,
    ) -> "StateCTCReform":
        """
        Create a new state CTC program.

        Args:
            state: Two-letter state code
            amount_young: Credit amount for children under 6
            amount_older: Credit amount for children 6-17
            age_eligibility: Age eligibility range
            income_limit: Optional income limit
            refundable: Whether the credit is refundable

        Returns:
            StateCTCReform for the specified state
        """
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state=state.upper(),
                amount_young=amount_young,
                amount_older=amount_older,
                age_eligibility=age_eligibility,
                income_limit=income_limit,
                refundable=refundable,
            )
        )

    @classmethod
    def federal_match(
        cls,
        state: str,
        match_percent: float = 25,
    ) -> "StateCTCReform":
        """
        Create a state CTC that matches a percentage of the federal CTC.

        Args:
            state: Two-letter state code
            match_percent: Percentage of federal CTC to match

        Returns:
            StateCTCReform matching federal CTC
        """
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state=state.upper(),
                matches_federal=True,
                match_percent=match_percent,
                refundable=True,
            )
        )

    @classmethod
    def young_child_focus(
        cls,
        state: str,
        amount: float = 3000,
    ) -> "StateCTCReform":
        """
        Create a state CTC focused on young children (0-5).

        Args:
            state: Two-letter state code
            amount: Credit amount for young children

        Returns:
            StateCTCReform for young children
        """
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state=state.upper(),
                amount_young=amount,
                amount_older=0,
                age_eligibility=AgeEligibility.AGES_0_5,
                refundable=True,
            )
        )

    @classmethod
    def california_yctc(cls, expanded: bool = False) -> "StateCTCReform":
        """
        California Young Child Tax Credit.

        Args:
            expanded: If True, expand the existing program

        Returns:
            StateCTCReform for California YCTC
        """
        amount = 2000 if expanded else 1117
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state="CA",
                amount_young=amount,
                amount_older=0,
                age_eligibility=AgeEligibility.AGES_0_5,
                income_limit=30000,  # Approximate CalEITC eligibility
                refundable=True,
            )
        )

    @classmethod
    def minnesota_ctc(cls, expanded: bool = False) -> "StateCTCReform":
        """
        Minnesota Child Tax Credit.

        Minnesota has one of the most generous state CTCs.

        Args:
            expanded: If True, increase the credit amount

        Returns:
            StateCTCReform for Minnesota CTC
        """
        amount = 2500 if expanded else 1750
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state="MN",
                amount_young=amount,
                amount_older=amount,
                age_eligibility=AgeEligibility.AGES_0_17,
                income_limit=35000,
                refundable=True,
            )
        )

    @classmethod
    def rhode_island_ctc(cls) -> "StateCTCReform":
        """
        Rhode Island Child Tax Credit.

        Based on the ri-ctc-calculator implementation.

        Returns:
            StateCTCReform for Rhode Island CTC
        """
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state="RI",
                amount_young=250,
                amount_older=250,
                age_eligibility=AgeEligibility.AGES_0_17,
                refundable=True,
            )
        )

    @classmethod
    def get_existing_state_ctc(cls, state: str) -> Optional["StateCTCReform"]:
        """
        Get the existing state CTC configuration if one exists.

        Args:
            state: Two-letter state code

        Returns:
            StateCTCReform if state has an existing CTC, None otherwise
        """
        state = state.upper()
        if state not in EXISTING_STATE_CTCS:
            return None

        ctc_info = EXISTING_STATE_CTCS[state]
        return cls(
            config=StateCTCConfig(
                enabled=True,
                state=state,
                amount_young=ctc_info["amount"],
                amount_older=ctc_info["amount"] if ctc_info["age"] == AgeEligibility.AGES_0_17 else 0,
                age_eligibility=ctc_info["age"],
                refundable=True,
            )
        )

    @classmethod
    def get_states_with_ctc(cls) -> List[str]:
        """Return list of states with existing CTCs."""
        return list(EXISTING_STATE_CTCS.keys())

    @classmethod
    def get_states_without_ctc(cls) -> List[str]:
        """Return list of states without existing CTCs."""
        return [s for s in ALL_STATES if s not in EXISTING_STATE_CTCS]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self.config)

    def get_reform_parameters(self) -> Dict[str, Any]:
        """Get the PolicyEngine parameter changes for this reform."""
        from cpid_calc.reforms.builder import _build_state_ctc_reform
        from cpid_calc.reforms.config import ReformConfig

        config = ReformConfig(state_ctc=self.config)
        return _build_state_ctc_reform(config)
