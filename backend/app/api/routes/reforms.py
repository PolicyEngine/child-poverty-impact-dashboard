"""
API routes for reform configurations.
"""

from typing import List
from fastapi import APIRouter, HTTPException

from app.api.models.reforms import ReformRequest
from app.api.models.responses import PresetReformResponse

router = APIRouter()


# Preset reform configurations
PRESET_REFORMS = {
    "expanded_ctc_2021": {
        "id": "expanded_ctc_2021",
        "name": "2021 Expanded CTC",
        "description": "American Rescue Plan CTC: $3,600 for children under 6, $3,000 for children 6-17, fully refundable",
        "category": "ctc",
        "estimated_cost_billions": 105,
        "estimated_poverty_reduction_pct": 40,
    },
    "romney_fsa": {
        "id": "romney_fsa",
        "name": "Romney Family Security Act",
        "description": "$4,200/year for children under 6, $3,000/year for children 6-17, monthly payments",
        "category": "ctc",
        "estimated_cost_billions": 66,
        "estimated_poverty_reduction_pct": 35,
    },
    "universal_child_allowance": {
        "id": "universal_child_allowance",
        "name": "Universal Child Allowance",
        "description": "$3,000/year for all children with no income phaseout",
        "category": "ctc",
        "estimated_cost_billions": 220,
        "estimated_poverty_reduction_pct": 55,
    },
    "eitc_expansion_50": {
        "id": "eitc_expansion_50",
        "name": "50% EITC Expansion",
        "description": "Increase EITC benefits by 50% for all eligible workers",
        "category": "eitc",
        "estimated_cost_billions": 35,
        "estimated_poverty_reduction_pct": 15,
    },
    "eitc_individualized": {
        "id": "eitc_individualized",
        "name": "Individualized EITC",
        "description": "Calculate EITC on individual earnings instead of household",
        "category": "eitc",
        "estimated_cost_billions": 25,
        "estimated_poverty_reduction_pct": 10,
    },
    "snap_15_increase": {
        "id": "snap_15_increase",
        "name": "15% SNAP Increase",
        "description": "Increase SNAP benefits by 15%",
        "category": "snap",
        "estimated_cost_billions": 12,
        "estimated_poverty_reduction_pct": 8,
    },
    "young_child_allowance": {
        "id": "young_child_allowance",
        "name": "Young Child Allowance",
        "description": "$4,000/year for children ages 0-5",
        "category": "ubi",
        "estimated_cost_billions": 95,
        "estimated_poverty_reduction_pct": 30,
    },
}


@router.get("/presets", response_model=List[PresetReformResponse])
async def get_preset_reforms():
    """Get list of preset reform configurations."""
    return [PresetReformResponse(**preset) for preset in PRESET_REFORMS.values()]


@router.get("/presets/{preset_id}", response_model=PresetReformResponse)
async def get_preset_reform(preset_id: str):
    """Get a specific preset reform configuration."""
    if preset_id not in PRESET_REFORMS:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' not found")
    return PresetReformResponse(**PRESET_REFORMS[preset_id])


@router.post("/validate")
async def validate_reform(reform: ReformRequest):
    """Validate a reform configuration."""
    enabled_reforms = []
    if reform.ctc.enabled:
        enabled_reforms.append("ctc")
    if reform.eitc.enabled:
        enabled_reforms.append("eitc")
    if reform.dependent_exemption.enabled:
        enabled_reforms.append("dependent_exemption")
    if reform.ubi.enabled:
        enabled_reforms.append("ubi")
    if reform.snap.enabled:
        enabled_reforms.append("snap")
    if reform.state_ctc.enabled:
        enabled_reforms.append("state_ctc")

    if not enabled_reforms:
        return {
            "valid": False,
            "message": "At least one reform must be enabled",
            "enabled_reforms": [],
        }

    # Check for state CTC without state specified
    if reform.state_ctc.enabled and not reform.state_ctc.state:
        return {
            "valid": False,
            "message": "State CTC requires a state to be specified",
            "enabled_reforms": enabled_reforms,
        }

    return {
        "valid": True,
        "message": "Reform configuration is valid",
        "enabled_reforms": enabled_reforms,
    }
