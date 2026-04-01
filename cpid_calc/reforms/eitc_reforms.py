"""PolicyEngine reform definitions for state EITC scenarios.

This module creates EITC reforms using the contributed parameters from
policyengine-us PR #7895. These parameters allow creating or modifying
state EITCs without changing baseline law.

Parameter paths:
- gov.contrib.states.{st}.child_poverty_impact_dashboard.eitc.in_effect
- gov.contrib.states.{st}.child_poverty_impact_dashboard.eitc.match
"""

from typing import Dict, Any, Optional


def create_state_eitc_reform(
    state: str,
    match_rate: float = 0.20,
    year: int = 2026,
) -> Dict[str, Any]:
    """Create a state EITC reform using contributed parameters.

    This enables a refundable state EITC that matches a percentage of the
    federal EITC. Works for:
    - States without existing EITC (AL, AR, AZ, GA, ID, KY, MS, NC, ND, WV)
    - States with nonrefundable EITC (CO, MO, OH) - replaces with refundable

    Args:
        state: Two-letter state code (e.g., "NC", "GA")
        match_rate: Match rate as decimal (0.20 = 20% of federal EITC)
        year: Tax year for the reform

    Returns:
        Reform dictionary in PolicyEngine API format
    """
    st = state.lower()
    date_range = f"{year}-01-01.2100-12-31"

    return {
        f"gov.contrib.states.{st}.child_poverty_impact_dashboard.eitc.in_effect": {
            date_range: True
        },
        f"gov.contrib.states.{st}.child_poverty_impact_dashboard.eitc.match": {
            date_range: match_rate
        },
    }


def create_nc_eitc_reform(
    match_rate: float = 0.20,
    year: int = 2026,
) -> Dict[str, Any]:
    """Create North Carolina EITC reform.

    NC uses a slightly different parameter path than other states.

    Args:
        match_rate: Match rate as decimal (0.20 = 20% of federal EITC)
        year: Tax year for the reform

    Returns:
        Reform dictionary in PolicyEngine API format
    """
    date_range = f"{year}-01-01.2100-12-31"

    return {
        "gov.contrib.states.nc.eitc.in_effect": {
            date_range: True
        },
        "gov.contrib.states.nc.eitc.match": {
            date_range: match_rate
        },
    }


def create_existing_eitc_reform(
    state: str,
    match_rate: float = 0.30,
    year: int = 2026,
) -> Dict[str, Any]:
    """Create reform for states with existing refundable EITCs.

    This modifies the existing state EITC match rate using the standard
    parameter path (gov.states.{st}.tax.income.credits.eitc.match).

    Args:
        state: Two-letter state code (e.g., "NY", "NJ")
        match_rate: Match rate as decimal (0.30 = 30% of federal EITC)
        year: Tax year for the reform

    Returns:
        Reform dictionary in PolicyEngine API format
    """
    st = state.lower()
    date_range = f"{year}-01-01.2100-12-31"

    return {
        f"gov.states.{st}.tax.income.credits.eitc.match": {
            date_range: match_rate
        },
    }


def get_eitc_reform_for_state(
    state: str,
    match_rate: float,
    year: int = 2026,
) -> Dict[str, Any]:
    """Get the appropriate EITC reform for a state.

    Automatically selects the correct parameter path based on state:
    - States without EITC: Use contributed params
    - States with nonrefundable EITC: Use contributed params
    - States with refundable EITC: Modify existing match rate
    - NC: Uses special contributed param path

    Args:
        state: Two-letter state code
        match_rate: Match rate as decimal (0-1)
        year: Tax year

    Returns:
        Reform dictionary in PolicyEngine API format
    """
    st = state.upper()

    if st == "NC":
        return create_nc_eitc_reform(match_rate=match_rate, year=year)
    elif st in STATES_WITH_CPID_EITC_PARAMS:
        return create_state_eitc_reform(state=state, match_rate=match_rate, year=year)
    else:
        # States with existing refundable EITC - modify the match rate
        return create_existing_eitc_reform(state=state, match_rate=match_rate, year=year)


# States that use the child_poverty_impact_dashboard EITC params
STATES_WITH_CPID_EITC_PARAMS = [
    "AL", "AR", "AZ", "GA", "ID", "KY", "MS", "ND", "WV",  # No baseline EITC
    "CO", "MO", "OH",  # Nonrefundable baseline EITC
]

# NC uses a different path
STATES_WITH_NC_STYLE_PARAMS = ["NC"]

# All states that can use contributed EITC reforms
ALL_CONTRIB_EITC_STATES = STATES_WITH_CPID_EITC_PARAMS + STATES_WITH_NC_STYLE_PARAMS


def is_state_supported(state: str) -> bool:
    """Check if a state supports contributed EITC reforms."""
    return state.upper() in ALL_CONTRIB_EITC_STATES


def get_state_eitc_param_path(state: str) -> Optional[str]:
    """Get the parameter path prefix for a state's contributed EITC.

    Returns None if state doesn't use contributed params.
    """
    st = state.upper()
    if st == "NC":
        return "gov.contrib.states.nc.eitc"
    elif st in STATES_WITH_CPID_EITC_PARAMS:
        return f"gov.contrib.states.{st.lower()}.child_poverty_impact_dashboard.eitc"
    return None
