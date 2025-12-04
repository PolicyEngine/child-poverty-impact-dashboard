"""
API routes for policy analysis.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from app.api.models.reforms import ReformRequest
from app.api.models.responses import (
    AnalysisResponse,
    PovertyImpactResponse,
    FiscalCostResponse,
    DistributionalResponse,
    DecileImpactResponse,
)
from app.core.config import settings

router = APIRouter()


def convert_reform_request_to_config(reform: ReformRequest):
    """Convert API reform request to cpid_calc ReformConfig."""
    from cpid_calc.reforms.config import (
        ReformConfig,
        CTCConfig,
        EITCConfig,
        DependentExemptionConfig,
        UBIConfig,
        SNAPConfig,
        StateCTCConfig,
        AgeEligibility as CalcAgeEligibility,
        IncomeBasis as CalcIncomeBasis,
        PhaseoutStructure as CalcPhaseoutStructure,
    )

    # Map enums
    age_map = {
        "prenatal_3": CalcAgeEligibility.PRENATAL_3,
        "0_5": CalcAgeEligibility.AGES_0_5,
        "0_17": CalcAgeEligibility.AGES_0_17,
        "6_17": CalcAgeEligibility.AGES_6_17,
    }
    income_map = {
        "agi": CalcIncomeBasis.AGI,
        "earned": CalcIncomeBasis.EARNED_INCOME,
        "gross": CalcIncomeBasis.GROSS_INCOME,
    }
    phaseout_map = {
        "none": CalcPhaseoutStructure.NONE,
        "symmetric": CalcPhaseoutStructure.SYMMETRIC,
        "asymmetric": CalcPhaseoutStructure.ASYMMETRIC,
    }

    return ReformConfig(
        name=reform.name,
        description=reform.description,
        year=reform.year,
        states=reform.states,
        ctc=CTCConfig(
            enabled=reform.ctc.enabled,
            amount_young=reform.ctc.amount_young,
            amount_older=reform.ctc.amount_older,
            age_eligibility=age_map.get(reform.ctc.age_eligibility.value, CalcAgeEligibility.AGES_0_17),
            income_basis=income_map.get(reform.ctc.income_basis.value, CalcIncomeBasis.AGI),
            phaseout_structure=phaseout_map.get(reform.ctc.phaseout_structure.value, CalcPhaseoutStructure.ASYMMETRIC),
            phaseout_start_single=reform.ctc.phaseout_start_single,
            phaseout_start_joint=reform.ctc.phaseout_start_joint,
            phaseout_rate=reform.ctc.phaseout_rate,
            refundable=reform.ctc.refundable,
            refundable_amount=reform.ctc.refundable_amount,
        ),
        eitc=EITCConfig(
            enabled=reform.eitc.enabled,
            individualized=reform.eitc.individualized,
            expansion_percent=reform.eitc.expansion_percent,
            childless_expansion=reform.eitc.childless_expansion,
            age_floor_reduction=reform.eitc.age_floor_reduction,
            age_ceiling_increase=reform.eitc.age_ceiling_increase,
        ),
        dependent_exemption=DependentExemptionConfig(
            enabled=reform.dependent_exemption.enabled,
            amount_per_dependent=reform.dependent_exemption.amount_per_dependent,
            refundable=reform.dependent_exemption.refundable,
            income_limit_single=reform.dependent_exemption.income_limit_single,
            income_limit_joint=reform.dependent_exemption.income_limit_joint,
        ),
        ubi=UBIConfig(
            enabled=reform.ubi.enabled,
            amount_per_child=reform.ubi.amount_per_child,
            amount_per_adult=reform.ubi.amount_per_adult,
            age_eligibility=age_map.get(reform.ubi.age_eligibility.value, CalcAgeEligibility.AGES_0_17),
            phase_out_with_income=reform.ubi.phase_out_with_income,
            phaseout_start=reform.ubi.phaseout_start,
            phaseout_rate=reform.ubi.phaseout_rate,
        ),
        snap=SNAPConfig(
            enabled=reform.snap.enabled,
            benefit_increase_percent=reform.snap.benefit_increase_percent,
            expand_eligibility_percent=reform.snap.expand_eligibility_percent,
            remove_asset_test=reform.snap.remove_asset_test,
            increase_child_allotment=reform.snap.increase_child_allotment,
        ),
        state_ctc=StateCTCConfig(
            enabled=reform.state_ctc.enabled,
            state=reform.state_ctc.state,
            amount_young=reform.state_ctc.amount_young,
            amount_older=reform.state_ctc.amount_older,
            age_eligibility=age_map.get(reform.state_ctc.age_eligibility.value, CalcAgeEligibility.AGES_0_17),
            income_limit=reform.state_ctc.income_limit,
            refundable=reform.state_ctc.refundable,
            matches_federal=reform.state_ctc.matches_federal,
            match_percent=reform.state_ctc.match_percent,
        ),
    )


@router.post("/full", response_model=AnalysisResponse)
async def run_full_analysis(reform: ReformRequest):
    """
    Run a complete policy analysis including poverty, fiscal, and distributional impacts.
    """
    try:
        from cpid_calc.calculations.impact import calculate_poverty_impact
        from cpid_calc.calculations.fiscal import calculate_fiscal_cost
        from cpid_calc.calculations.distributional import calculate_distributional_impact

        config = convert_reform_request_to_config(reform)

        # Run all analyses
        poverty = calculate_poverty_impact(config, config.states or None, config.year)
        fiscal = calculate_fiscal_cost(config, config.states or None, config.year)
        distributional = calculate_distributional_impact(config, config.states or None, config.year)

        # Build response
        poverty_response = PovertyImpactResponse(**poverty.to_dict())
        fiscal_response = FiscalCostResponse(**fiscal.to_dict())

        dist_dict = distributional.to_dict()
        dist_response = DistributionalResponse(
            decile_impacts=[DecileImpactResponse(**d) for d in dist_dict["decile_impacts"]],
            average_gain_all=dist_dict["average_gain_all"],
            average_gain_bottom_50=dist_dict["average_gain_bottom_50"],
            average_gain_top_10=dist_dict["average_gain_top_10"],
            share_to_bottom_20_pct=dist_dict["share_to_bottom_20_pct"],
            share_to_bottom_50_pct=dist_dict["share_to_bottom_50_pct"],
            share_to_top_20_pct=dist_dict["share_to_top_20_pct"],
            share_to_top_10_pct=dist_dict["share_to_top_10_pct"],
            baseline_gini=dist_dict["baseline_gini"],
            reform_gini=dist_dict["reform_gini"],
            gini_change=dist_dict["gini_change"],
            percent_gaining=dist_dict["percent_gaining"],
            percent_losing=dist_dict["percent_losing"],
            percent_unchanged=dist_dict["percent_unchanged"],
            state=dist_dict.get("state"),
        )

        headline_stats = {
            "child_poverty_reduction_pct": abs(poverty_response.child_poverty_percent_change),
            "total_cost_billions": fiscal_response.total_cost_billions,
            "children_lifted_from_poverty": poverty_response.children_lifted_out_of_poverty,
            "cost_per_child_lifted": fiscal_response.cost_per_child_lifted_from_poverty,
        }

        return AnalysisResponse(
            reform_name=reform.name,
            reform_description=reform.description,
            year=reform.year,
            states_analyzed=reform.states if reform.states else ["All States"],
            poverty_impact=poverty_response,
            fiscal_cost=fiscal_response,
            distributional_impact=dist_response,
            headline_stats=headline_stats,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/poverty", response_model=PovertyImpactResponse)
async def run_poverty_analysis(reform: ReformRequest):
    """Run poverty impact analysis only."""
    try:
        from cpid_calc.calculations.impact import calculate_poverty_impact

        config = convert_reform_request_to_config(reform)
        poverty = calculate_poverty_impact(config, config.states or None, config.year)
        return PovertyImpactResponse(**poverty.to_dict())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Poverty analysis failed: {str(e)}")


@router.post("/fiscal", response_model=FiscalCostResponse)
async def run_fiscal_analysis(reform: ReformRequest):
    """Run fiscal cost analysis only."""
    try:
        from cpid_calc.calculations.fiscal import calculate_fiscal_cost

        config = convert_reform_request_to_config(reform)
        fiscal = calculate_fiscal_cost(config, config.states or None, config.year)
        return FiscalCostResponse(**fiscal.to_dict())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fiscal analysis failed: {str(e)}")


@router.post("/distributional", response_model=DistributionalResponse)
async def run_distributional_analysis(reform: ReformRequest):
    """Run distributional impact analysis only."""
    try:
        from cpid_calc.calculations.distributional import calculate_distributional_impact

        config = convert_reform_request_to_config(reform)
        distributional = calculate_distributional_impact(config, config.states or None, config.year)

        dist_dict = distributional.to_dict()
        return DistributionalResponse(
            decile_impacts=[DecileImpactResponse(**d) for d in dist_dict["decile_impacts"]],
            average_gain_all=dist_dict["average_gain_all"],
            average_gain_bottom_50=dist_dict["average_gain_bottom_50"],
            average_gain_top_10=dist_dict["average_gain_top_10"],
            share_to_bottom_20_pct=dist_dict["share_to_bottom_20_pct"],
            share_to_bottom_50_pct=dist_dict["share_to_bottom_50_pct"],
            share_to_top_20_pct=dist_dict["share_to_top_20_pct"],
            share_to_top_10_pct=dist_dict["share_to_top_10_pct"],
            baseline_gini=dist_dict["baseline_gini"],
            reform_gini=dist_dict["reform_gini"],
            gini_change=dist_dict["gini_change"],
            percent_gaining=dist_dict["percent_gaining"],
            percent_losing=dist_dict["percent_losing"],
            percent_unchanged=dist_dict["percent_unchanged"],
            state=dist_dict.get("state"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distributional analysis failed: {str(e)}")
