"""
API routes for state-specific data and comparisons.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException

from app.api.models.reforms import ReformRequest
from app.api.models.responses import (
    StateInfoResponse,
    StateComparisonResponse,
    StateResult,
    PovertyImpactResponse,
    FiscalCostResponse,
)

router = APIRouter()

# State information
STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
    "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
    "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}

# States with existing CTCs
EXISTING_STATE_CTCS = {
    "CA": {"amount": 1117, "age": "0-5"},
    "CO": {"amount": 1200, "age": "0-5"},
    "CT": {"amount": 250, "age": "0-17"},
    "ID": {"amount": 205, "age": "0-17"},
    "MA": {"amount": 440, "age": "0-17"},
    "MD": {"amount": 500, "age": "0-17"},
    "ME": {"amount": 300, "age": "0-17"},
    "MN": {"amount": 1750, "age": "0-17"},
    "NJ": {"amount": 1000, "age": "0-5"},
    "NM": {"amount": 600, "age": "0-17"},
    "NY": {"amount": 330, "age": "0-17"},
    "OK": {"amount": 100, "age": "0-17"},
    "OR": {"amount": 1000, "age": "0-5"},
    "RI": {"amount": 250, "age": "0-17"},
    "VT": {"amount": 1000, "age": "0-5"},
}

# States with EITCs
STATE_EITCS = {
    "CA": 85, "CO": 25, "CT": 30.5, "DC": 70, "DE": 20,
    "HI": 40, "IL": 20, "IN": 10, "IA": 15, "KS": 17,
    "LA": 5, "ME": 25, "MD": 50, "MA": 40, "MI": 30,
    "MN": 34, "MT": 10, "NE": 10, "NJ": 40, "NM": 25,
    "NY": 30, "OH": 30, "OK": 5, "OR": 12, "RI": 15,
    "SC": 125, "VT": 38, "VA": 20, "WA": 10, "WI": 18.4,
}


@router.get("/", response_model=List[StateInfoResponse])
async def get_all_states():
    """Get information about all states and their existing programs."""
    states = []
    for code, name in STATE_NAMES.items():
        ctc_info = EXISTING_STATE_CTCS.get(code)
        eitc_match = STATE_EITCS.get(code)

        states.append(StateInfoResponse(
            state_code=code,
            state_name=name,
            has_state_ctc=ctc_info is not None,
            existing_ctc_amount=ctc_info["amount"] if ctc_info else None,
            existing_ctc_age_eligibility=ctc_info["age"] if ctc_info else None,
            has_state_eitc=eitc_match is not None,
            state_eitc_match_percent=eitc_match,
        ))

    return states


@router.get("/{state_code}", response_model=StateInfoResponse)
async def get_state(state_code: str):
    """Get information about a specific state."""
    state_code = state_code.upper()
    if state_code not in STATE_NAMES:
        raise HTTPException(status_code=404, detail=f"State '{state_code}' not found")

    ctc_info = EXISTING_STATE_CTCS.get(state_code)
    eitc_match = STATE_EITCS.get(state_code)

    return StateInfoResponse(
        state_code=state_code,
        state_name=STATE_NAMES[state_code],
        has_state_ctc=ctc_info is not None,
        existing_ctc_amount=ctc_info["amount"] if ctc_info else None,
        existing_ctc_age_eligibility=ctc_info["age"] if ctc_info else None,
        has_state_eitc=eitc_match is not None,
        state_eitc_match_percent=eitc_match,
    )


@router.get("/with-ctc", response_model=List[StateInfoResponse])
async def get_states_with_ctc():
    """Get list of states that have existing CTCs."""
    states = []
    for code in EXISTING_STATE_CTCS.keys():
        ctc_info = EXISTING_STATE_CTCS[code]
        eitc_match = STATE_EITCS.get(code)

        states.append(StateInfoResponse(
            state_code=code,
            state_name=STATE_NAMES[code],
            has_state_ctc=True,
            existing_ctc_amount=ctc_info["amount"],
            existing_ctc_age_eligibility=ctc_info["age"],
            has_state_eitc=eitc_match is not None,
            state_eitc_match_percent=eitc_match,
        ))

    return states


@router.get("/without-ctc", response_model=List[StateInfoResponse])
async def get_states_without_ctc():
    """Get list of states that don't have existing CTCs."""
    states = []
    for code, name in STATE_NAMES.items():
        if code not in EXISTING_STATE_CTCS:
            eitc_match = STATE_EITCS.get(code)
            states.append(StateInfoResponse(
                state_code=code,
                state_name=name,
                has_state_ctc=False,
                existing_ctc_amount=None,
                existing_ctc_age_eligibility=None,
                has_state_eitc=eitc_match is not None,
                state_eitc_match_percent=eitc_match,
            ))

    return states


@router.post("/compare", response_model=StateComparisonResponse)
async def compare_states(reform: ReformRequest, states: Optional[List[str]] = None):
    """
    Compare reform impacts across multiple states.

    If no states provided, compares all 50 states + DC.
    """
    try:
        from cpid_calc.calculations.impact import calculate_poverty_impact_by_state
        from cpid_calc.calculations.fiscal import calculate_fiscal_cost_by_state
        from app.api.routes.analysis import convert_reform_request_to_config

        config = convert_reform_request_to_config(reform)

        # Get state-by-state results
        poverty_results = calculate_poverty_impact_by_state(config, config.year)
        fiscal_results = calculate_fiscal_cost_by_state(config, config.year)

        # Filter to requested states if specified
        target_states = [s.upper() for s in states] if states else list(STATE_NAMES.keys())

        state_results = []
        for state in target_states:
            if state in poverty_results and state in fiscal_results:
                state_results.append(StateResult(
                    state_code=state,
                    state_name=STATE_NAMES.get(state, state),
                    poverty_impact=PovertyImpactResponse(**poverty_results[state].to_dict()),
                    fiscal_cost=FiscalCostResponse(**fiscal_results[state].to_dict()),
                ))

        # Calculate national aggregates
        from cpid_calc.calculations.impact import calculate_poverty_impact
        from cpid_calc.calculations.fiscal import calculate_fiscal_cost

        national_poverty = calculate_poverty_impact(config, None, config.year)
        national_fiscal = calculate_fiscal_cost(config, None, config.year)

        # Sort states by poverty reduction and cost effectiveness
        states_by_poverty = sorted(
            state_results,
            key=lambda x: x.poverty_impact.child_poverty_percent_change,
        )
        states_by_cost = sorted(
            state_results,
            key=lambda x: x.fiscal_cost.cost_per_child_lifted_from_poverty
            if x.fiscal_cost.cost_per_child_lifted_from_poverty < float('inf') else 1e12,
        )

        return StateComparisonResponse(
            reform_name=reform.name,
            year=reform.year,
            states=state_results,
            national_poverty_impact=PovertyImpactResponse(**national_poverty.to_dict()),
            national_fiscal_cost=FiscalCostResponse(**national_fiscal.to_dict()),
            states_by_poverty_reduction=[s.state_code for s in states_by_poverty[:10]],
            states_by_cost_effectiveness=[s.state_code for s in states_by_cost[:10]],
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"State comparison failed: {str(e)}")
