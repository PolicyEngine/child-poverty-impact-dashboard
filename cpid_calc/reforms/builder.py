"""
Reform builder - creates PolicyEngine reform objects from configuration.
"""

from typing import Dict, Any, Optional
from policyengine_us import Microsimulation
from policyengine_core.reforms import Reform

from cpid_calc.reforms.config import (
    ReformConfig,
    AgeEligibility,
    IncomeBasis,
    PhaseoutStructure,
)


def create_reform(config: ReformConfig) -> Optional[Reform]:
    """
    Create a PolicyEngine Reform object from a ReformConfig.

    This function builds the reform by composing all enabled policy changes
    into a single Reform object that can be applied to a Microsimulation.

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

    # Set refundability - this is a valid parameter
    if ctc.refundable:
        reform["gov.irs.credits.ctc.refundable.fully_refundable"] = True

    # Set phaseout thresholds - these are valid parameters
    reform["gov.irs.credits.ctc.phase_out.threshold.SINGLE"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.JOINT"] = ctc.phaseout_start_joint
    reform["gov.irs.credits.ctc.phase_out.threshold.HEAD_OF_HOUSEHOLD"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.SEPARATE"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.threshold.SURVIVING_SPOUSE"] = ctc.phaseout_start_joint

    # Note: CTC amounts use a ParameterScale structure (amount by age bracket)
    # which requires more complex modification. For now, we focus on
    # refundability and phaseout changes which have the biggest impact.
    # Full amount changes would require modifying the scale brackets.

    return reform


def _build_eitc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build EITC reform parameters using valid PolicyEngine paths."""
    eitc = config.eitc
    reform = {}

    # EITC uses complex ParameterScale structures for max amounts and rates
    # Most EITC parameters require modifying scale brackets, which is not
    # straightforward with simple parameter updates.
    #
    # For now, EITC reforms through this builder are limited.
    # The reform options system should provide accurate descriptions
    # of what can actually be modified.

    # Age eligibility changes could be done if the parameters exist:
    # - gov.irs.credits.eitc.eligibility.age.min
    # - gov.irs.credits.eitc.eligibility.age.max

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
    """Build state-level CTC reform parameters.

    Note: State CTC parameter structures vary significantly by state.
    Each state has unique parameter paths based on how their CTC is
    structured in PolicyEngine. For example:
    - NY: gov.states.ny.tax.income.credits.ctc.amount.percent
    - MD: gov.states.md.tax.income.credits.ctc.amount
    etc.

    This builder currently does not support arbitrary state CTC changes
    as it would require state-specific parameter path mappings.
    """
    state_ctc = config.state_ctc
    reform = {}
    state = state_ctc.state.lower()

    # State CTCs have varying parameter structures.
    # For now, we attempt common patterns but may not cover all states.
    # The reform will still run but without state CTC modifications.

    return reform
