"""
Modal application for running PolicyEngine simulations.

Population-level analysis delegates to the package calculation modules so the
Modal path uses the same MicroSeries aggregation logic as local execution.
"""

import modal

app = modal.App("child-poverty-dashboard")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "policyengine[us]==4.4.3",
        "numpy>=1.24.0",
        "pandas>=2.0.0",
        "microdf-python>=0.3.0",
    )
    .add_local_python_source("cpid_calc")
)


@app.function(image=image, timeout=1800, memory=32768)
def run_population_analysis(
    reform_config_dict: dict,
    states: list,
    year: int,
) -> dict:
    """Run population poverty, fiscal, and distributional analysis on Modal."""
    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.calculations.impact import calculate_poverty_impact
    from cpid_calc.calculations.fiscal import calculate_fiscal_cost
    from cpid_calc.calculations.distributional import calculate_distributional_impact

    config = ReformConfig.from_dict(reform_config_dict)
    selected_states = states or None

    poverty_impact = calculate_poverty_impact(config, selected_states, year)
    fiscal_cost = calculate_fiscal_cost(config, selected_states, year)
    distributional_impact = calculate_distributional_impact(
        config, selected_states, year
    )

    return {
        "poverty": poverty_impact.to_dict(),
        "fiscal": fiscal_cost.to_dict(),
        "distributional": distributional_impact.to_dict(),
    }


@app.function(image=image, timeout=120, memory=2048)
def run_household_baseline(
    household_config_dict: dict,
    year: int,
) -> dict:
    """Run single household baseline simulation on Modal."""
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.household.simulation import run_household_simulation

    config = HouseholdConfig.from_dict(household_config_dict)
    result = run_household_simulation(config, year=year)
    return result.to_dict()


@app.function(image=image, timeout=120, memory=2048)
def run_household_impact(
    household_config_dict: dict,
    reform_config_dict: dict,
    year: int,
) -> dict:
    """Run household impact comparison on Modal."""
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.household.simulation import calculate_household_impact

    h_config = HouseholdConfig.from_dict(household_config_dict)
    r_config = ReformConfig.from_dict(reform_config_dict)

    impact = calculate_household_impact(h_config, r_config, year=year)
    return impact.to_dict()


@app.function(image=image, timeout=300, memory=2048)
def run_income_sweep(
    household_config_dict: dict,
    reform_config_dict: dict | None,
    income_range: list[float],
    year: int,
) -> list[dict]:
    """Run household income sweep analysis on Modal."""
    from cpid_calc.household.config import HouseholdConfig
    from cpid_calc.reforms.config import ReformConfig
    from cpid_calc.reforms.builder import create_reform
    from cpid_calc.household.simulation import run_household_simulation

    config = HouseholdConfig.from_dict(household_config_dict)
    reform = None
    if reform_config_dict:
        r_config = ReformConfig.from_dict(reform_config_dict)
        reform = create_reform(r_config)

    results = []
    for income in income_range:
        config_copy = HouseholdConfig.from_dict(config.to_dict())
        config_copy.income.employment_income = income

        household_results = run_household_simulation(
            config_copy, reform=reform, year=year
        )
        results.append(
            {
                "income": income,
                "results": household_results.to_dict(),
            }
        )

    return results
