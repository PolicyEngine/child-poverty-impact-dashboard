"""
Microsimulation helpers for running PolicyEngine simulations.
"""

from typing import Any, List, Optional, Tuple

import policyengine as pe

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.reforms.builder import create_reform


# State FIPS codes for filtering
STATE_FIPS = {
    "AL": "01",
    "AK": "02",
    "AZ": "04",
    "AR": "05",
    "CA": "06",
    "CO": "08",
    "CT": "09",
    "DE": "10",
    "DC": "11",
    "FL": "12",
    "GA": "13",
    "HI": "15",
    "ID": "16",
    "IL": "17",
    "IN": "18",
    "IA": "19",
    "KS": "20",
    "KY": "21",
    "LA": "22",
    "ME": "23",
    "MD": "24",
    "MA": "25",
    "MI": "26",
    "MN": "27",
    "MS": "28",
    "MO": "29",
    "MT": "30",
    "NE": "31",
    "NV": "32",
    "NH": "33",
    "NJ": "34",
    "NM": "35",
    "NY": "36",
    "NC": "37",
    "ND": "38",
    "OH": "39",
    "OK": "40",
    "OR": "41",
    "PA": "42",
    "RI": "44",
    "SC": "45",
    "SD": "46",
    "TN": "47",
    "TX": "48",
    "UT": "49",
    "VT": "50",
    "VA": "51",
    "WA": "53",
    "WV": "54",
    "WI": "55",
    "WY": "56",
}

# Reverse mapping
FIPS_TO_STATE = {v: k for k, v in STATE_FIPS.items()}

DATASET_RELEASE = "1.110.12"
NATIONAL_DATASET = (
    f"hf://policyengine/policyengine-us-data/enhanced_cps_2024.h5@{DATASET_RELEASE}"
)
MANAGED_DATASETS = {
    "enhanced_cps_2024",
    NATIONAL_DATASET,
}


def get_state_dataset(state_code: str) -> str:
    """
    Get the Hugging Face dataset path for a specific state.

    Args:
        state_code: Two-letter state code (e.g., "NY", "CA", "DC")

    Returns:
        Dataset path in format "hf://policyengine/policyengine-us-data/states/{STATE}.h5@{release}"
    """
    state = state_code.upper()
    if state not in STATE_FIPS:
        raise ValueError(f"Unknown state code: {state_code}")
    return f"hf://policyengine/policyengine-us-data/states/{state}.h5@{DATASET_RELEASE}"


def _create_microsimulation(dataset: str, reform=None):
    sim = pe.us.managed_microsimulation(
        dataset=dataset,
        reform=reform,
        allow_unmanaged=dataset not in MANAGED_DATASETS,
    )
    if not hasattr(sim, "calc"):
        sim.calc = sim.calculate
    return sim


def run_microsimulation(
    config: ReformConfig,
    dataset: Optional[str] = None,
    state: Optional[str] = None,
) -> Tuple[Any, Any]:
    """
    Run a microsimulation comparing baseline to reform.

    Args:
        config: ReformConfig with policy parameters
        dataset: Dataset to use for simulation (overrides state if provided)
        state: State code to use state-specific dataset (e.g., "NY", "CA")

    Returns:
        Tuple of (baseline_sim, reform_sim)
    """
    # Determine dataset to use
    if dataset is None:
        if state:
            dataset = get_state_dataset(state)
        else:
            dataset = NATIONAL_DATASET

    # Create the reform
    reform = create_reform(config)

    # Run baseline simulation
    baseline = _create_microsimulation(dataset=dataset)

    # Run reform simulation
    # If reform is None (no actual parameter changes), reform_sim equals baseline
    if reform is not None:
        reform_sim = _create_microsimulation(dataset=dataset, reform=reform)
    else:
        reform_sim = _create_microsimulation(dataset=dataset)

    return baseline, reform_sim


def get_state_filter(
    sim: Any,
    states: List[str],
    map_to: str = "person",
):
    """
    Get a boolean filter for specific states.

    Args:
        sim: Microsimulation object
        states: List of state codes to include
        map_to: Entity level for the returned filter

    Returns:
        Boolean MicroSeries for filtering
    """
    state_codes = sim.calc("state_code", map_to=map_to)
    if not states:
        # No filter - include all
        return state_codes == state_codes

    state_list = [s.upper() for s in states if s.upper() in STATE_FIPS]
    if not state_list:
        return state_codes != state_codes

    mask = state_codes == state_list[0]
    for state in state_list[1:]:
        mask = mask | (state_codes == state)
    return mask


def get_child_filter(
    sim: Any,
    max_age: int = 17,
    min_age: int = 0,
    year: int = 2025,
):
    """
    Get a boolean filter for children of specific ages.

    Args:
        sim: Microsimulation object
        max_age: Maximum age (inclusive)
        min_age: Minimum age (inclusive)
        year: Year for age calculation

    Returns:
        Boolean MicroSeries for filtering
    """
    age = sim.calc("age", period=year, map_to="person")
    return (age >= min_age) & (age <= max_age)


def get_young_child_filter(
    sim: Any,
    max_age: int = 3,
    year: int = 2025,
):
    """
    Get a boolean filter for young children (0-3).

    Args:
        sim: Microsimulation object
        max_age: Maximum age for "young child" (default 3)
        year: Year for age calculation

    Returns:
        Boolean MicroSeries for filtering
    """
    return get_child_filter(sim, max_age=max_age, min_age=0, year=year)


def micro_sum(values, filter_mask=None) -> float:
    """Return a MicroSeries sum, optionally after applying a boolean mask."""
    if filter_mask is not None:
        values = values[filter_mask]
    return float(values.sum())


def micro_mean(values, filter_mask=None) -> float:
    """Return a MicroSeries mean, optionally after applying a boolean mask."""
    if filter_mask is not None:
        values = values[filter_mask]
    count = float((values * 0 + 1).sum())
    return float(values.mean()) if count > 0 else 0.0
