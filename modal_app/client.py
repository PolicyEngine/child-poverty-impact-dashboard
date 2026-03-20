"""
Modal client wrapper for calling Modal functions from FastAPI.

Provides both sync and async interfaces for Modal function calls,
with fallback to local execution when Modal is disabled.
"""

import asyncio
from typing import Any, Dict, List, Optional
from functools import lru_cache


class ModalClient:
    """
    Client for calling Modal functions.

    Handles async/sync bridging and provides fallback to local execution.
    """

    def __init__(self, enabled: bool = True):
        """
        Initialize the Modal client.

        Args:
            enabled: Whether to use Modal (False = local execution)
        """
        self.enabled = enabled
        self._modal_functions = None

    def _get_modal_functions(self):
        """Lazy load Modal functions."""
        if self._modal_functions is None and self.enabled:
            try:
                import modal
                from modal_app.app import (
                    run_population_analysis,
                    run_household_baseline,
                    run_household_impact,
                    run_income_sweep,
                )
                self._modal_functions = {
                    "population_analysis": run_population_analysis,
                    "household_baseline": run_household_baseline,
                    "household_impact": run_household_impact,
                    "income_sweep": run_income_sweep,
                }
            except ImportError:
                self.enabled = False
                self._modal_functions = {}
        return self._modal_functions or {}

    async def run_population_analysis(
        self,
        reform_config_dict: dict,
        states: List[str],
        year: int,
    ) -> Dict[str, Any]:
        """
        Run population analysis (async).

        Args:
            reform_config_dict: Serialized ReformConfig
            states: List of state codes
            year: Tax year

        Returns:
            Dictionary with poverty, fiscal, distributional results
        """
        if not self.enabled:
            return await self._run_local_population_analysis(
                reform_config_dict, states, year
            )

        functions = self._get_modal_functions()
        if "population_analysis" not in functions:
            return await self._run_local_population_analysis(
                reform_config_dict, states, year
            )

        # Call Modal function
        result = await asyncio.to_thread(
            functions["population_analysis"].remote,
            reform_config_dict,
            states,
            year,
        )
        return result

    async def run_household_baseline(
        self,
        household_config_dict: dict,
        year: int,
    ) -> Dict[str, Any]:
        """
        Run household baseline simulation (async).

        Args:
            household_config_dict: Serialized HouseholdConfig
            year: Tax year

        Returns:
            Dictionary with household results
        """
        if not self.enabled:
            return await self._run_local_household_baseline(
                household_config_dict, year
            )

        functions = self._get_modal_functions()
        if "household_baseline" not in functions:
            return await self._run_local_household_baseline(
                household_config_dict, year
            )

        result = await asyncio.to_thread(
            functions["household_baseline"].remote,
            household_config_dict,
            year,
        )
        return result

    async def run_household_impact(
        self,
        household_config_dict: dict,
        reform_config_dict: dict,
        year: int,
    ) -> Dict[str, Any]:
        """
        Run household impact comparison (async).

        Args:
            household_config_dict: Serialized HouseholdConfig
            reform_config_dict: Serialized ReformConfig
            year: Tax year

        Returns:
            Dictionary with baseline vs reform comparison
        """
        if not self.enabled:
            return await self._run_local_household_impact(
                household_config_dict, reform_config_dict, year
            )

        functions = self._get_modal_functions()
        if "household_impact" not in functions:
            return await self._run_local_household_impact(
                household_config_dict, reform_config_dict, year
            )

        result = await asyncio.to_thread(
            functions["household_impact"].remote,
            household_config_dict,
            reform_config_dict,
            year,
        )
        return result

    async def run_income_sweep(
        self,
        household_config_dict: dict,
        reform_config_dict: Optional[dict],
        income_range: List[float],
        year: int,
    ) -> List[Dict[str, Any]]:
        """
        Run income sweep analysis (async).

        Args:
            household_config_dict: Serialized HouseholdConfig
            reform_config_dict: Optional serialized ReformConfig
            income_range: List of income values
            year: Tax year

        Returns:
            List of income/results dicts
        """
        if not self.enabled:
            return await self._run_local_income_sweep(
                household_config_dict, reform_config_dict, income_range, year
            )

        functions = self._get_modal_functions()
        if "income_sweep" not in functions:
            return await self._run_local_income_sweep(
                household_config_dict, reform_config_dict, income_range, year
            )

        result = await asyncio.to_thread(
            functions["income_sweep"].remote,
            household_config_dict,
            reform_config_dict,
            income_range,
            year,
        )
        return result

    # ===== LOCAL FALLBACK IMPLEMENTATIONS =====

    async def _run_local_population_analysis(
        self,
        reform_config_dict: dict,
        states: List[str],
        year: int,
    ) -> Dict[str, Any]:
        """Local fallback for population analysis."""
        def _run():
            from cpid_calc.reforms.config import ReformConfig
            from cpid_calc.calculations.impact import calculate_poverty_impact
            from cpid_calc.calculations.fiscal import calculate_fiscal_cost
            from cpid_calc.calculations.distributional import calculate_distributional_impact

            config = ReformConfig.from_dict(reform_config_dict)

            poverty = calculate_poverty_impact(config, states or None, year)
            fiscal = calculate_fiscal_cost(config, states or None, year)
            distributional = calculate_distributional_impact(config, states or None, year)

            return {
                "poverty": poverty.to_dict(),
                "fiscal": fiscal.to_dict(),
                "distributional": distributional.to_dict(),
            }

        return await asyncio.to_thread(_run)

    async def _run_local_household_baseline(
        self,
        household_config_dict: dict,
        year: int,
    ) -> Dict[str, Any]:
        """Local fallback for household baseline."""
        def _run():
            from cpid_calc.household.config import HouseholdConfig
            from cpid_calc.household.simulation import run_household_simulation

            config = HouseholdConfig.from_dict(household_config_dict)
            result = run_household_simulation(config, year=year)
            return result.to_dict()

        return await asyncio.to_thread(_run)

    async def _run_local_household_impact(
        self,
        household_config_dict: dict,
        reform_config_dict: dict,
        year: int,
    ) -> Dict[str, Any]:
        """Local fallback for household impact."""
        def _run():
            from cpid_calc.household.config import HouseholdConfig
            from cpid_calc.reforms.config import ReformConfig
            from cpid_calc.household.simulation import calculate_household_impact

            h_config = HouseholdConfig.from_dict(household_config_dict)
            r_config = ReformConfig.from_dict(reform_config_dict)

            impact = calculate_household_impact(h_config, r_config, year=year)
            return impact.to_dict()

        return await asyncio.to_thread(_run)

    async def _run_local_income_sweep(
        self,
        household_config_dict: dict,
        reform_config_dict: Optional[dict],
        income_range: List[float],
        year: int,
    ) -> List[Dict[str, Any]]:
        """Local fallback for income sweep."""
        def _run():
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
                results.append({
                    "income": income,
                    "results": household_results.to_dict(),
                })

            return results

        return await asyncio.to_thread(_run)


@lru_cache(maxsize=1)
def get_modal_client(enabled: bool = True) -> ModalClient:
    """Get a cached Modal client instance."""
    return ModalClient(enabled=enabled)
