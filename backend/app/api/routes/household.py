"""
API routes for household-level analysis.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from modal_app.client import get_modal_client

router = APIRouter()

# Get Modal client
modal_client = get_modal_client(enabled=settings.MODAL_ENABLED)


# Request models
class PersonRequest(BaseModel):
    """Person in household."""
    age: int = Field(ge=0, le=120)
    is_disabled: bool = False


class ChildRequest(PersonRequest):
    """Child in household."""
    in_childcare: bool = False
    childcare_expenses_annual: float = Field(default=0, ge=0)


class IncomeRequest(BaseModel):
    """Household income."""
    employment_income: float = Field(default=0, ge=0)
    spouse_employment_income: float = Field(default=0, ge=0)
    self_employment_income: float = Field(default=0, ge=0)
    social_security_income: float = Field(default=0, ge=0)
    unemployment_income: float = Field(default=0, ge=0)


class HouseholdRequest(BaseModel):
    """Complete household configuration."""
    state: str = Field(max_length=2, min_length=2)
    year: int = Field(default=2026, ge=2026, le=2035)
    filing_status: str = Field(default="single")

    adults: List[PersonRequest] = Field(default_factory=list)
    children: List[ChildRequest] = Field(default_factory=list)
    income: IncomeRequest = Field(default_factory=IncomeRequest)

    rent_monthly: float = Field(default=0, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "state": "CA",
                "year": 2024,
                "filing_status": "head_of_household",
                "adults": [{"age": 35}],
                "children": [{"age": 5}, {"age": 8}],
                "income": {
                    "employment_income": 35000,
                },
            }
        }


class ReformSelectionRequest(BaseModel):
    """Selected reform options."""
    household: HouseholdRequest
    reform_option_ids: List[str] = Field(default_factory=list)
    custom_params: dict = Field(default_factory=dict)


# Response models
class HouseholdResultsResponse(BaseModel):
    """Results from household simulation."""
    year: int
    state: str

    gross_income: float
    adjusted_gross_income: float
    federal_income_tax: float
    state_income_tax: float
    payroll_tax: float
    net_income: float

    federal_ctc: float
    federal_eitc: float
    state_ctc: float
    state_eitc: float

    snap_benefits: float
    total_benefits: float

    in_poverty: bool
    in_deep_poverty: bool
    poverty_gap: float

    effective_tax_rate: float
    total_child_benefits: float


class HouseholdImpactResponse(BaseModel):
    """Impact of reform on household."""
    baseline: HouseholdResultsResponse
    reform: HouseholdResultsResponse

    net_income_change: float
    percent_income_change: float
    ctc_change: float
    eitc_change: float
    poverty_status_change: str


class AdjustableParameterResponse(BaseModel):
    """A parameter that users can adjust via slider."""
    name: str
    label: str
    min_value: float
    max_value: float
    default_value: float
    step: float = 1.0
    unit: str = ""
    description: str = ""


class ReformOptionResponse(BaseModel):
    """A single reform option."""
    id: str
    name: str
    description: str
    category: str
    is_new_program: bool
    is_enhancement: bool
    estimated_household_impact: Optional[float] = None
    customizable_params: List[str] = Field(default_factory=list)
    is_configurable: bool = False
    adjustable_params: List[AdjustableParameterResponse] = Field(default_factory=list)


class StateReformOptionsResponse(BaseModel):
    """All reform options for a state."""
    state_code: str
    state_name: str
    has_income_tax: bool
    existing_programs: dict

    ctc_options: List[ReformOptionResponse]
    eitc_options: List[ReformOptionResponse]
    snap_options: List[ReformOptionResponse]
    child_allowance_options: List[ReformOptionResponse]
    federal_options: List[ReformOptionResponse]


class StateProgramsResponse(BaseModel):
    """Current state programs summary."""
    state_code: str
    state_name: str
    has_income_tax: bool

    has_state_ctc: bool
    ctc_name: Optional[str] = None
    ctc_max_amount: Optional[float] = None
    ctc_age_limit: Optional[int] = None
    ctc_refundable: Optional[bool] = None

    has_state_eitc: bool
    eitc_name: Optional[str] = None
    eitc_match_rate: Optional[float] = None

    has_cdcc: bool
    has_dependent_exemption: bool


def _convert_household_request(request: HouseholdRequest):
    """Convert API request to HouseholdConfig."""
    from cpid_calc.household.config import (
        HouseholdConfig,
        AdultConfig,
        ChildConfig,
        IncomeConfig,
        FilingStatus,
    )

    filing_map = {
        "single": FilingStatus.SINGLE,
        "married_filing_jointly": FilingStatus.MARRIED_FILING_JOINTLY,
        "married_filing_separately": FilingStatus.MARRIED_FILING_SEPARATELY,
        "head_of_household": FilingStatus.HEAD_OF_HOUSEHOLD,
        "surviving_spouse": FilingStatus.SURVIVING_SPOUSE,
    }

    adults = [
        AdultConfig(age=a.age, is_disabled=a.is_disabled)
        for a in request.adults
    ] or [AdultConfig(age=30)]

    children = [
        ChildConfig(
            age=c.age,
            is_disabled=c.is_disabled,
            in_childcare=c.in_childcare,
            childcare_expenses_annual=c.childcare_expenses_annual,
        )
        for c in request.children
    ]

    income = IncomeConfig(
        employment_income=request.income.employment_income,
        spouse_employment_income=request.income.spouse_employment_income,
        self_employment_income=request.income.self_employment_income,
        social_security_income=request.income.social_security_income,
        unemployment_income=request.income.unemployment_income,
    )

    return HouseholdConfig(
        state=request.state.upper(),
        year=request.year,
        filing_status=filing_map.get(request.filing_status, FilingStatus.SINGLE),
        adults=adults,
        children=children,
        income=income,
        rent_amount_monthly=request.rent_monthly,
    )


@router.get("/state-programs/{state_code}", response_model=StateProgramsResponse)
async def get_state_programs(state_code: str):
    """Get current programs for a state."""
    from cpid_calc.data.state_programs import get_state_programs as get_programs

    programs = get_programs(state_code.upper())
    if not programs:
        raise HTTPException(status_code=404, detail=f"State '{state_code}' not found")

    return StateProgramsResponse(
        state_code=programs.state_code,
        state_name=programs.state_name,
        has_income_tax=programs.has_income_tax,
        has_state_ctc=programs.ctc is not None,
        ctc_name=programs.ctc.name if programs.ctc else None,
        ctc_max_amount=programs.ctc.max_amount if programs.ctc else None,
        ctc_age_limit=programs.ctc.age_limit if programs.ctc else None,
        ctc_refundable=programs.ctc.refundable if programs.ctc else None,
        has_state_eitc=programs.eitc is not None,
        eitc_name=programs.eitc.name if programs.eitc else None,
        eitc_match_rate=programs.eitc.match_rate if programs.eitc else None,
        has_cdcc=programs.cdcc is not None,
        has_dependent_exemption=(
            programs.exemption is not None and
            programs.exemption.dependent_amount > 0
        ),
    )


@router.get("/reform-options/{state_code}", response_model=StateReformOptionsResponse)
async def get_reform_options(state_code: str):
    """Get available reform options for a state."""
    from cpid_calc.reforms.state_aware import get_reform_options_for_state

    options = get_reform_options_for_state(state_code.upper())

    return StateReformOptionsResponse(
        state_code=options.state_code,
        state_name=options.state_name,
        has_income_tax=options.has_income_tax,
        existing_programs=options.existing_programs,
        ctc_options=[ReformOptionResponse(**o.to_dict()) for o in options.ctc_options],
        eitc_options=[ReformOptionResponse(**o.to_dict()) for o in options.eitc_options],
        snap_options=[ReformOptionResponse(**o.to_dict()) for o in options.snap_options],
        child_allowance_options=[ReformOptionResponse(**o.to_dict()) for o in options.child_allowance_options],
        federal_options=[ReformOptionResponse(**o.to_dict()) for o in options.federal_options],
    )


@router.post("/baseline", response_model=HouseholdResultsResponse)
async def calculate_baseline(household: HouseholdRequest):
    """Calculate baseline (current law) for a household."""
    try:
        config = _convert_household_request(household)

        # Run simulation via Modal (or local fallback)
        results_dict = await modal_client.run_household_baseline(
            household_config_dict=config.to_dict(),
            year=config.year,
        )

        return HouseholdResultsResponse(
            year=results_dict["year"],
            state=results_dict["state"],
            gross_income=results_dict["gross_income"],
            adjusted_gross_income=results_dict["adjusted_gross_income"],
            federal_income_tax=results_dict["federal_income_tax"],
            state_income_tax=results_dict["state_income_tax"],
            payroll_tax=results_dict["payroll_tax"],
            net_income=results_dict["net_income"],
            federal_ctc=results_dict["federal_ctc"],
            federal_eitc=results_dict["federal_eitc"],
            state_ctc=results_dict["state_ctc"],
            state_eitc=results_dict["state_eitc"],
            snap_benefits=results_dict["snap_benefits"],
            total_benefits=results_dict["total_benefits"],
            in_poverty=results_dict["in_poverty"],
            in_deep_poverty=results_dict["in_deep_poverty"],
            poverty_gap=results_dict["poverty_gap"],
            effective_tax_rate=results_dict["effective_tax_rate"],
            total_child_benefits=results_dict["total_child_benefits"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.post("/impact", response_model=HouseholdImpactResponse)
async def calculate_impact(request: ReformSelectionRequest):
    """Calculate impact of selected reforms on a household."""
    try:
        from cpid_calc.reforms.state_aware import (
            get_reform_options_for_state,
            build_reform_from_options,
        )

        # Get household config
        config = _convert_household_request(request.household)

        # Get selected reform options
        all_options = get_reform_options_for_state(config.state)
        selected = [
            o for o in all_options.all_options()
            if o.id in request.reform_option_ids
        ]

        if not selected:
            raise HTTPException(
                status_code=400,
                detail="No valid reform options selected"
            )

        # Build reform config
        reform_config = build_reform_from_options(
            selected,
            config.state,
            config.year
        )

        # Calculate impact via Modal (or local fallback)
        impact_dict = await modal_client.run_household_impact(
            household_config_dict=config.to_dict(),
            reform_config_dict=reform_config.to_dict(),
            year=config.year,
        )

        # Convert to response
        def dict_to_response(d):
            return HouseholdResultsResponse(
                year=d["year"],
                state=d["state"],
                gross_income=d["gross_income"],
                adjusted_gross_income=d["adjusted_gross_income"],
                federal_income_tax=d["federal_income_tax"],
                state_income_tax=d["state_income_tax"],
                payroll_tax=d["payroll_tax"],
                net_income=d["net_income"],
                federal_ctc=d["federal_ctc"],
                federal_eitc=d["federal_eitc"],
                state_ctc=d["state_ctc"],
                state_eitc=d["state_eitc"],
                snap_benefits=d["snap_benefits"],
                total_benefits=d["total_benefits"],
                in_poverty=d["in_poverty"],
                in_deep_poverty=d["in_deep_poverty"],
                poverty_gap=d["poverty_gap"],
                effective_tax_rate=d["effective_tax_rate"],
                total_child_benefits=d["total_child_benefits"],
            )

        return HouseholdImpactResponse(
            baseline=dict_to_response(impact_dict["baseline"]),
            reform=dict_to_response(impact_dict["reform"]),
            net_income_change=impact_dict["net_income_change"],
            percent_income_change=impact_dict["percent_income_change"],
            ctc_change=impact_dict["ctc_change"],
            eitc_change=impact_dict["eitc_change"],
            poverty_status_change=impact_dict["poverty_status_change"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impact calculation failed: {str(e)}")


@router.post("/income-sweep")
async def run_income_sweep_endpoint(
    household: HouseholdRequest,
    reform_option_ids: List[str] = None,
    min_income: float = 0,
    max_income: float = 150000,
    step: float = 5000,
):
    """Run analysis across income levels to show benefit phase-outs."""
    try:
        from cpid_calc.reforms.state_aware import (
            get_reform_options_for_state,
            build_reform_from_options,
        )

        config = _convert_household_request(household)

        reform_config_dict = None
        if reform_option_ids:
            all_options = get_reform_options_for_state(config.state)
            selected = [
                o for o in all_options.all_options()
                if o.id in reform_option_ids
            ]
            if selected:
                reform_config = build_reform_from_options(
                    selected,
                    config.state,
                    config.year
                )
                reform_config_dict = reform_config.to_dict()

        income_range = [min_income + i * step for i in range(int((max_income - min_income) / step) + 1)]

        # Run via Modal (or local fallback)
        results = await modal_client.run_income_sweep(
            household_config_dict=config.to_dict(),
            reform_config_dict=reform_config_dict,
            income_range=income_range,
            year=config.year,
        )

        return {
            "state": config.state,
            "year": config.year,
            "data_points": [
                {
                    "income": r["income"],
                    "net_income": r["results"]["net_income"],
                    "federal_ctc": r["results"]["federal_ctc"],
                    "state_ctc": r["results"]["state_ctc"],
                    "federal_eitc": r["results"]["federal_eitc"],
                    "state_eitc": r["results"]["state_eitc"],
                    "snap_benefits": r["results"]["snap_benefits"],
                    "total_benefits": r["results"]["total_benefits"],
                    "effective_tax_rate": r["results"]["effective_tax_rate"],
                    "in_poverty": r["results"]["in_poverty"],
                }
                for r in results
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Income sweep failed: {str(e)}")
