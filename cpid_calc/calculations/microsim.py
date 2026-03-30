"""
Microsimulation helpers for running PolicyEngine simulations.
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
from policyengine_us import Microsimulation
from policyengine_core.reforms import Reform

from cpid_calc.reforms.config import ReformConfig
from cpid_calc.reforms.builder import create_reform


# State FIPS codes for filtering
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
    "CO": "08", "CT": "09", "DE": "10", "DC": "11", "FL": "12",
    "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18",
    "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
    "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
    "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
    "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
    "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
    "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49",
    "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
    "WY": "56",
}

# Reverse mapping
FIPS_TO_STATE = {v: k for k, v in STATE_FIPS.items()}


def get_state_dataset(state_code: str) -> str:
    """
    Get the Hugging Face dataset path for a specific state.

    Args:
        state_code: Two-letter state code (e.g., "NY", "CA", "DC")

    Returns:
        Dataset path in format "hf://policyengine/policyengine-us-data/states/{STATE}.h5"
    """
    state = state_code.upper()
    if state not in STATE_FIPS:
        raise ValueError(f"Unknown state code: {state_code}")
    return f"hf://policyengine/policyengine-us-data/states/{state}.h5"


def run_microsimulation(
    config: ReformConfig,
    dataset: Optional[str] = None,
    state: Optional[str] = None,
) -> Tuple[Microsimulation, Microsimulation]:
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
            dataset = "enhanced_cps_2024"

    # Create the reform
    reform = create_reform(config)

    # Run baseline simulation
    baseline = Microsimulation(dataset=dataset)

    # Run reform simulation
    # If reform is None (no actual parameter changes), reform_sim equals baseline
    if reform is not None:
        reform_sim = Microsimulation(reform=reform, dataset=dataset)
    else:
        reform_sim = Microsimulation(dataset=dataset)

    return baseline, reform_sim


def get_state_filter(
    sim: Microsimulation,
    states: List[str],
) -> np.ndarray:
    """
    Get a boolean filter for specific states.

    Args:
        sim: Microsimulation object
        states: List of state codes to include

    Returns:
        Boolean array for filtering
    """
    if not states:
        # No filter - include all
        return np.ones(sim.calculate("person_id").shape, dtype=bool)

    state_codes = sim.calculate("state_code")
    fips_codes = [STATE_FIPS.get(s.upper()) for s in states if s.upper() in STATE_FIPS]

    return np.isin(state_codes, fips_codes)


def get_child_filter(
    sim: Microsimulation,
    max_age: int = 17,
    min_age: int = 0,
    year: int = 2025,
) -> np.ndarray:
    """
    Get a boolean filter for children of specific ages.

    Args:
        sim: Microsimulation object
        max_age: Maximum age (inclusive)
        min_age: Minimum age (inclusive)
        year: Year for age calculation

    Returns:
        Boolean array for filtering
    """
    age = sim.calculate("age", period=year)
    return (age >= min_age) & (age <= max_age)


def get_young_child_filter(
    sim: Microsimulation,
    max_age: int = 3,
    year: int = 2025,
) -> np.ndarray:
    """
    Get a boolean filter for young children (0-3).

    Args:
        sim: Microsimulation object
        max_age: Maximum age for "young child" (default 3)
        year: Year for age calculation

    Returns:
        Boolean array for filtering
    """
    return get_child_filter(sim, max_age=max_age, min_age=0, year=year)


def get_household_weight(
    sim: Microsimulation,
    year: Optional[int] = None,
) -> np.ndarray:
    """
    Get household weights for the simulation.

    Args:
        sim: Microsimulation object
        year: Optional year for weights

    Returns:
        Array of household weights
    """
    if year is not None:
        return sim.calculate("household_weight", period=year)
    return sim.calculate("household_weight")


def get_person_weight(
    sim: Microsimulation,
    year: Optional[int] = None,
) -> np.ndarray:
    """
    Get person weights for the simulation.

    Args:
        sim: Microsimulation object
        year: Optional year for weights

    Returns:
        Array of person weights
    """
    if year is not None:
        return sim.calculate("person_weight", period=year)
    return sim.calculate("person_weight")


def _to_numpy(arr) -> np.ndarray:
    """Convert MicroSeries or other array-like to numpy array."""
    if hasattr(arr, 'values'):
        return np.array(arr.values)
    return np.asarray(arr)


def calculate_weighted_sum(
    values: np.ndarray,
    weights: np.ndarray,
    filter_mask: Optional[np.ndarray] = None,
) -> float:
    """
    Calculate weighted sum with optional filtering.

    Args:
        values: Array of values (or MicroSeries)
        weights: Array of weights (or MicroSeries)
        filter_mask: Optional boolean filter

    Returns:
        Weighted sum
    """
    v = _to_numpy(values)
    w = _to_numpy(weights)
    if filter_mask is not None:
        f = _to_numpy(filter_mask)
        return float(np.sum(v[f] * w[f]))
    return float(np.sum(v * w))


def calculate_weighted_mean(
    values: np.ndarray,
    weights: np.ndarray,
    filter_mask: Optional[np.ndarray] = None,
) -> float:
    """
    Calculate weighted mean with optional filtering.

    Args:
        values: Array of values (or MicroSeries)
        weights: Array of weights (or MicroSeries)
        filter_mask: Optional boolean filter

    Returns:
        Weighted mean
    """
    v = _to_numpy(values)
    w = _to_numpy(weights)

    if filter_mask is not None:
        f = _to_numpy(filter_mask)
        v = v[f]
        w = w[f]

    total_weight = np.sum(w)
    if total_weight == 0:
        return 0.0
    return float(np.sum(v * w) / total_weight)
