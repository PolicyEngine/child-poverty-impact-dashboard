"""
Convert reform configurations to PolicyEngine API format.

The PolicyEngine API expects reforms as:
{
    "parameter.path.here": {
        "YYYY-MM-DD": value
    }
}
"""

from typing import Any, Dict, List, Optional

from cpid_calc.reforms.eitc_reforms import get_eitc_reform_for_state


def reform_options_to_policyengine_format(
    reform_option_ids: List[str],
    state: str,
    year: int = 2025,
) -> Dict[str, Any]:
    """
    Convert selected reform option IDs to PolicyEngine API format.

    Args:
        reform_option_ids: List of selected reform option IDs
        state: State code (e.g., "NY", "CA")
        year: Tax year

    Returns:
        Dictionary in PolicyEngine reform format
    """
    from cpid_calc.reforms.state_aware import (
        get_reform_options_for_state,
        build_reform_from_options,
    )

    # Get all available options for the state
    all_options = get_reform_options_for_state(state.upper())

    # Filter to selected options
    selected = [
        o for o in all_options.all_options()
        if o.id in reform_option_ids
    ]

    if not selected:
        return {}

    # Build reform config from options
    config = build_reform_from_options(selected, state.upper(), year)

    # Convert to PolicyEngine format
    return reform_config_to_policyengine_format(config, year)


def reform_config_to_policyengine_format(
    config,  # ReformConfig
    year: int = 2025,
) -> Dict[str, Any]:
    """
    Convert a ReformConfig to PolicyEngine API format.

    Args:
        config: ReformConfig object
        year: Tax year

    Returns:
        Dictionary in PolicyEngine reform format
    """
    reform = {}
    date_key = f"{year}-01-01"

    # CTC reforms
    if config.ctc.enabled:
        # Refundability
        if config.ctc.refundable:
            reform["gov.irs.credits.ctc.refundable.fully_refundable"] = {
                date_key: True
            }

        # Phaseout thresholds
        reform["gov.irs.credits.ctc.phase_out.threshold.SINGLE"] = {
            date_key: config.ctc.phaseout_start_single
        }
        reform["gov.irs.credits.ctc.phase_out.threshold.JOINT"] = {
            date_key: config.ctc.phaseout_start_joint
        }
        reform["gov.irs.credits.ctc.phase_out.threshold.HEAD_OF_HOUSEHOLD"] = {
            date_key: config.ctc.phaseout_start_single
        }
        reform["gov.irs.credits.ctc.phase_out.threshold.SEPARATE"] = {
            date_key: config.ctc.phaseout_start_single
        }
        reform["gov.irs.credits.ctc.phase_out.threshold.SURVIVING_SPOUSE"] = {
            date_key: config.ctc.phaseout_start_joint
        }

    # Note: State CTC, EITC, SNAP, UBI reforms require specific parameter paths
    # that may vary. The PolicyEngine API will ignore unknown parameters.

    return reform


def create_expanded_ctc_reform(year: int = 2025) -> Dict[str, Any]:
    """
    Create reform for 2021-style expanded CTC.

    This matches the "Restore 2021 Expanded CTC" option:
    - $3,600 for children under 6
    - $3,000 for children 6-17
    - Fully refundable
    - Lower phaseout thresholds

    Returns:
        Dictionary in PolicyEngine reform format
    """
    # API expects year as string, not YYYY-MM-DD format
    year_key = str(year)

    return {
        # Make fully refundable
        "gov.irs.credits.ctc.refundable.fully_refundable": {
            year_key: True
        },
        # Lower phaseout thresholds (2021 ARPA levels)
        "gov.irs.credits.ctc.phase_out.threshold.SINGLE": {
            year_key: 75000
        },
        "gov.irs.credits.ctc.phase_out.threshold.JOINT": {
            year_key: 150000
        },
        "gov.irs.credits.ctc.phase_out.threshold.HEAD_OF_HOUSEHOLD": {
            year_key: 112500
        },
        "gov.irs.credits.ctc.phase_out.threshold.SEPARATE": {
            year_key: 75000
        },
        "gov.irs.credits.ctc.phase_out.threshold.SURVIVING_SPOUSE": {
            year_key: 150000
        },
    }


def create_universal_ctc_reform(year: int = 2025) -> Dict[str, Any]:
    """
    Create reform for universal CTC (no phaseout).

    Returns:
        Dictionary in PolicyEngine reform format
    """
    # API expects year as string, not YYYY-MM-DD format
    year_key = str(year)

    return {
        # Make fully refundable
        "gov.irs.credits.ctc.refundable.fully_refundable": {
            year_key: True
        },
        # Very high phaseout thresholds (effectively universal)
        "gov.irs.credits.ctc.phase_out.threshold.SINGLE": {
            year_key: 10000000  # $10M
        },
        "gov.irs.credits.ctc.phase_out.threshold.JOINT": {
            year_key: 10000000
        },
        "gov.irs.credits.ctc.phase_out.threshold.HEAD_OF_HOUSEHOLD": {
            year_key: 10000000
        },
        "gov.irs.credits.ctc.phase_out.threshold.SEPARATE": {
            year_key: 10000000
        },
        "gov.irs.credits.ctc.phase_out.threshold.SURVIVING_SPOUSE": {
            year_key: 10000000
        },
    }


# Mapping from our reform option IDs to pre-built reforms
PREDEFINED_REFORMS = {
    "federal_ctc_expanded": create_expanded_ctc_reform,
    "federal_ctc_universal": create_universal_ctc_reform,
}


def get_reform_for_option_ids(
    option_ids: List[str],
    state: str,
    year: int = 2025,
    parameter_values: Optional[Dict[str, Dict[str, float]]] = None,
) -> Dict[str, Any]:
    """
    Get PolicyEngine reform dictionary for given option IDs.

    Uses predefined reforms for known IDs. State EITC reforms use
    the contributed parameters from policyengine-us PR #7895.

    Args:
        option_ids: List of reform option IDs
        state: State code
        year: Tax year
        parameter_values: Optional dict mapping option_id -> {param_name: value}
                         For EITC, expects {"match_rate": 0-100}

    Returns:
        Combined reform dictionary in PolicyEngine format
    """
    combined_reform = {}
    parameter_values = parameter_values or {}

    for option_id in option_ids:
        if option_id in PREDEFINED_REFORMS:
            # Use predefined reform
            reform = PREDEFINED_REFORMS[option_id](year)
            combined_reform.update(reform)

        # Handle state EITC reforms
        elif _is_eitc_option(option_id):
            reform = _build_eitc_reform(option_id, state, year, parameter_values)
            if reform:
                combined_reform.update(reform)

    return combined_reform


def _is_eitc_option(option_id: str) -> bool:
    """Check if an option ID is for a state EITC reform."""
    # Match new format: {state}_eitc (e.g., "ny_eitc", "in_eitc")
    if option_id.endswith("_eitc") and len(option_id) == 7:  # 2-letter state + "_eitc"
        return True
    # Also match old formats for backwards compatibility
    eitc_patterns = [
        "_new_state_eitc",
        "_convert_eitc_refundable",
        "_adjust_eitc_match",
    ]
    return any(pattern in option_id for pattern in eitc_patterns)


def _build_eitc_reform(
    option_id: str,
    state: str,
    year: int,
    parameter_values: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    """
    Build EITC reform from option ID and parameter values.

    Args:
        option_id: The EITC option ID (e.g., "nc_new_state_eitc")
        state: State code
        year: Tax year
        parameter_values: Dict mapping option_id -> {param_name: value}

    Returns:
        Reform dictionary in PolicyEngine API format
    """
    # Extract state from option_id if not matching
    option_state = option_id.split("_")[0].upper()
    if option_state != state.upper():
        state = option_state

    # Get match rate from parameter_values or use default
    option_params = parameter_values.get(option_id, {})
    match_rate_percent = option_params.get("match_rate", 20)  # Default 20%
    match_rate = match_rate_percent / 100  # Convert to decimal

    # Use the eitc_reforms module to create the reform
    # Works for all states - contributed params for new/nonrefundable,
    # existing params for states with refundable EITCs
    return get_eitc_reform_for_state(state, match_rate, year)
