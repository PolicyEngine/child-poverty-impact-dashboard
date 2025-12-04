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


def create_reform(config: ReformConfig) -> Reform:
    """
    Create a PolicyEngine Reform object from a ReformConfig.

    This function builds the reform by composing all enabled policy changes
    into a single Reform object that can be applied to a Microsimulation.

    Args:
        config: ReformConfig containing all policy parameters

    Returns:
        A PolicyEngine Reform object
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


def create_reform_from_dict(reform_dict: Dict[str, Any], year: int) -> Reform:
    """
    Create a PolicyEngine Reform from a parameter dictionary.

    Args:
        reform_dict: Dictionary of parameter changes
        year: The year for which reforms should apply

    Returns:
        A PolicyEngine Reform object
    """
    def reform_fn(parameters):
        for param_path, value in reform_dict.items():
            try:
                param = parameters
                parts = param_path.split(".")
                for part in parts[:-1]:
                    param = getattr(param, part)
                # Set the value for the target year and beyond
                param_final = getattr(param, parts[-1])
                param_final.update(period=f"year:{year}:10", value=value)
            except AttributeError:
                # Parameter doesn't exist in current PolicyEngine version
                continue
        return parameters

    return Reform.from_dict({"gov": reform_fn}) if reform_dict else Reform()


def _build_ctc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build CTC reform parameters."""
    ctc = config.ctc
    reform = {}

    # Set CTC amounts based on age eligibility
    if ctc.age_eligibility in [AgeEligibility.PRENATAL_3, AgeEligibility.AGES_0_5]:
        # Enhanced young child credit
        reform["gov.irs.credits.ctc.amount.young_child"] = ctc.amount_young
        reform["gov.irs.credits.ctc.amount.older_child"] = ctc.amount_older
    else:
        # Standard age structure
        reform["gov.irs.credits.ctc.amount.young_child"] = ctc.amount_young
        reform["gov.irs.credits.ctc.amount.older_child"] = ctc.amount_older

    # Set refundability
    if ctc.refundable:
        if ctc.refundable_amount is not None:
            reform["gov.irs.credits.ctc.refundable.amount"] = ctc.refundable_amount
        else:
            # Fully refundable - set refundable amount equal to max credit
            reform["gov.irs.credits.ctc.refundable.fully_refundable"] = True

    # Set phaseout parameters
    reform["gov.irs.credits.ctc.phase_out.start.single"] = ctc.phaseout_start_single
    reform["gov.irs.credits.ctc.phase_out.start.joint"] = ctc.phaseout_start_joint
    reform["gov.irs.credits.ctc.phase_out.rate"] = ctc.phaseout_rate

    return reform


def _build_eitc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build EITC reform parameters."""
    eitc = config.eitc
    reform = {}

    if eitc.expansion_percent > 0:
        # This would require getting current values and scaling
        # Placeholder for actual implementation
        reform["gov.irs.credits.eitc.expansion_factor"] = 1 + (eitc.expansion_percent / 100)

    if eitc.individualized:
        reform["gov.irs.credits.eitc.individual_basis"] = True

    if eitc.childless_expansion:
        reform["gov.irs.credits.eitc.childless.max"] = 1500  # Example value

    if eitc.age_floor_reduction > 0:
        reform["gov.irs.credits.eitc.eligibility.age.min"] = 25 - eitc.age_floor_reduction

    if eitc.age_ceiling_increase > 0:
        reform["gov.irs.credits.eitc.eligibility.age.max"] = 65 + eitc.age_ceiling_increase

    return reform


def _build_dependent_exemption_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build dependent exemption reform parameters."""
    dep = config.dependent_exemption
    reform = {}

    reform["gov.irs.deductions.personal_exemption.amount"] = dep.amount_per_dependent

    if dep.refundable:
        reform["gov.irs.deductions.personal_exemption.refundable"] = True

    if dep.income_limit_single is not None:
        reform["gov.irs.deductions.personal_exemption.phase_out.start.single"] = dep.income_limit_single

    if dep.income_limit_joint is not None:
        reform["gov.irs.deductions.personal_exemption.phase_out.start.joint"] = dep.income_limit_joint

    return reform


def _build_ubi_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build UBI/Child Allowance reform parameters."""
    ubi = config.ubi
    reform = {}

    # These are custom parameters that would need to be added to PolicyEngine
    # or implemented as a custom variable
    reform["gov.contrib.ubi.amount.child"] = ubi.amount_per_child
    reform["gov.contrib.ubi.amount.adult"] = ubi.amount_per_adult

    if ubi.phase_out_with_income:
        reform["gov.contrib.ubi.phase_out.start"] = ubi.phaseout_start
        reform["gov.contrib.ubi.phase_out.rate"] = ubi.phaseout_rate

    return reform


def _build_snap_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build SNAP reform parameters."""
    snap = config.snap
    reform = {}

    if snap.benefit_increase_percent > 0:
        reform["gov.usda.snap.benefit_factor"] = 1 + (snap.benefit_increase_percent / 100)

    if snap.expand_eligibility_percent > 0:
        reform["gov.usda.snap.income_limit_factor"] = 1 + (snap.expand_eligibility_percent / 100)

    if snap.remove_asset_test:
        reform["gov.usda.snap.asset_test.enabled"] = False

    if snap.increase_child_allotment > 0:
        reform["gov.usda.snap.child_allotment.additional"] = snap.increase_child_allotment

    return reform


def _build_state_ctc_reform(config: ReformConfig) -> Dict[str, Any]:
    """Build state-level CTC reform parameters."""
    state_ctc = config.state_ctc
    reform = {}

    state = state_ctc.state.lower()

    # State CTC parameters (these would be state-specific)
    reform[f"gov.states.{state}.tax.credits.ctc.amount.young_child"] = state_ctc.amount_young
    reform[f"gov.states.{state}.tax.credits.ctc.amount.older_child"] = state_ctc.amount_older

    if state_ctc.income_limit is not None:
        reform[f"gov.states.{state}.tax.credits.ctc.phase_out.start"] = state_ctc.income_limit

    reform[f"gov.states.{state}.tax.credits.ctc.refundable"] = state_ctc.refundable

    if state_ctc.matches_federal:
        reform[f"gov.states.{state}.tax.credits.ctc.match_federal"] = True
        reform[f"gov.states.{state}.tax.credits.ctc.match_percent"] = state_ctc.match_percent

    return reform
