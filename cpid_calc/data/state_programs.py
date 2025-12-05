"""
Comprehensive state-level tax credit and benefit programs data.

This module contains detailed information about existing state programs
including CTCs, EITCs, dependent exemptions, and other child-related benefits.
Data is sourced from PolicyEngine-US parameters.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum


class ProgramType(str, Enum):
    """Types of state programs available."""
    CTC = "ctc"
    EITC = "eitc"
    CDCC = "cdcc"  # Child and Dependent Care Credit
    PERSONAL_EXEMPTION = "personal_exemption"
    DEPENDENT_EXEMPTION = "dependent_exemption"
    SNAP = "snap"
    TANF = "tanf"


@dataclass
class StateCTC:
    """State Child Tax Credit program details."""
    name: str
    max_amount: float
    amount_young: Optional[float] = None  # If different for young children
    amount_older: Optional[float] = None
    age_limit: int = 17
    young_child_age: int = 6  # Age threshold for "young" vs "older"
    refundable: bool = True
    income_limit: Optional[float] = None
    phaseout_start: Optional[float] = None
    phaseout_rate: Optional[float] = None
    notes: str = ""
    pe_variable: str = ""  # PolicyEngine variable name


@dataclass
class StateEITC:
    """State Earned Income Tax Credit program details."""
    name: str
    match_rate: float  # Percentage of federal EITC (e.g., 0.30 = 30%)
    refundable: bool = True
    has_childless_credit: bool = True
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    notes: str = ""
    pe_variable: str = ""


@dataclass
class StateExemption:
    """State personal or dependent exemption details."""
    personal_amount: float = 0
    dependent_amount: float = 0
    has_age_based_amounts: bool = False
    notes: str = ""


@dataclass
class StateCDCC:
    """State Child and Dependent Care Credit details."""
    name: str
    max_percent: float  # Maximum percentage of expenses
    max_expenses: float  # Maximum eligible expenses
    refundable: bool = False
    notes: str = ""


@dataclass
class StatePrograms:
    """Complete state program profile."""
    state_code: str
    state_name: str
    has_income_tax: bool = True
    ctc: Optional[StateCTC] = None
    eitc: Optional[StateEITC] = None
    exemption: Optional[StateExemption] = None
    cdcc: Optional[StateCDCC] = None
    other_child_programs: List[str] = field(default_factory=list)


# Comprehensive state programs database
STATE_PROGRAMS: Dict[str, StatePrograms] = {
    # ===== STATES WITH COMPREHENSIVE PROGRAMS =====

    "CA": StatePrograms(
        state_code="CA",
        state_name="California",
        ctc=StateCTC(
            name="Young Child Tax Credit (CalYCTC)",
            max_amount=1117,
            age_limit=5,
            refundable=True,
            income_limit=30931,  # CalEITC eligibility
            notes="Tied to CalEITC eligibility, ages 0-5 only",
            pe_variable="ca_yctc",
        ),
        eitc=StateEITC(
            name="California Earned Income Tax Credit (CalEITC)",
            match_rate=0.85,  # Approximately, structure is different
            refundable=True,
            notes="Own structure, not a federal match",
            pe_variable="ca_eitc",
        ),
        exemption=StateExemption(
            personal_amount=144,
            dependent_amount=446,
        ),
        cdcc=StateCDCC(
            name="CA Child and Dependent Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "CO": StatePrograms(
        state_code="CO",
        state_name="Colorado",
        ctc=StateCTC(
            name="Colorado Child Tax Credit",
            max_amount=1200,
            amount_young=1200,
            amount_older=1200,
            age_limit=5,
            refundable=True,
            phaseout_start=25000,
            phaseout_rate=0.02,
            notes="Also has Family Affordability Credit",
            pe_variable="co_ctc",
        ),
        eitc=StateEITC(
            name="Colorado EITC",
            match_rate=0.50,  # As of 2024
            refundable=True,
            notes="Increased to 50% in 2024, declines to 10% by 2034",
            pe_variable="co_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
            notes="No personal exemptions",
        ),
        cdcc=StateCDCC(
            name="CO Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "CT": StatePrograms(
        state_code="CT",
        state_name="Connecticut",
        ctc=StateCTC(
            name="Connecticut Child Tax Rebate",
            max_amount=250,
            age_limit=17,
            refundable=True,
            income_limit=100000,
            notes="Per-child rebate program",
            pe_variable="ct_child_tax_rebate",
        ),
        eitc=StateEITC(
            name="Connecticut EITC",
            match_rate=0.305,
            refundable=True,
            pe_variable="ct_eitc",
        ),
        exemption=StateExemption(
            personal_amount=15000,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="CT Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "DC": StatePrograms(
        state_code="DC",
        state_name="District of Columbia",
        ctc=StateCTC(
            name="DC Child Tax Credit",
            max_amount=420,
            age_limit=17,
            refundable=True,
            notes="Also known as Keep Child Care Affordable Credit",
            pe_variable="dc_ctc",
        ),
        eitc=StateEITC(
            name="DC EITC",
            match_rate=0.70,
            refundable=True,
            notes="One of the highest state EITC rates",
            pe_variable="dc_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="DC Child Care Credit",
            max_percent=0.32,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    "GA": StatePrograms(
        state_code="GA",
        state_name="Georgia",
        ctc=StateCTC(
            name="Georgia Child Tax Credit",
            max_amount=3000,
            age_limit=5,
            refundable=False,
            notes="New program effective 2024",
            pe_variable="ga_ctc",
        ),
        eitc=None,
        exemption=StateExemption(
            personal_amount=2700,
            dependent_amount=3000,
        ),
        cdcc=StateCDCC(
            name="GA Child Care Credit",
            max_percent=0.30,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "ID": StatePrograms(
        state_code="ID",
        state_name="Idaho",
        ctc=StateCTC(
            name="Idaho Child Tax Credit",
            max_amount=205,
            age_limit=17,
            refundable=False,
            notes="Non-refundable credit",
            pe_variable="id_ctc",
        ),
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="ID Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "IL": StatePrograms(
        state_code="IL",
        state_name="Illinois",
        ctc=StateCTC(
            name="Illinois Child Tax Credit",
            max_amount=300,
            age_limit=17,
            refundable=True,
            income_limit=60000,
            notes="New program effective 2024",
            pe_variable="il_ctc",
        ),
        eitc=StateEITC(
            name="Illinois EITC",
            match_rate=0.20,
            refundable=True,
            pe_variable="il_eitc",
        ),
        exemption=StateExemption(
            personal_amount=2625,
            dependent_amount=2625,
        ),
        cdcc=StateCDCC(
            name="IL Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MA": StatePrograms(
        state_code="MA",
        state_name="Massachusetts",
        ctc=StateCTC(
            name="Child and Family Tax Credit",
            max_amount=440,
            age_limit=12,  # Different for dependents vs elderly
            refundable=True,
            notes="Combines child credit and dependent care",
            pe_variable="ma_child_and_family_credit",
        ),
        eitc=StateEITC(
            name="Massachusetts EITC",
            match_rate=0.40,
            refundable=True,
            notes="Increased to 40% in 2023",
            pe_variable="ma_eitc",
        ),
        exemption=StateExemption(
            personal_amount=4400,
            dependent_amount=1000,
        ),
        cdcc=StateCDCC(
            name="MA Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MD": StatePrograms(
        state_code="MD",
        state_name="Maryland",
        ctc=StateCTC(
            name="Maryland Child Tax Credit",
            max_amount=500,
            age_limit=17,
            refundable=True,
            income_limit=6000,
            notes="Low income threshold",
            pe_variable="md_ctc",
        ),
        eitc=StateEITC(
            name="Maryland EITC",
            match_rate=0.50,  # Refundable portion
            refundable=True,
            notes="Separate rates for childless (0.28-1.00)",
            pe_variable="md_eitc",
        ),
        exemption=StateExemption(
            personal_amount=3200,
            dependent_amount=3200,
        ),
        cdcc=StateCDCC(
            name="MD Child Care Credit",
            max_percent=0.325,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MN": StatePrograms(
        state_code="MN",
        state_name="Minnesota",
        ctc=StateCTC(
            name="Child and Working Families Credits",
            max_amount=1750,
            age_limit=17,
            refundable=True,
            notes="Combined CTC and working family credit",
            pe_variable="mn_child_and_working_families_credit",
        ),
        eitc=StateEITC(
            name="Minnesota Working Family Credit",
            match_rate=0.34,
            refundable=True,
            notes="Part of combined credit",
            pe_variable="mn_working_family_credit",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=4950,
        ),
        cdcc=StateCDCC(
            name="MN Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    "NJ": StatePrograms(
        state_code="NJ",
        state_name="New Jersey",
        ctc=StateCTC(
            name="New Jersey Child Tax Credit",
            max_amount=1000,
            age_limit=5,
            refundable=True,
            income_limit=30000,
            notes="Ages 0-5 only",
            pe_variable="nj_ctc",
        ),
        eitc=StateEITC(
            name="New Jersey EITC",
            match_rate=0.40,
            refundable=True,
            age_min=21,
            pe_variable="nj_eitc",
        ),
        exemption=StateExemption(
            personal_amount=1000,
            dependent_amount=1500,
        ),
        cdcc=StateCDCC(
            name="NJ Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "NM": StatePrograms(
        state_code="NM",
        state_name="New Mexico",
        ctc=StateCTC(
            name="New Mexico Child Income Tax Credit",
            max_amount=600,
            age_limit=17,
            refundable=True,
            notes="Refundable credit per child",
            pe_variable="nm_child_income_tax_credit",
        ),
        eitc=StateEITC(
            name="New Mexico EITC",
            match_rate=0.25,
            refundable=True,
            age_min=18,
            pe_variable="nm_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=4150,
        ),
        cdcc=StateCDCC(
            name="NM Child Care Credit",
            max_percent=0.40,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    "NY": StatePrograms(
        state_code="NY",
        state_name="New York",
        ctc=StateCTC(
            name="Empire State Child Credit",
            max_amount=330,
            age_limit=17,
            refundable=True,
            notes="Additional supplemental amounts available",
            pe_variable="ny_ctc",
        ),
        eitc=StateEITC(
            name="New York EITC",
            match_rate=0.30,
            refundable=True,
            notes="30% match since 2003",
            pe_variable="ny_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=1000,
        ),
        cdcc=StateCDCC(
            name="NY Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    "OK": StatePrograms(
        state_code="OK",
        state_name="Oklahoma",
        ctc=StateCTC(
            name="Oklahoma Child Care/Child Tax Credit",
            max_amount=100,
            age_limit=17,
            refundable=False,
            pe_variable="ok_ctc",
        ),
        eitc=StateEITC(
            name="Oklahoma EITC",
            match_rate=0.05,
            refundable=True,
            notes="5% match, one of the lowest",
            pe_variable="ok_eitc",
        ),
        exemption=StateExemption(
            personal_amount=1000,
            dependent_amount=1000,
        ),
        cdcc=StateCDCC(
            name="OK Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "OR": StatePrograms(
        state_code="OR",
        state_name="Oregon",
        ctc=StateCTC(
            name="Oregon Kids Credit",
            max_amount=1000,
            age_limit=5,
            refundable=True,
            income_limit=30000,
            notes="Ages 0-5 only",
            pe_variable="or_kids_credit",
        ),
        eitc=StateEITC(
            name="Oregon EITC",
            match_rate=0.12,
            refundable=True,
            notes="Variable match based on age and children",
            pe_variable="or_eitc",
        ),
        exemption=StateExemption(
            personal_amount=236,
            dependent_amount=236,
        ),
        cdcc=StateCDCC(
            name="OR Child Care Credit",
            max_percent=0.30,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "RI": StatePrograms(
        state_code="RI",
        state_name="Rhode Island",
        ctc=StateCTC(
            name="Rhode Island Child Tax Rebate",
            max_amount=250,
            age_limit=17,
            refundable=True,
            income_limit=100000,
            pe_variable="ri_child_tax_rebate",
        ),
        eitc=StateEITC(
            name="Rhode Island EITC",
            match_rate=0.15,
            refundable=True,
            pe_variable="ri_eitc",
        ),
        exemption=StateExemption(
            personal_amount=4700,
            dependent_amount=4700,
        ),
        cdcc=StateCDCC(
            name="RI Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "VT": StatePrograms(
        state_code="VT",
        state_name="Vermont",
        ctc=StateCTC(
            name="Vermont Child Tax Credit",
            max_amount=1000,
            age_limit=5,
            refundable=True,
            notes="Ages 0-5 only",
            pe_variable="vt_ctc",
        ),
        eitc=StateEITC(
            name="Vermont EITC",
            match_rate=0.38,
            refundable=True,
            notes="Enhanced structure available",
            pe_variable="vt_eitc",
        ),
        exemption=StateExemption(
            personal_amount=4850,
            dependent_amount=4850,
        ),
        cdcc=StateCDCC(
            name="VT Child Care Credit",
            max_percent=0.24,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    # ===== STATES WITH EITC ONLY (NO STATE CTC) =====

    "DE": StatePrograms(
        state_code="DE",
        state_name="Delaware",
        ctc=None,
        eitc=StateEITC(
            name="Delaware EITC",
            match_rate=0.045,
            refundable=True,
            notes="Non-refundable portion also available",
            pe_variable="de_eitc",
        ),
        exemption=StateExemption(
            personal_amount=110,
            dependent_amount=110,
        ),
        cdcc=StateCDCC(
            name="DE Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "HI": StatePrograms(
        state_code="HI",
        state_name="Hawaii",
        ctc=None,
        eitc=StateEITC(
            name="Hawaii EITC",
            match_rate=0.40,
            refundable=True,
            pe_variable="hi_eitc",
        ),
        exemption=StateExemption(
            personal_amount=1144,
            dependent_amount=1144,
        ),
        cdcc=StateCDCC(
            name="HI Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "IN": StatePrograms(
        state_code="IN",
        state_name="Indiana",
        ctc=None,
        eitc=StateEITC(
            name="Indiana EITC",
            match_rate=0.10,
            refundable=True,
            pe_variable="in_eitc",
        ),
        exemption=StateExemption(
            personal_amount=1000,
            dependent_amount=1500,
        ),
        cdcc=StateCDCC(
            name="IN Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "IA": StatePrograms(
        state_code="IA",
        state_name="Iowa",
        ctc=None,
        eitc=StateEITC(
            name="Iowa EITC",
            match_rate=0.15,
            refundable=True,
            pe_variable="ia_eitc",
        ),
        exemption=StateExemption(
            personal_amount=40,
            dependent_amount=40,
        ),
        cdcc=StateCDCC(
            name="IA Child Care Credit",
            max_percent=0.75,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "KS": StatePrograms(
        state_code="KS",
        state_name="Kansas",
        ctc=None,
        eitc=StateEITC(
            name="Kansas EITC",
            match_rate=0.17,
            refundable=True,
            pe_variable="ks_eitc",
        ),
        exemption=StateExemption(
            personal_amount=2250,
            dependent_amount=2250,
        ),
        cdcc=StateCDCC(
            name="KS Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "LA": StatePrograms(
        state_code="LA",
        state_name="Louisiana",
        ctc=None,
        eitc=StateEITC(
            name="Louisiana EITC",
            match_rate=0.05,
            refundable=True,
            pe_variable="la_eitc",
        ),
        exemption=StateExemption(
            personal_amount=4500,
            dependent_amount=1000,
        ),
        cdcc=StateCDCC(
            name="LA Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=True,
        ),
    ),

    "ME": StatePrograms(
        state_code="ME",
        state_name="Maine",
        ctc=StateCTC(
            name="Maine Dependent Exemption Tax Credit",
            max_amount=300,
            age_limit=17,
            refundable=True,
            pe_variable="me_dependent_exemption_credit",
        ),
        eitc=StateEITC(
            name="Maine EITC",
            match_rate=0.25,
            refundable=True,
            notes="Different rates with/without children",
            pe_variable="me_eitc",
        ),
        exemption=StateExemption(
            personal_amount=4700,
            dependent_amount=4700,
        ),
        cdcc=StateCDCC(
            name="ME Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MI": StatePrograms(
        state_code="MI",
        state_name="Michigan",
        ctc=None,
        eitc=StateEITC(
            name="Michigan EITC",
            match_rate=0.30,
            refundable=True,
            pe_variable="mi_eitc",
        ),
        exemption=StateExemption(
            personal_amount=5400,
            dependent_amount=5400,
        ),
        cdcc=StateCDCC(
            name="MI Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MO": StatePrograms(
        state_code="MO",
        state_name="Missouri",
        ctc=None,
        eitc=StateEITC(
            name="Missouri Working Families Tax Credit",
            match_rate=0.20,
            refundable=False,
            pe_variable="mo_wftc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
    ),

    "MT": StatePrograms(
        state_code="MT",
        state_name="Montana",
        ctc=None,
        eitc=StateEITC(
            name="Montana EITC",
            match_rate=0.10,
            refundable=True,
            pe_variable="mt_eitc",
        ),
        exemption=StateExemption(
            personal_amount=2960,
            dependent_amount=2960,
        ),
        cdcc=StateCDCC(
            name="MT Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "NE": StatePrograms(
        state_code="NE",
        state_name="Nebraska",
        ctc=StateCTC(
            name="Nebraska Refundable Child Tax Credit",
            max_amount=1000,
            age_limit=17,
            refundable=True,
            pe_variable="ne_ctc",
        ),
        eitc=StateEITC(
            name="Nebraska EITC",
            match_rate=0.10,
            refundable=True,
            pe_variable="ne_eitc",
        ),
        exemption=StateExemption(
            personal_amount=157,
            dependent_amount=157,
        ),
        cdcc=StateCDCC(
            name="NE Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "OH": StatePrograms(
        state_code="OH",
        state_name="Ohio",
        ctc=None,
        eitc=StateEITC(
            name="Ohio EITC",
            match_rate=0.30,
            refundable=False,
            notes="Non-refundable only",
            pe_variable="oh_eitc",
        ),
        exemption=StateExemption(
            personal_amount=2400,
            dependent_amount=2500,
        ),
        cdcc=StateCDCC(
            name="OH Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "PA": StatePrograms(
        state_code="PA",
        state_name="Pennsylvania",
        ctc=None,
        eitc=StateEITC(
            name="Working Pennsylvanians Tax Credit",
            match_rate=0.10,
            refundable=True,
            notes="New program effective 2025",
            pe_variable="pa_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="PA Child Care Credit",
            max_percent=0.30,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "SC": StatePrograms(
        state_code="SC",
        state_name="South Carolina",
        ctc=None,
        eitc=StateEITC(
            name="South Carolina EITC",
            match_rate=1.25,  # 125% match!
            refundable=False,
            notes="125% match but non-refundable",
            pe_variable="sc_eitc",
        ),
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=4610,
        ),
        cdcc=StateCDCC(
            name="SC Child Care Credit",
            max_percent=0.07,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "UT": StatePrograms(
        state_code="UT",
        state_name="Utah",
        ctc=StateCTC(
            name="Utah Child Tax Credit",
            max_amount=1000,
            age_limit=4,
            refundable=False,
            notes="Ages 0-4 only",
            pe_variable="ut_ctc",
        ),
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=2000,
        ),
        cdcc=StateCDCC(
            name="UT Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "VA": StatePrograms(
        state_code="VA",
        state_name="Virginia",
        ctc=None,
        eitc=StateEITC(
            name="Virginia EITC",
            match_rate=0.20,
            refundable=True,
            notes="15-20% refundable match",
            pe_variable="va_eitc",
        ),
        exemption=StateExemption(
            personal_amount=930,
            dependent_amount=930,
        ),
        cdcc=StateCDCC(
            name="VA Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "WA": StatePrograms(
        state_code="WA",
        state_name="Washington",
        has_income_tax=False,
        ctc=None,
        eitc=StateEITC(
            name="Working Families Tax Credit",
            match_rate=0.10,
            refundable=True,
            notes="Rebate program (no income tax)",
            pe_variable="wa_working_families_tax_credit",
        ),
        exemption=None,
    ),

    "WI": StatePrograms(
        state_code="WI",
        state_name="Wisconsin",
        ctc=None,
        eitc=StateEITC(
            name="Wisconsin Earned Income Credit",
            match_rate=0.18,  # Varies by children
            refundable=True,
            notes="4-43% based on number of children",
            pe_variable="wi_eitc",
        ),
        exemption=StateExemption(
            personal_amount=700,
            dependent_amount=700,
        ),
        cdcc=StateCDCC(
            name="WI Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    # ===== STATES WITH NO INCOME TAX =====

    "AK": StatePrograms(
        state_code="AK",
        state_name="Alaska",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
        other_child_programs=["Permanent Fund Dividend"],
    ),

    "FL": StatePrograms(
        state_code="FL",
        state_name="Florida",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    "NV": StatePrograms(
        state_code="NV",
        state_name="Nevada",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    "SD": StatePrograms(
        state_code="SD",
        state_name="South Dakota",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    "TN": StatePrograms(
        state_code="TN",
        state_name="Tennessee",
        has_income_tax=False,  # Very limited
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    "TX": StatePrograms(
        state_code="TX",
        state_name="Texas",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    "WY": StatePrograms(
        state_code="WY",
        state_name="Wyoming",
        has_income_tax=False,
        ctc=None,
        eitc=None,
        exemption=None,
    ),

    # ===== STATES WITH LIMITED/NO CREDITS =====

    "AL": StatePrograms(
        state_code="AL",
        state_name="Alabama",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=1500,
            dependent_amount=1000,
            has_age_based_amounts=True,
            notes="Varies by AGI: $1000 (<$20K), $500 ($20-99K), $300 ($100K+)",
        ),
    ),

    "AZ": StatePrograms(
        state_code="AZ",
        state_name="Arizona",
        ctc=StateCTC(
            name="Arizona Dependent Tax Credit",
            max_amount=100,
            age_limit=17,
            refundable=False,
            pe_variable="az_dependent_tax_credit",
        ),
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="AZ Child Care Credit",
            max_percent=0.50,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "AR": StatePrograms(
        state_code="AR",
        state_name="Arkansas",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=29,
            dependent_amount=29,
        ),
        cdcc=StateCDCC(
            name="AR Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "KY": StatePrograms(
        state_code="KY",
        state_name="Kentucky",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
        cdcc=StateCDCC(
            name="KY Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "MS": StatePrograms(
        state_code="MS",
        state_name="Mississippi",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=6000,
            dependent_amount=1500,
        ),
        cdcc=StateCDCC(
            name="MS Child Care Credit",
            max_percent=0.25,
            max_expenses=6000,
            refundable=False,
        ),
    ),

    "NC": StatePrograms(
        state_code="NC",
        state_name="North Carolina",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
    ),

    "ND": StatePrograms(
        state_code="ND",
        state_name="North Dakota",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=0,
            dependent_amount=0,
        ),
    ),

    "NH": StatePrograms(
        state_code="NH",
        state_name="New Hampshire",
        has_income_tax=False,  # Limited to interest/dividends
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=2400,
            dependent_amount=0,
            notes="Interest/dividend income only",
        ),
    ),

    "WV": StatePrograms(
        state_code="WV",
        state_name="West Virginia",
        ctc=None,
        eitc=None,
        exemption=StateExemption(
            personal_amount=2000,
            dependent_amount=2000,
        ),
        cdcc=StateCDCC(
            name="WV Child Care Credit",
            max_percent=0.20,
            max_expenses=6000,
            refundable=False,
        ),
    ),
}


def get_state_programs(state_code: str) -> Optional[StatePrograms]:
    """Get programs for a specific state."""
    return STATE_PROGRAMS.get(state_code.upper())


def get_states_with_ctc() -> List[str]:
    """Get list of states that have a CTC."""
    return [code for code, prog in STATE_PROGRAMS.items() if prog.ctc is not None]


def get_states_without_ctc() -> List[str]:
    """Get list of states without a CTC."""
    return [code for code, prog in STATE_PROGRAMS.items()
            if prog.ctc is None and prog.has_income_tax]


def get_states_with_eitc() -> List[str]:
    """Get list of states that have an EITC."""
    return [code for code, prog in STATE_PROGRAMS.items() if prog.eitc is not None]


def get_states_without_eitc() -> List[str]:
    """Get list of states without an EITC."""
    return [code for code, prog in STATE_PROGRAMS.items()
            if prog.eitc is None and prog.has_income_tax]


def get_states_without_income_tax() -> List[str]:
    """Get list of states without an income tax."""
    return [code for code, prog in STATE_PROGRAMS.items() if not prog.has_income_tax]


def get_reform_opportunities(state_code: str) -> Dict[str, List[str]]:
    """
    Get reform opportunities for a state based on what programs they don't have.

    Returns dict with categories of reforms that could be introduced.
    """
    programs = get_state_programs(state_code)
    if not programs:
        return {}

    opportunities = {
        "new_programs": [],
        "enhancements": [],
        "federal_programs": ["SNAP expansion", "Federal CTC changes"],
    }

    if not programs.has_income_tax:
        opportunities["new_programs"].append("State-level child benefit (cash transfer)")
        opportunities["new_programs"].append("Working families rebate")
    else:
        if programs.ctc is None:
            opportunities["new_programs"].append("State Child Tax Credit")
        else:
            opportunities["enhancements"].append("Expand existing CTC amount")
            opportunities["enhancements"].append("Expand CTC age eligibility")
            opportunities["enhancements"].append("Make CTC fully refundable")

        if programs.eitc is None:
            opportunities["new_programs"].append("State EITC (match federal)")
        else:
            opportunities["enhancements"].append("Increase EITC match rate")
            opportunities["enhancements"].append("Expand EITC for childless workers")

        if programs.exemption is None or programs.exemption.dependent_amount == 0:
            opportunities["new_programs"].append("Dependent exemption")
        else:
            opportunities["enhancements"].append("Increase dependent exemption amount")

    return opportunities


# State name lookup
STATE_NAMES = {code: prog.state_name for code, prog in STATE_PROGRAMS.items()}
