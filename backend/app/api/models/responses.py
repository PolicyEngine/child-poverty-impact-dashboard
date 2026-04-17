"""
Pydantic models for API response payloads.
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class DecileImpactResponse(BaseModel):
    """Impact on a specific income decile."""
    decile: int = Field(ge=1, le=10)
    average_gain: float
    percent_gaining: float
    percent_losing: float
    gain_more_than_5_pct: float = 0
    gain_less_than_5_pct: float = 0
    no_change_pct: float = 0
    lose_less_than_5_pct: float = 0
    lose_more_than_5_pct: float = 0
    total_benefit_billions: float
    share_of_total_benefit: float


class PovertyImpactResponse(BaseModel):
    """Poverty impact analysis results."""
    baseline_child_poverty_rate: float
    reform_child_poverty_rate: float
    child_poverty_change_pp: float
    child_poverty_percent_change: float
    baseline_young_child_poverty_rate: float
    reform_young_child_poverty_rate: float
    young_child_poverty_change_pp: float
    young_child_poverty_percent_change: float
    children_lifted_out_of_poverty: int
    young_children_lifted_out_of_poverty: int
    baseline_deep_child_poverty_rate: float
    reform_deep_child_poverty_rate: float
    deep_poverty_change_pp: float
    state: Optional[str] = None


class FiscalCostResponse(BaseModel):
    """Fiscal cost analysis results."""
    total_cost_billions: float
    federal_cost_billions: float
    state_cost_billions: float
    ctc_cost_billions: float
    eitc_cost_billions: float
    dependent_exemption_cost_billions: float
    ubi_cost_billions: float
    snap_cost_billions: float
    state_ctc_cost_billions: float
    income_tax_change_billions: float
    payroll_tax_change_billions: float
    cost_per_child: float
    cost_per_child_lifted_from_poverty: float
    state: Optional[str] = None


class DistributionalResponse(BaseModel):
    """Distributional impact analysis results."""
    decile_impacts: List[DecileImpactResponse]
    average_gain_all: float
    average_gain_bottom_50: float
    average_gain_top_10: float
    share_to_bottom_20_pct: float
    share_to_bottom_50_pct: float
    share_to_top_20_pct: float
    share_to_top_10_pct: float
    baseline_gini: float
    reform_gini: float
    gini_change: float
    percent_gaining: float
    percent_losing: float
    percent_unchanged: float
    all_gain_more_than_5_pct: float = 0
    all_gain_less_than_5_pct: float = 0
    all_no_change_pct: float = 0
    all_lose_less_than_5_pct: float = 0
    all_lose_more_than_5_pct: float = 0
    state: Optional[str] = None


class AnalysisResponse(BaseModel):
    """Complete analysis response combining all impact types."""
    reform_name: str
    reform_description: str
    year: int
    states_analyzed: List[str]

    poverty_impact: PovertyImpactResponse
    fiscal_cost: FiscalCostResponse
    distributional_impact: DistributionalResponse

    # Summary metrics
    headline_stats: Dict[str, float] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "reform_name": "Expanded CTC",
                "reform_description": "Expand the CTC to $3,600 for young children",
                "year": 2024,
                "states_analyzed": ["CA", "TX", "NY"],
                "headline_stats": {
                    "child_poverty_reduction_pct": 25.5,
                    "total_cost_billions": 45.2,
                    "children_lifted_from_poverty": 1500000,
                },
            }
        }


class StateResult(BaseModel):
    """Results for a single state."""
    state_code: str
    state_name: str
    poverty_impact: PovertyImpactResponse
    fiscal_cost: FiscalCostResponse


class StateComparisonResponse(BaseModel):
    """State-by-state comparison results."""
    reform_name: str
    year: int
    states: List[StateResult]

    # Aggregate statistics
    national_poverty_impact: PovertyImpactResponse
    national_fiscal_cost: FiscalCostResponse

    # Rankings
    states_by_poverty_reduction: List[str]
    states_by_cost_effectiveness: List[str]


class StateInfoResponse(BaseModel):
    """Information about a state and its existing programs."""
    state_code: str
    state_name: str
    has_state_ctc: bool
    existing_ctc_amount: Optional[float] = None
    existing_ctc_age_eligibility: Optional[str] = None
    has_state_eitc: bool
    state_eitc_match_percent: Optional[float] = None


class PresetReformResponse(BaseModel):
    """A preset reform configuration."""
    id: str
    name: str
    description: str
    category: str  # e.g., "ctc", "eitc", "combined"
    estimated_cost_billions: Optional[float] = None
    estimated_poverty_reduction_pct: Optional[float] = None
