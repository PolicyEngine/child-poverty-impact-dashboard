"""
State-aware reform options.

Generates available reform options based on what programs a state already has,
filling in gaps with new program options and enhancement opportunities.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum

from cpid_calc.data.state_programs import (
    get_state_programs,
    StatePrograms,
    STATE_PROGRAMS,
)
from cpid_calc.reforms.config import (
    ReformConfig,
    CTCConfig,
    EITCConfig,
    SNAPConfig,
    UBIConfig,
    StateCTCConfig,
    AgeEligibility,
)


class ReformCategory(str, Enum):
    """Categories of reform options."""
    STATE_CTC = "state_ctc"
    STATE_EITC = "state_eitc"
    FEDERAL_CTC = "federal_ctc"
    FEDERAL_EITC = "federal_eitc"
    SNAP = "snap"
    CHILD_ALLOWANCE = "child_allowance"
    NEW_PROGRAM = "new_program"
    ENHANCEMENT = "enhancement"


@dataclass
class AdjustableParameter:
    """A parameter that users can adjust via slider or input."""
    name: str
    label: str
    min_value: float
    max_value: float
    default_value: float
    step: float = 1.0
    unit: str = ""  # e.g., "%", "$"
    description: str = ""


@dataclass
class ReformOption:
    """A single reform option that can be presented to users."""
    id: str
    name: str
    description: str
    category: ReformCategory
    is_new_program: bool  # True if state doesn't have this program
    is_enhancement: bool  # True if enhancing existing program

    # For display
    estimated_household_impact: Optional[float] = None  # $ per year
    estimated_state_cost: Optional[float] = None  # $ millions

    # Reform configuration
    reform_config: Optional[Dict[str, Any]] = None

    # Parameters users can customize (old style - string list)
    customizable_params: List[str] = field(default_factory=list)

    # New: Adjustable parameters with ranges
    adjustable_params: List[AdjustableParameter] = field(default_factory=list)

    # Whether this is a "configurable" option with slider
    is_configurable: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "is_new_program": self.is_new_program,
            "is_enhancement": self.is_enhancement,
            "estimated_household_impact": self.estimated_household_impact,
            "estimated_state_cost": self.estimated_state_cost,
            "customizable_params": self.customizable_params,
            "is_configurable": self.is_configurable,
            "adjustable_params": [
                {
                    "name": p.name,
                    "label": p.label,
                    "min_value": p.min_value,
                    "max_value": p.max_value,
                    "default_value": p.default_value,
                    "step": p.step,
                    "unit": p.unit,
                    "description": p.description,
                }
                for p in self.adjustable_params
            ],
        }


@dataclass
class StateReformOptions:
    """All reform options available for a state."""
    state_code: str
    state_name: str
    has_income_tax: bool

    # Current programs summary
    existing_programs: Dict[str, bool] = field(default_factory=dict)

    # Available reforms by category
    ctc_options: List[ReformOption] = field(default_factory=list)
    eitc_options: List[ReformOption] = field(default_factory=list)
    snap_options: List[ReformOption] = field(default_factory=list)
    child_allowance_options: List[ReformOption] = field(default_factory=list)
    federal_options: List[ReformOption] = field(default_factory=list)

    def all_options(self) -> List[ReformOption]:
        """Get all reform options."""
        return (
            self.ctc_options +
            self.eitc_options +
            self.snap_options +
            self.child_allowance_options +
            self.federal_options
        )

    def new_program_options(self) -> List[ReformOption]:
        """Get only new program options."""
        return [o for o in self.all_options() if o.is_new_program]

    def enhancement_options(self) -> List[ReformOption]:
        """Get only enhancement options."""
        return [o for o in self.all_options() if o.is_enhancement]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "state_code": self.state_code,
            "state_name": self.state_name,
            "has_income_tax": self.has_income_tax,
            "existing_programs": self.existing_programs,
            "ctc_options": [o.to_dict() for o in self.ctc_options],
            "eitc_options": [o.to_dict() for o in self.eitc_options],
            "snap_options": [o.to_dict() for o in self.snap_options],
            "child_allowance_options": [o.to_dict() for o in self.child_allowance_options],
            "federal_options": [o.to_dict() for o in self.federal_options],
        }


def get_reform_options_for_state(state_code: str) -> StateReformOptions:
    """
    Get all available reform options for a state.

    Args:
        state_code: Two-letter state code

    Returns:
        StateReformOptions with all available reforms
    """
    programs = get_state_programs(state_code)

    if programs is None:
        # Unknown state - return minimal options
        return StateReformOptions(
            state_code=state_code,
            state_name=state_code,
            has_income_tax=True,
            existing_programs={},
            federal_options=_get_federal_options(),
            snap_options=_get_snap_options(),
        )

    # Build existing programs summary
    existing = {
        "state_ctc": programs.ctc is not None,
        "state_eitc": programs.eitc is not None,
        "state_cdcc": programs.cdcc is not None,
        "personal_exemption": programs.exemption is not None and programs.exemption.personal_amount > 0,
        "dependent_exemption": programs.exemption is not None and programs.exemption.dependent_amount > 0,
    }

    options = StateReformOptions(
        state_code=programs.state_code,
        state_name=programs.state_name,
        has_income_tax=programs.has_income_tax,
        existing_programs=existing,
    )

    # Generate CTC options
    options.ctc_options = _get_ctc_options(programs)

    # Generate EITC options
    options.eitc_options = _get_eitc_options(programs)

    # Generate SNAP options (universal)
    options.snap_options = _get_snap_options()

    # Generate child allowance options
    options.child_allowance_options = _get_child_allowance_options(programs)

    # Generate federal options
    options.federal_options = _get_federal_options()

    return options


def _get_ctc_options(programs: StatePrograms) -> List[ReformOption]:
    """Generate CTC reform options for a state."""
    options = []

    if programs.ctc is None:
        # State doesn't have a CTC - offer new programs
        options.append(ReformOption(
            id=f"{programs.state_code.lower()}_new_ctc_basic",
            name=f"New {programs.state_name} Child Tax Credit",
            description=f"Create a $500 per child refundable tax credit for {programs.state_name} families",
            category=ReformCategory.STATE_CTC,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=500,
            customizable_params=["amount", "age_limit", "income_limit", "refundable"],
            reform_config={
                "state_ctc": {
                    "enabled": True,
                    "state": programs.state_code,
                    "amount_young": 500,
                    "amount_older": 500,
                    "age_eligibility": "0_17",
                    "refundable": True,
                }
            },
        ))

        options.append(ReformOption(
            id=f"{programs.state_code.lower()}_new_ctc_generous",
            name=f"Generous {programs.state_name} CTC",
            description=f"Create a $1,000 per child credit with higher amounts for young children",
            category=ReformCategory.STATE_CTC,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=1200,
            customizable_params=["amount_young", "amount_older", "age_limit", "income_limit"],
            reform_config={
                "state_ctc": {
                    "enabled": True,
                    "state": programs.state_code,
                    "amount_young": 1500,
                    "amount_older": 1000,
                    "age_eligibility": "0_17",
                    "refundable": True,
                }
            },
        ))

        options.append(ReformOption(
            id=f"{programs.state_code.lower()}_new_young_child_ctc",
            name=f"{programs.state_name} Young Child Credit",
            description="Create a credit focused on children ages 0-5",
            category=ReformCategory.STATE_CTC,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=1500,
            customizable_params=["amount"],
            reform_config={
                "state_ctc": {
                    "enabled": True,
                    "state": programs.state_code,
                    "amount_young": 1500,
                    "amount_older": 0,
                    "age_eligibility": "0_5",
                    "refundable": True,
                }
            },
        ))

    else:
        # State has a CTC - offer enhancements
        current = programs.ctc

        # Increase amount
        options.append(ReformOption(
            id=f"{programs.state_code.lower()}_ctc_increase_50",
            name=f"Increase {current.name} by 50%",
            description=f"Increase from ${current.max_amount:.0f} to ${current.max_amount * 1.5:.0f} per child",
            category=ReformCategory.STATE_CTC,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=current.max_amount * 0.5,
            customizable_params=["amount_multiplier"],
            reform_config={
                "state_ctc": {
                    "enabled": True,
                    "state": programs.state_code,
                    "amount_young": current.max_amount * 1.5,
                    "amount_older": (current.amount_older or current.max_amount) * 1.5,
                    "refundable": current.refundable,
                }
            },
        ))

        # Double the amount
        options.append(ReformOption(
            id=f"{programs.state_code.lower()}_ctc_double",
            name=f"Double {current.name}",
            description=f"Increase from ${current.max_amount:.0f} to ${current.max_amount * 2:.0f} per child",
            category=ReformCategory.STATE_CTC,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=current.max_amount,
            reform_config={
                "state_ctc": {
                    "enabled": True,
                    "state": programs.state_code,
                    "amount_young": current.max_amount * 2,
                    "amount_older": (current.amount_older or current.max_amount) * 2,
                    "refundable": current.refundable,
                }
            },
        ))

        # Expand age eligibility if limited
        if current.age_limit < 17:
            options.append(ReformOption(
                id=f"{programs.state_code.lower()}_ctc_expand_age",
                name=f"Expand {current.name} to All Children",
                description=f"Extend eligibility from age {current.age_limit} to age 17",
                category=ReformCategory.STATE_CTC,
                is_new_program=False,
                is_enhancement=True,
                customizable_params=["new_age_limit"],
                reform_config={
                    "state_ctc": {
                        "enabled": True,
                        "state": programs.state_code,
                        "amount_young": current.max_amount,
                        "amount_older": current.max_amount,
                        "age_eligibility": "0_17",
                        "refundable": current.refundable,
                    }
                },
            ))

        # Make refundable if not already
        if not current.refundable:
            options.append(ReformOption(
                id=f"{programs.state_code.lower()}_ctc_refundable",
                name=f"Make {current.name} Refundable",
                description="Allow low-income families to receive the full credit as a refund",
                category=ReformCategory.STATE_CTC,
                is_new_program=False,
                is_enhancement=True,
                reform_config={
                    "state_ctc": {
                        "enabled": True,
                        "state": programs.state_code,
                        "amount_young": current.max_amount,
                        "amount_older": current.amount_older or current.max_amount,
                        "refundable": True,
                    }
                },
            ))

    return options


def _get_eitc_options(programs: StatePrograms) -> List[ReformOption]:
    """Generate one EITC reform option per state with configurable match rate slider."""
    state = programs.state_code.upper()

    # Skip states without income tax - can't have state EITC
    if not programs.has_income_tax:
        return []

    # Get current match rate if state has EITC, otherwise default to 0
    current_rate = 0
    if programs.eitc and programs.eitc.match_rate > 0:
        current_rate = int(programs.eitc.match_rate * 100)

    has_existing = programs.eitc is not None

    return [ReformOption(
        id=f"{state.lower()}_eitc",
        name=f"{programs.state_name} EITC",
        description=f"{'Adjust' if has_existing else 'Create'} state EITC as percentage of federal EITC. Current: {current_rate}%.",
        category=ReformCategory.STATE_EITC,
        is_new_program=not has_existing,
        is_enhancement=has_existing,
        is_configurable=True,
        estimated_household_impact=500,
        adjustable_params=[
            AdjustableParameter(
                name="match_rate",
                label="Match rate",
                min_value=0,
                max_value=100,
                default_value=current_rate,
                step=5,
                unit="%",
                description=f"Percentage of federal EITC. Current: {current_rate}%.",
            ),
        ],
        reform_config={
            "state_eitc": {
                "enabled": True,
                "state": state,
                "match_rate": current_rate / 100,
            }
        },
    )]


def _get_snap_options() -> List[ReformOption]:
    """Generate SNAP reform options (universal across states)."""
    return [
        ReformOption(
            id="snap_increase_15",
            name="15% SNAP Benefit Increase",
            description="Increase SNAP benefits by 15% for all recipients",
            category=ReformCategory.SNAP,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=600,
            customizable_params=["increase_percent"],
            reform_config={
                "snap": {
                    "enabled": True,
                    "benefit_increase_percent": 15,
                }
            },
        ),
        ReformOption(
            id="snap_increase_25",
            name="25% SNAP Benefit Increase",
            description="Increase SNAP benefits by 25% for all recipients",
            category=ReformCategory.SNAP,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=1000,
            customizable_params=["increase_percent"],
            reform_config={
                "snap": {
                    "enabled": True,
                    "benefit_increase_percent": 25,
                }
            },
        ),
        ReformOption(
            id="snap_child_boost",
            name="SNAP Child Nutrition Boost",
            description="Add $50/month per child to SNAP benefits",
            category=ReformCategory.SNAP,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=600,
            customizable_params=["child_allotment"],
            reform_config={
                "snap": {
                    "enabled": True,
                    "increase_child_allotment": 50,
                }
            },
        ),
        ReformOption(
            id="snap_expand_eligibility",
            name="Expand SNAP Eligibility",
            description="Raise income eligibility limits by 30%",
            category=ReformCategory.SNAP,
            is_new_program=False,
            is_enhancement=True,
            customizable_params=["eligibility_increase"],
            reform_config={
                "snap": {
                    "enabled": True,
                    "expand_eligibility_percent": 30,
                }
            },
        ),
    ]


def _get_child_allowance_options(programs: StatePrograms) -> List[ReformOption]:
    """Generate child allowance/UBI options."""
    options = [
        ReformOption(
            id=f"{programs.state_code.lower()}_child_allowance_monthly",
            name=f"{programs.state_name} Child Allowance",
            description="Provide $300/month per child to all families",
            category=ReformCategory.CHILD_ALLOWANCE,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=3600,
            customizable_params=["monthly_amount", "age_limit", "income_limit"],
            reform_config={
                "ubi": {
                    "enabled": True,
                    "amount_per_child": 3600,
                    "amount_per_adult": 0,
                    "age_eligibility": "0_17",
                }
            },
        ),
        ReformOption(
            id=f"{programs.state_code.lower()}_young_child_allowance",
            name=f"{programs.state_name} Young Child Allowance",
            description="Provide $400/month for children under 6",
            category=ReformCategory.CHILD_ALLOWANCE,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=4800,
            customizable_params=["monthly_amount"],
            reform_config={
                "ubi": {
                    "enabled": True,
                    "amount_per_child": 4800,
                    "amount_per_adult": 0,
                    "age_eligibility": "0_5",
                }
            },
        ),
        ReformOption(
            id=f"{programs.state_code.lower()}_infant_allowance",
            name=f"{programs.state_name} Infant Care Allowance",
            description="Provide $500/month for children under 3",
            category=ReformCategory.CHILD_ALLOWANCE,
            is_new_program=True,
            is_enhancement=False,
            estimated_household_impact=6000,
            reform_config={
                "ubi": {
                    "enabled": True,
                    "amount_per_child": 6000,
                    "amount_per_adult": 0,
                    "age_eligibility": "prenatal_3",
                }
            },
        ),
    ]

    return options


def _get_federal_options() -> List[ReformOption]:
    """Generate federal reform options."""
    return [
        ReformOption(
            id="federal_ctc_expanded",
            name="Restore 2021 Expanded CTC",
            description="$3,600 for children under 6, $3,000 for ages 6-17, fully refundable",
            category=ReformCategory.FEDERAL_CTC,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=2400,
            reform_config={
                "ctc": {
                    "enabled": True,
                    "amount_young": 3600,
                    "amount_older": 3000,
                    "refundable": True,
                    "phaseout_start_single": 75000,
                    "phaseout_start_joint": 150000,
                }
            },
        ),
        ReformOption(
            id="federal_ctc_universal",
            name="Universal Child Allowance",
            description="$3,000 per child with no income phaseout",
            category=ReformCategory.FEDERAL_CTC,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=3000,
            reform_config={
                "ctc": {
                    "enabled": True,
                    "amount_young": 3000,
                    "amount_older": 3000,
                    "refundable": True,
                    "phaseout_structure": "none",
                }
            },
        ),
        ReformOption(
            id="federal_eitc_expansion",
            name="50% EITC Expansion",
            description="Increase federal EITC by 50%",
            category=ReformCategory.FEDERAL_EITC,
            is_new_program=False,
            is_enhancement=True,
            estimated_household_impact=1500,
            reform_config={
                "eitc": {
                    "enabled": True,
                    "expansion_percent": 50,
                }
            },
        ),
        ReformOption(
            id="federal_eitc_childless",
            name="Expanded EITC for Childless Workers",
            description="Triple the EITC for workers without children",
            category=ReformCategory.FEDERAL_EITC,
            is_new_program=False,
            is_enhancement=True,
            reform_config={
                "eitc": {
                    "enabled": True,
                    "childless_expansion": True,
                }
            },
        ),
    ]


def build_reform_from_options(
    options: List[ReformOption],
    state: str,
    year: int = 2026,
) -> ReformConfig:
    """
    Build a ReformConfig from selected reform options.

    Args:
        options: List of selected ReformOption objects
        state: State code
        year: Tax year

    Returns:
        Combined ReformConfig
    """
    from cpid_calc.reforms.config import (
        ReformConfig,
        CTCConfig,
        EITCConfig,
        SNAPConfig,
        UBIConfig,
        StateCTCConfig,
        StateEITCConfig,
    )

    config = ReformConfig(
        name="Custom Reform",
        description="Combined reform from selected options",
        year=year,
        states=[state],
    )

    for option in options:
        if option.reform_config is None:
            continue

        if "ctc" in option.reform_config:
            ctc_data = option.reform_config["ctc"]
            config.ctc = CTCConfig(**{**config.ctc.__dict__, **ctc_data})

        if "eitc" in option.reform_config:
            eitc_data = option.reform_config["eitc"]
            config.eitc = EITCConfig(**{**config.eitc.__dict__, **eitc_data})

        if "snap" in option.reform_config:
            snap_data = option.reform_config["snap"]
            config.snap = SNAPConfig(**{**config.snap.__dict__, **snap_data})

        if "ubi" in option.reform_config:
            ubi_data = option.reform_config["ubi"]
            config.ubi = UBIConfig(**{**config.ubi.__dict__, **ubi_data})

        if "state_ctc" in option.reform_config:
            state_ctc_data = option.reform_config["state_ctc"]
            config.state_ctc = StateCTCConfig(**{**config.state_ctc.__dict__, **state_ctc_data})

        if "state_eitc" in option.reform_config:
            state_eitc_data = option.reform_config["state_eitc"]
            config.state_eitc = StateEITCConfig(**{**config.state_eitc.__dict__, **state_eitc_data})

    return config
