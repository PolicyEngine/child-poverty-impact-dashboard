"""
Dynamic EITC information fetcher.

Fetches state EITC rates and configuration directly from policyengine-us
parameters, avoiding hardcoded values that can become stale.
"""

from typing import Dict, List
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class StateEITCInfo:
    """EITC information for a state."""
    state_code: str
    has_baseline_eitc: bool  # Has EITC in current law
    match_rate: float  # Current match rate (0-1)
    refundable: bool
    uses_contrib_params: bool  # Needs contributed params for reforms
    param_path: str  # PolicyEngine parameter path
    notes: str = ""


# States known to use contributed params for new/modified EITC
STATES_USING_CONTRIB_PARAMS = [
    "AL", "AR", "AZ", "GA", "ID", "KY", "MS", "NC", "ND", "WV",  # No EITC
    "CO", "MO", "OH",  # Nonrefundable only
]


@lru_cache(maxsize=1)
def _get_tax_benefit_system():
    """Get cached tax benefit system instance."""
    from policyengine_us import CountryTaxBenefitSystem
    return CountryTaxBenefitSystem()


def get_state_eitc_info(state_code: str, year: int = 2026) -> StateEITCInfo:
    """
    Fetch EITC information for a state from policyengine-us.

    Args:
        state_code: Two-letter state code
        year: Tax year

    Returns:
        StateEITCInfo with EITC details
    """
    system = _get_tax_benefit_system()
    params = system.parameters
    st = state_code.lower()
    date = f"{year}-01-01"

    # Check if state has baseline EITC params with match rate
    try:
        state_params = getattr(params.gov.states, st)
        eitc_params = state_params.tax.income.credits.eitc

        # Standard match rate structure
        if hasattr(eitc_params, 'match'):
            match = eitc_params.match
            if callable(match):
                rate = match(date)
                refundable = True
                if hasattr(eitc_params, 'refundable'):
                    try:
                        refundable = eitc_params.refundable.in_effect(date)
                    except:
                        pass

                return StateEITCInfo(
                    state_code=state_code.upper(),
                    has_baseline_eitc=True,
                    match_rate=rate,
                    refundable=refundable,
                    uses_contrib_params=state_code.upper() in STATES_USING_CONTRIB_PARAMS,
                    param_path=f"gov.states.{st}.tax.income.credits.eitc.match",
                )
            elif hasattr(match, 'with_children'):
                rate = match.with_children(date)
                return StateEITCInfo(
                    state_code=state_code.upper(),
                    has_baseline_eitc=True,
                    match_rate=rate,
                    refundable=True,
                    uses_contrib_params=False,
                    param_path=f"gov.states.{st}.tax.income.credits.eitc.match.with_children",
                    notes="Has separate rates with/without children",
                )

        # DC-style: eitc.with_children.match
        if hasattr(eitc_params, 'with_children'):
            wc = eitc_params.with_children
            if hasattr(wc, 'match'):
                rate = wc.match(date)
                return StateEITCInfo(
                    state_code=state_code.upper(),
                    has_baseline_eitc=True,
                    match_rate=rate,
                    refundable=True,
                    uses_contrib_params=False,
                    param_path=f"gov.states.{st}.tax.income.credits.eitc.with_children.match",
                    notes="100% match for filers with children",
                )
    except (AttributeError, KeyError):
        pass

    # Special case: California CalEITC (uses fixed amounts, not match rate)
    if st == "ca":
        try:
            params.gov.states.ca.tax.income.credits.earned_income
            return StateEITCInfo(
                state_code="CA",
                has_baseline_eitc=True,
                match_rate=0,
                refundable=True,
                uses_contrib_params=False,
                param_path="gov.states.ca.tax.income.credits.earned_income",
                notes="CalEITC uses fixed amounts, not federal match",
            )
        except (AttributeError, KeyError):
            pass

    # Check for contributed EITC params - path 1
    try:
        contrib = params.gov.contrib.states
        state_contrib = getattr(contrib, st, None)
        if state_contrib and hasattr(state_contrib, 'child_poverty_impact_dashboard'):
            cpid = state_contrib.child_poverty_impact_dashboard
            if hasattr(cpid, 'eitc'):
                eitc = cpid.eitc
                match_rate = 0
                if hasattr(eitc, 'match'):
                    match_rate = eitc.match(date)

                return StateEITCInfo(
                    state_code=state_code.upper(),
                    has_baseline_eitc=False,
                    match_rate=match_rate,
                    refundable=True,
                    uses_contrib_params=True,
                    param_path=f"gov.contrib.states.{st}.child_poverty_impact_dashboard.eitc",
                    notes="Uses contributed reform parameters",
                )
    except (AttributeError, KeyError):
        pass

    # Check for contributed EITC params - path 2 (NC style)
    try:
        contrib = params.gov.contrib.states
        state_contrib = getattr(contrib, st, None)
        if state_contrib and hasattr(state_contrib, 'eitc'):
            eitc = state_contrib.eitc
            match_rate = 0
            if hasattr(eitc, 'match'):
                match_rate = eitc.match(date)

            return StateEITCInfo(
                state_code=state_code.upper(),
                has_baseline_eitc=False,
                match_rate=match_rate,
                refundable=True,
                uses_contrib_params=True,
                param_path=f"gov.contrib.states.{st}.eitc",
                notes="Uses contributed reform parameters",
            )
    except (AttributeError, KeyError):
        pass

    # State has no EITC infrastructure
    return StateEITCInfo(
        state_code=state_code.upper(),
        has_baseline_eitc=False,
        match_rate=0,
        refundable=False,
        uses_contrib_params=False,
        param_path="",
        notes="No EITC parameters available",
    )


def get_all_state_eitc_info(year: int = 2026) -> Dict[str, StateEITCInfo]:
    """Get EITC info for all states."""
    ALL_STATES = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
        "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
        "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
        "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
        "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    ]
    return {st: get_state_eitc_info(st, year) for st in ALL_STATES}


def get_states_with_baseline_eitc(year: int = 2026) -> List[str]:
    """Get list of states with EITC in baseline law."""
    all_info = get_all_state_eitc_info(year)
    return [st for st, info in all_info.items() if info.has_baseline_eitc]


def get_states_needing_contrib_params(year: int = 2026) -> List[str]:
    """Get list of states that need contributed params for EITC reforms."""
    all_info = get_all_state_eitc_info(year)
    return [st for st, info in all_info.items() if info.uses_contrib_params]
