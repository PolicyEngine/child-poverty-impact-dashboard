"""
Reform builder - creates PolicyEngine reform objects from configuration.
"""

from typing import Any, Dict, Optional

import policyengine as pe
from policyengine_core.reforms import Reform

from cpid_calc.reforms.config import (
    ReformConfig,
    AgeEligibility,
    IncomeBasis,
    PhaseoutStructure,
)


def _get_us_parameters():
    """Return the PolicyEngine US parameter tree through policyengine.py."""
    return pe.us.model._load_system().parameters


def create_reform(config: ReformConfig) -> Optional[Reform]:
    """
    Create a PolicyEngine Reform object from a ReformConfig.

    This function builds the reform by composing all enabled policy changes
    into a single Reform object that can be applied to a microsimulation.

    Args:
        config: ReformConfig containing all policy parameters

    Returns:
        A PolicyEngine Reform object, or None if no reforms are specified
    """
    reform_dict = {}

    if config.ctc.enabled:
        reform_dict.update(_build_ctc_reform(config))

    if config.eitc.enabled:
        reform_dict.update(_build_eitc_reform(config))

    if config.dependent_exemption.enabled:
        reform_dict.update(_build_dependent_exemption_reform(config))

    if config.ubi.enabled:
        reform_dict.update(_build_ubi_reform(config))

    if config.snap.enabled:
        reform_dict.update(_build_snap_reform(config))

    if config.state_ctc.enabled:
        reform_dict.update(_build_state_ctc_reform(config))

    if config.state_eitc.enabled:
        reform_dict.update(_build_state_eitc_reform(config))

    return create_reform_from_dict(reform_dict, config.year)


def create_reform_from_dict(reform_dict: Dict[str, Any], year: int) -> Optional[Reform]:
    """
    Create a PolicyEngine Reform from a parameter dictionary.

    Args:
        reform_dict: Dictionary of parameter changes
        year: The year for which reforms should apply

    Returns:
        A PolicyEngine Reform object, or None if reform_dict is empty
    """
    if not reform_dict:
        return None

    # Convert to PolicyEngine's expected format: {param_path: {date: value}}
    # Use a date range from the target year far into the future
    date_key = f"{year}-01-01"

    formatted_dict = {}
    for param_path, value in reform_dict.items():
        formatted_dict[param_path] = {date_key: value}

    return Reform.from_dict(formatted_dict)


def _build_ctc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build CTC reform parameters using valid PolicyEngine paths."""
    ctc = config.ctc
    reform = {}
    period = f"{config.year}-01-01"
    parameters = _get_us_parameters()
    current_base_amount = parameters.gov.irs.credits.ctc.amount.base[0].amount(period)

    # Set refundability - this is a valid parameter
    if ctc.refundable:
        reform["gov.irs.credits.ctc.refundable.fully_refundable"] = True

    if ctc.refundable_amount is not None:
        reform["gov.irs.credits.ctc.refundable.individual_max"] = (
            ctc.refundable_amount
        )

    if ctc.amount_young or ctc.amount_older:
        young_amount = ctc.amount_young or current_base_amount
        older_amount = ctc.amount_older or current_base_amount

        if young_amount == older_amount:
            reform["gov.irs.credits.ctc.amount.base[0].amount"] = young_amount
        else:
            reform["gov.irs.credits.ctc.amount.arpa[0].amount"] = young_amount
            reform["gov.irs.credits.ctc.amount.arpa[1].amount"] = older_amount
            reform["gov.irs.credits.ctc.phase_out.arpa.in_effect"] = True

    # Set phaseout thresholds - these are valid parameters
    reform["gov.irs.credits.ctc.phase_out.threshold.SINGLE"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.JOINT"] = ctc.phaseout_start_joint
    reform["gov.irs.credits.ctc.phase_out.threshold.HEAD_OF_HOUSEHOLD"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.SEPARATE"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.SURVIVING_SPOUSE"] = ctc.phaseout_start_joint

    return reform


def _build_eitc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build EITC reform parameters using valid PolicyEngine paths."""
    eitc = config.eitc
    reform = {}
    period = f"{config.year}-01-01"
    parameters = _get_us_parameters().gov.irs.credits.eitc

    if eitc.age_floor_reduction:
        reform["gov.irs.credits.eitc.eligibility.age.min"] = (
            25 - eitc.age_floor_reduction
        )

    if eitc.age_ceiling_increase:
        reform["gov.irs.credits.eitc.eligibility.age.max"] = (
            65 + eitc.age_ceiling_increase
        )

    expansion_factor = 1 + eitc.expansion_percent / 100
    if eitc.expansion_percent:
        for child_count in range(4):
            reform[f"gov.irs.credits.eitc.max[{child_count}].amount"] = (
                parameters.max[child_count].amount(period) * expansion_factor
            )
            reform[f"gov.irs.credits.eitc.phase_in_rate[{child_count}].amount"] = (
                parameters.phase_in_rate[child_count].amount(period)
                * expansion_factor
            )

    if eitc.childless_expansion:
        reform.setdefault("gov.irs.credits.eitc.eligibility.age.min", 19)
        reform.setdefault("gov.irs.credits.eitc.eligibility.age.max", 67)
        reform["gov.irs.credits.eitc.max[0].amount"] = max(
            reform.get(
                "gov.irs.credits.eitc.max[0].amount",
                parameters.max[0].amount(period),
            ),
            1_502,
        )
        reform["gov.irs.credits.eitc.phase_in_rate[0].amount"] = max(
            reform.get(
                "gov.irs.credits.eitc.phase_in_rate[0].amount",
                parameters.phase_in_rate[0].amount(period),
            ),
            0.153,
        )
        reform["gov.irs.credits.eitc.phase_out.rate[0].amount"] = max(
            parameters.phase_out.rate[0].amount(period),
            0.153,
        )
        reform["gov.irs.credits.eitc.phase_out.start[0].amount"] = max(
            parameters.phase_out.start[0].amount(period),
            11_610,
        )

    return reform


def _build_dependent_exemption_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build dependent exemption reform parameters."""
    dep = config.dependent_exemption
    reform = {}

    # Note: Personal/dependent exemptions were eliminated by TCJA in 2018
    # and the parameter paths may not exist in current PolicyEngine.
    # This builder is kept for potential future use or historical analysis.

    return reform


def _build_ubi_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build UBI/Child Allowance reform parameters."""
    ubi = config.ubi
    reform = {}

    # UBI/Child Allowance parameters are custom contributions that may not
    # exist in standard PolicyEngine. These would need custom variables
    # defined in the PolicyEngine model.
    #
    # For now, UBI reforms are not supported through the standard reform
    # builder. To implement child allowances, custom PolicyEngine variables
    # would need to be created.

    return reform


def _build_snap_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build SNAP reform parameters using valid PolicyEngine paths."""
    snap = config.snap
    reform = {}

    # SNAP reforms are limited to parameters that actually exist in PolicyEngine
    # Most SNAP parameters use complex structures for benefit calculations

    # Note: SNAP benefit amounts and eligibility are determined by complex
    # formulas. Simple multiplier parameters may not exist in the current
    # PolicyEngine structure. The reform options should describe what
    # can actually be modified.

    return reform


def _build_state_ctc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build state-level CTC reform parameters."""
    state_ctc = config.state_ctc
    reform = {}
    # State CTCs have varying parameter structures - not yet implemented
    return reform


def _build_state_eitc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build state EITC reform using eitc_reforms.json parameter paths."""
    import json
    import os

    state_eitc = config.state_eitc
    reform = {}
    state = state_eitc.state.upper()
    match_rate = state_eitc.match_rate

    # Load EITC parameter paths from JSON
    json_path = os.path.join(os.path.dirname(__file__), "eitc_reforms.json")
    with open(json_path) as f:
        eitc_params = json.load(f)

    state_config = eitc_params.get(state)
    if state_config is None:
        return reform  # No income tax state

    if state_config["type"] == "contrib":
        # Use contrib params to create/modify refundable EITC
        reform[state_config["in_effect"]] = True
        reform[state_config["match"]] = match_rate

        # Zero out nonrefundable EITC if it exists
        if "zero_out" in state_config and match_rate > 0:
            reform[state_config["zero_out"]] = 0
    else:
        # Modify existing state EITC match rate
        reform[state_config["match"]] = match_rate

    return reform
