"""
Household situation builder for PolicyEngine simulations.

Converts HouseholdConfig objects into PolicyEngine situation dictionaries.
"""

from typing import Dict, Any, List
from cpid_calc.household.config import (
    HouseholdConfig,
    FilingStatus,
    AdultConfig,
    ChildConfig,
)


# Filing status mapping to PolicyEngine values
FILING_STATUS_MAP = {
    FilingStatus.SINGLE: "SINGLE",
    FilingStatus.MARRIED_FILING_JOINTLY: "JOINT",
    FilingStatus.MARRIED_FILING_SEPARATELY: "SEPARATE",
    FilingStatus.HEAD_OF_HOUSEHOLD: "HEAD_OF_HOUSEHOLD",
    FilingStatus.SURVIVING_SPOUSE: "SURVIVING_SPOUSE",
}


def build_household_situation(
    config: HouseholdConfig,
    year: int = None,
) -> Dict[str, Any]:
    """
    Build a PolicyEngine situation dictionary from HouseholdConfig.

    Args:
        config: Household configuration
        year: Tax year (defaults to config.year)

    Returns:
        Dictionary suitable for PolicyEngine Simulation
    """
    year = year or config.year

    # Initialize situation structure
    situation = {
        "people": {},
        "tax_units": {
            "tax_unit": {
                "members": [],
                "filing_status": {year: FILING_STATUS_MAP[config.filing_status]},
            }
        },
        "families": {
            "family": {
                "members": [],
            }
        },
        "spm_units": {
            "spm_unit": {
                "members": [],
            }
        },
        "households": {
            "household": {
                "members": [],
                "state_code_str": {year: config.state},
            }
        },
    }

    # Add rent/mortgage if applicable
    if config.rent_amount_monthly > 0:
        situation["households"]["household"]["rent"] = {
            year: config.rent_amount_monthly * 12
        }

    person_ids = []

    # Add adults
    for i, adult in enumerate(config.adults):
        person_id = f"adult_{i + 1}"
        person_ids.append(person_id)

        person_data = _build_adult_data(adult, config, year, i)
        situation["people"][person_id] = person_data

    # Add children
    for i, child in enumerate(config.children):
        person_id = f"child_{i + 1}"
        person_ids.append(person_id)

        person_data = _build_child_data(child, year)
        situation["people"][person_id] = person_data

    # Add all people to units
    situation["tax_units"]["tax_unit"]["members"] = person_ids
    situation["families"]["family"]["members"] = person_ids
    situation["spm_units"]["spm_unit"]["members"] = person_ids
    situation["households"]["household"]["members"] = person_ids

    # Add childcare expenses
    if config.total_childcare_expenses > 0:
        situation["tax_units"]["tax_unit"]["childcare_expenses"] = {
            year: config.total_childcare_expenses
        }

    return situation


def _build_adult_data(
    adult: AdultConfig,
    config: HouseholdConfig,
    year: int,
    adult_index: int,
) -> Dict[str, Any]:
    """Build person data for an adult."""
    data = {
        "age": {year: adult.age},
        "is_tax_unit_head": {year: adult.is_filer and adult_index == 0},
        "is_tax_unit_spouse": {year: config.is_married and adult_index == 1},
    }

    # Add income for primary earner
    if adult_index == 0:
        if config.income.employment_income > 0:
            data["employment_income"] = {year: config.income.employment_income}
        if config.income.self_employment_income > 0:
            data["self_employment_income"] = {year: config.income.self_employment_income}
        if config.income.social_security_income > 0:
            data["social_security"] = {year: config.income.social_security_income}
        if config.income.unemployment_income > 0:
            data["unemployment_compensation"] = {year: config.income.unemployment_income}
        if config.income.investment_income > 0:
            data["interest_income"] = {year: config.income.investment_income}

    # Add income for spouse
    elif adult_index == 1:
        if config.income.spouse_employment_income > 0:
            data["employment_income"] = {year: config.income.spouse_employment_income}
        if config.income.spouse_self_employment_income > 0:
            data["self_employment_income"] = {year: config.income.spouse_self_employment_income}

    # Add disability status
    if adult.is_disabled:
        data["is_disabled"] = {year: True}
    if adult.is_blind:
        data["is_blind"] = {year: True}

    return data


def _build_child_data(child: ChildConfig, year: int) -> Dict[str, Any]:
    """Build person data for a child."""
    data = {
        "age": {year: child.age},
        "is_tax_unit_head": {year: False},
        "is_tax_unit_spouse": {year: False},
        "is_tax_unit_dependent": {year: True},
    }

    # Add disability/student status
    if child.is_disabled:
        data["is_disabled"] = {year: True}
    if child.is_student or child.is_in_school:
        data["is_full_time_student"] = {year: True}
    if child.is_in_college:
        data["is_full_time_college_student"] = {year: True}

    return data


def build_reform_situation(
    config: HouseholdConfig,
    reform_params: Dict[str, Any],
    year: int = None,
) -> Dict[str, Any]:
    """
    Build a situation dictionary with reform parameters applied.

    This is used for comparing baseline to reform scenarios.

    Args:
        config: Household configuration
        reform_params: Dictionary of reform parameter changes
        year: Tax year

    Returns:
        Situation dictionary with reform context
    """
    situation = build_household_situation(config, year)

    # Reform parameters would be applied via PolicyEngine's reform mechanism
    # not directly in the situation
    return situation


def build_income_sweep_situations(
    base_config: HouseholdConfig,
    income_range: List[float],
    year: int = None,
) -> List[Dict[str, Any]]:
    """
    Build multiple situations for an income sweep analysis.

    Args:
        base_config: Base household configuration
        income_range: List of income values to sweep through
        year: Tax year

    Returns:
        List of situation dictionaries
    """
    situations = []

    for income in income_range:
        # Create copy of config with new income
        config_copy = HouseholdConfig.from_dict(base_config.to_dict())
        config_copy.income.employment_income = income

        situation = build_household_situation(config_copy, year)
        situations.append(situation)

    return situations


def validate_situation(situation: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Validate a situation dictionary for common issues.

    Returns:
        Dictionary with 'errors' and 'warnings' lists
    """
    errors = []
    warnings = []

    # Check required fields
    if "people" not in situation or not situation["people"]:
        errors.append("Situation must have at least one person")

    if "households" not in situation or not situation["households"]:
        errors.append("Situation must have a household")

    # Check for household members
    for hh_name, hh_data in situation.get("households", {}).items():
        if "members" not in hh_data or not hh_data["members"]:
            errors.append(f"Household '{hh_name}' has no members")

        if "state_code_str" not in hh_data:
            errors.append(f"Household '{hh_name}' missing state_code_str")

    # Check people exist
    people_ids = set(situation.get("people", {}).keys())
    for unit_type in ["tax_units", "families", "spm_units", "households"]:
        for unit_name, unit_data in situation.get(unit_type, {}).items():
            for member in unit_data.get("members", []):
                if member not in people_ids:
                    errors.append(f"Member '{member}' in {unit_type}.{unit_name} not found in people")

    # Check for tax unit head
    tax_unit = situation.get("tax_units", {}).get("tax_unit", {})
    members = tax_unit.get("members", [])
    has_head = False
    for member in members:
        person = situation.get("people", {}).get(member, {})
        if any(person.get("is_tax_unit_head", {}).values()):
            has_head = True
            break
    if not has_head and members:
        warnings.append("Tax unit has no designated head")

    return {"errors": errors, "warnings": warnings}
