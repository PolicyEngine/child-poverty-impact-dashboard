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
) -> Dict[str, Any]:
    """
    Get PolicyEngine reform dictionary for given option IDs.

    Uses predefined reforms for known IDs. Unknown IDs are skipped
    (they may be state-specific options that aren't yet mapped to
    PolicyEngine parameters).

    Args:
        option_ids: List of reform option IDs
        state: State code
        year: Tax year

    Returns:
        Combined reform dictionary in PolicyEngine format
    """
    combined_reform = {}

    for option_id in option_ids:
        if option_id in PREDEFINED_REFORMS:
            # Use predefined reform
            reform = PREDEFINED_REFORMS[option_id](year)
            combined_reform.update(reform)
        # Note: Unknown option IDs are skipped since they may require
        # state-specific parameter mappings that aren't yet implemented

    return combined_reform
