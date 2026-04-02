"""
Household configuration data structures.

Defines the structure for household data entry including adults,
children, income, and state of residence.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from enum import Enum


class FilingStatus(str, Enum):
    """Tax filing status options."""
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    SURVIVING_SPOUSE = "surviving_spouse"


class ChildcareType(str, Enum):
    """Type of childcare arrangement."""
    NONE = "none"
    DAYCARE = "daycare"
    FAMILY_CARE = "family_care"
    NANNY = "nanny"
    PRESCHOOL = "preschool"


@dataclass
class IncomeConfig:
    """Household income configuration."""
    # Employment income
    employment_income: float = 0  # Primary earner wages/salary
    spouse_employment_income: float = 0  # Secondary earner if applicable

    # Self-employment
    self_employment_income: float = 0
    spouse_self_employment_income: float = 0

    # Other income sources
    social_security_income: float = 0
    pension_income: float = 0
    investment_income: float = 0
    rental_income: float = 0
    alimony_income: float = 0
    unemployment_income: float = 0
    disability_income: float = 0

    # Benefits received
    snap_benefits: float = 0
    tanf_benefits: float = 0
    housing_assistance: float = 0
    wic_benefits: float = 0
    ssi_income: float = 0

    @property
    def total_earned_income(self) -> float:
        """Calculate total earned income."""
        return (
            self.employment_income +
            self.spouse_employment_income +
            self.self_employment_income +
            self.spouse_self_employment_income
        )

    @property
    def total_income(self) -> float:
        """Calculate total income from all sources."""
        return (
            self.total_earned_income +
            self.social_security_income +
            self.pension_income +
            self.investment_income +
            self.rental_income +
            self.alimony_income +
            self.unemployment_income +
            self.disability_income
        )


@dataclass
class PersonConfig:
    """Base configuration for a person."""
    age: int
    is_disabled: bool = False
    is_blind: bool = False
    is_student: bool = False


@dataclass
class AdultConfig(PersonConfig):
    """Adult household member configuration."""
    is_filer: bool = True  # Is this person filing taxes?
    is_married: bool = False


@dataclass
class ChildConfig(PersonConfig):
    """Child household member configuration."""
    # Relationship to filer
    is_biological_child: bool = True
    is_foster_child: bool = False
    is_step_child: bool = False

    # Care situation
    months_with_filer: int = 12  # Months lived with filer
    in_childcare: bool = False
    childcare_type: ChildcareType = ChildcareType.NONE
    childcare_expenses_annual: float = 0

    # School status
    is_in_school: bool = False
    is_in_college: bool = False

    @property
    def is_infant(self) -> bool:
        """Check if child is an infant (0-1)."""
        return self.age <= 1

    @property
    def is_toddler(self) -> bool:
        """Check if child is a toddler (1-3)."""
        return 1 < self.age <= 3

    @property
    def is_preschool(self) -> bool:
        """Check if child is preschool age (3-5)."""
        return 3 < self.age <= 5

    @property
    def is_young_child(self) -> bool:
        """Check if child is young (0-5)."""
        return self.age <= 5

    @property
    def is_ctc_eligible(self) -> bool:
        """Check if child is CTC eligible (0-17)."""
        return self.age < 17


@dataclass
class HouseholdConfig:
    """Complete household configuration."""
    # Geographic
    state: str
    county: Optional[str] = None  # For more precise calculations

    # Filing
    filing_status: FilingStatus = FilingStatus.SINGLE
    year: int = 2026

    # Household members
    adults: List[AdultConfig] = field(default_factory=list)
    children: List[ChildConfig] = field(default_factory=list)

    # Income
    income: IncomeConfig = field(default_factory=IncomeConfig)

    # Housing
    is_renter: bool = True
    rent_amount_monthly: float = 0
    mortgage_interest_annual: float = 0
    property_tax_annual: float = 0

    # Health insurance
    has_employer_health_insurance: bool = False
    health_insurance_premium_monthly: float = 0

    # Childcare totals
    total_childcare_expenses: float = 0

    def __post_init__(self):
        """Validate and set defaults after initialization."""
        if not self.adults:
            # Default single adult age 30
            self.adults = [AdultConfig(age=30, is_filer=True)]

        # Calculate total childcare from children if not set
        if self.total_childcare_expenses == 0:
            self.total_childcare_expenses = sum(
                c.childcare_expenses_annual for c in self.children
            )

    @property
    def num_adults(self) -> int:
        """Number of adults in household."""
        return len(self.adults)

    @property
    def num_children(self) -> int:
        """Number of children in household."""
        return len(self.children)

    @property
    def num_young_children(self) -> int:
        """Number of young children (0-5)."""
        return sum(1 for c in self.children if c.is_young_child)

    @property
    def num_ctc_eligible_children(self) -> int:
        """Number of CTC-eligible children."""
        return sum(1 for c in self.children if c.is_ctc_eligible)

    @property
    def household_size(self) -> int:
        """Total household size."""
        return self.num_adults + self.num_children

    @property
    def is_married(self) -> bool:
        """Check if household is married (for tax purposes)."""
        return self.filing_status in [
            FilingStatus.MARRIED_FILING_JOINTLY,
            FilingStatus.MARRIED_FILING_SEPARATELY,
        ]

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        from dataclasses import asdict
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "HouseholdConfig":
        """Create from dictionary."""
        # Handle nested objects
        if "adults" in data:
            data["adults"] = [
                AdultConfig(**a) if isinstance(a, dict) else a
                for a in data["adults"]
            ]
        if "children" in data:
            children = []
            for c in data["children"]:
                if isinstance(c, dict):
                    c_data = c.copy()
                    if "childcare_type" in c_data and isinstance(c_data["childcare_type"], str):
                        c_data["childcare_type"] = ChildcareType(c_data["childcare_type"])
                    children.append(ChildConfig(**c_data))
                else:
                    children.append(c)
            data["children"] = children
        if "income" in data and isinstance(data["income"], dict):
            data["income"] = IncomeConfig(**data["income"])
        if "filing_status" in data and isinstance(data["filing_status"], str):
            data["filing_status"] = FilingStatus(data["filing_status"])

        return cls(**data)

    @classmethod
    def single_adult_no_children(
        cls,
        state: str,
        age: int = 30,
        employment_income: float = 40000,
    ) -> "HouseholdConfig":
        """Create a single adult household with no children."""
        return cls(
            state=state,
            filing_status=FilingStatus.SINGLE,
            adults=[AdultConfig(age=age)],
            children=[],
            income=IncomeConfig(employment_income=employment_income),
        )

    @classmethod
    def single_parent_with_children(
        cls,
        state: str,
        age: int = 35,
        child_ages: List[int] = None,
        employment_income: float = 35000,
    ) -> "HouseholdConfig":
        """Create a single parent household."""
        if child_ages is None:
            child_ages = [5, 8]

        return cls(
            state=state,
            filing_status=FilingStatus.HEAD_OF_HOUSEHOLD,
            adults=[AdultConfig(age=age)],
            children=[ChildConfig(age=age) for age in child_ages],
            income=IncomeConfig(employment_income=employment_income),
        )

    @classmethod
    def married_couple_with_children(
        cls,
        state: str,
        ages: Tuple[int, int] = (35, 33),
        child_ages: List[int] = None,
        primary_income: float = 60000,
        secondary_income: float = 30000,
    ) -> "HouseholdConfig":
        """Create a married couple with children."""
        if child_ages is None:
            child_ages = [3, 7]

        return cls(
            state=state,
            filing_status=FilingStatus.MARRIED_FILING_JOINTLY,
            adults=[
                AdultConfig(age=ages[0], is_married=True),
                AdultConfig(age=ages[1], is_married=True),
            ],
            children=[ChildConfig(age=age) for age in child_ages],
            income=IncomeConfig(
                employment_income=primary_income,
                spouse_employment_income=secondary_income,
            ),
        )


# Preset household configurations for quick testing
PRESET_HOUSEHOLDS = {
    "single_minimum_wage": lambda state: HouseholdConfig.single_adult_no_children(
        state=state,
        employment_income=15080,  # Federal minimum wage, full-time
    ),
    "single_parent_one_child": lambda state: HouseholdConfig.single_parent_with_children(
        state=state,
        child_ages=[4],
        employment_income=25000,
    ),
    "single_parent_two_children": lambda state: HouseholdConfig.single_parent_with_children(
        state=state,
        child_ages=[3, 7],
        employment_income=30000,
    ),
    "married_one_income": lambda state: HouseholdConfig.married_couple_with_children(
        state=state,
        child_ages=[2, 5],
        primary_income=50000,
        secondary_income=0,
    ),
    "married_two_incomes": lambda state: HouseholdConfig.married_couple_with_children(
        state=state,
        child_ages=[4, 8],
        primary_income=60000,
        secondary_income=40000,
    ),
    "married_young_children": lambda state: HouseholdConfig.married_couple_with_children(
        state=state,
        child_ages=[1, 3],
        primary_income=45000,
        secondary_income=20000,
    ),
    "single_parent_infant": lambda state: HouseholdConfig.single_parent_with_children(
        state=state,
        child_ages=[0],
        employment_income=20000,
    ),
}
