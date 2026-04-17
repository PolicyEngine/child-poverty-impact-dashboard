"""
PolicyEngine API client.

Calls the PolicyEngine API directly for economy-wide calculations,
following the same pattern used in policyengine-app-v2.
"""

import asyncio
import httpx
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import time


# PolicyEngine API base URL
POLICYENGINE_API_URL = "https://api.policyengine.org"


@dataclass
class EconomyCalculationResult:
    """Result from economy-wide calculation."""
    # Budget
    budgetary_impact: float
    benefit_spending_impact: float
    tax_revenue_impact: float
    state_tax_revenue_impact: float
    baseline_net_income: float
    households: int

    # Poverty
    poverty: Dict[str, Dict[str, float]]  # {all, child, adult, senior} x {baseline, reform}
    deep_poverty: Dict[str, Dict[str, float]]

    # Decile impacts
    decile_average: Dict[str, float]  # {"1": ..., "2": ..., ..., "10": ...}
    decile_relative: Dict[str, float]

    # Inequality
    gini: Dict[str, float]  # {baseline, reform}
    top_10_pct_share: Dict[str, float]
    top_1_pct_share: Dict[str, float]

    # Winners/Losers
    intra_decile: Dict[str, Any]

    # Raw response for additional data
    raw: Dict[str, Any]


class PolicyEngineClient:
    """Client for PolicyEngine API."""

    def __init__(self, base_url: str = POLICYENGINE_API_URL):
        self.base_url = base_url
        self.country = "us"  # US-focused for child poverty dashboard

    async def create_policy(
        self,
        reform_dict: Dict[str, Any],
        label: str = "Child Poverty Impact Reform",
    ) -> int:
        """
        Create a policy in PolicyEngine and get its ID.

        Args:
            reform_dict: Reform parameters in PolicyEngine format
                e.g., {"gov.irs.credits.ctc.refundable.fully_refundable": {"2025-01-01": True}}
            label: Display label for the policy

        Returns:
            Policy ID
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/{self.country}/policy",
                json={
                    "data": reform_dict,
                    "label": label,
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["result"]["policy_id"]

    async def get_economy_calculation(
        self,
        reform_policy_id: int,
        baseline_policy_id: int = 1,  # ID 1 is current law baseline
        region: str = "us",  # "us" for national, state code for state
        time_period: int = 2025,
        max_wait_seconds: int = 300,
        poll_interval_seconds: float = 2.0,
    ) -> EconomyCalculationResult:
        """
        Run economy-wide calculation and wait for results.

        This replicates the pattern from policyengine-app-v2:
        GET /{country}/economy/{reform_policy_id}/over/{baseline_policy_id}

        Args:
            reform_policy_id: ID of reform policy
            baseline_policy_id: ID of baseline policy (1 = current law)
            region: "us" for national, or state code like "ny", "ca"
            time_period: Year for calculation
            max_wait_seconds: Maximum time to wait for result
            poll_interval_seconds: Time between status checks

        Returns:
            EconomyCalculationResult with all impacts
        """
        url = (
            f"{self.base_url}/{self.country}/economy"
            f"/{reform_policy_id}/over/{baseline_policy_id}"
        )
        params = {
            "region": region.lower(),
            "time_period": str(time_period),
        }

        start_time = time.time()

        async with httpx.AsyncClient(timeout=60.0) as client:
            while True:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()

                status = data.get("status")

                if status == "ok":
                    # Calculation complete
                    return self._parse_economy_result(data["result"])

                elif status == "computing":
                    # Still computing - wait and retry
                    elapsed = time.time() - start_time
                    if elapsed > max_wait_seconds:
                        raise TimeoutError(
                            f"Economy calculation timed out after {max_wait_seconds}s"
                        )

                    queue_position = data.get("queue_position", "unknown")
                    print(f"Computing... queue position: {queue_position}")
                    await asyncio.sleep(poll_interval_seconds)

                elif status == "error":
                    error_msg = data.get("message", "Unknown error")
                    raise RuntimeError(f"PolicyEngine calculation error: {error_msg}")

                else:
                    raise RuntimeError(f"Unknown status: {status}")

    def _parse_economy_result(self, result: Dict[str, Any]) -> EconomyCalculationResult:
        """Parse the economy result from PolicyEngine API."""
        budget = result.get("budget", {})
        poverty_data = result.get("poverty", {})
        decile = result.get("decile", {})
        inequality = result.get("inequality", {})
        intra_decile = result.get("intra_decile", {})

        return EconomyCalculationResult(
            budgetary_impact=budget.get("budgetary_impact", 0),
            benefit_spending_impact=budget.get("benefit_spending_impact", 0),
            tax_revenue_impact=budget.get("tax_revenue_impact", 0),
            state_tax_revenue_impact=budget.get("state_tax_revenue_impact", 0),
            baseline_net_income=budget.get("baseline_net_income", 0),
            households=budget.get("households", 0),
            poverty=poverty_data.get("poverty", {}),
            deep_poverty=poverty_data.get("deep_poverty", {}),
            decile_average=decile.get("average", {}),
            decile_relative=decile.get("relative", {}),
            gini=inequality.get("gini", {}),
            top_10_pct_share=inequality.get("top_10_pct_share", {}),
            top_1_pct_share=inequality.get("top_1_pct_share", {}),
            intra_decile=intra_decile,
            raw=result,
        )

    async def run_statewide_analysis(
        self,
        reform_dict: Dict[str, Any],
        state: str,
        year: int = 2025,
        label: str = "Child Poverty Reform",
    ) -> Dict[str, Any]:
        """
        Run complete statewide analysis.

        This is the main entry point that:
        1. Creates baseline and reform policies
        2. Runs economy calculation via PolicyEngine API
        3. Returns formatted results matching our response models

        Args:
            reform_dict: Reform parameters in PolicyEngine format
            state: Two-letter state code (e.g., "NY", "CA")
            year: Tax year
            label: Policy label

        Returns:
            Dictionary with poverty, fiscal, distributional results
        """
        # Create baseline policy (empty = current law)
        baseline_id = await self.create_policy({}, "Current Law Baseline")

        # Create the reform policy
        policy_id = await self.create_policy(reform_dict, label)

        print(f"Created policies: baseline={baseline_id}, reform={policy_id}")
        print(f"Running economy calculation for {state}, year={year}")

        # Run economy calculation for the state
        result = await self.get_economy_calculation(
            reform_policy_id=policy_id,
            baseline_policy_id=baseline_id,
            region=state.lower(),
            time_period=year,
        )

        # Format results to match our response models
        return self._format_analysis_results(result, state)

    def _format_analysis_results(
        self,
        result: EconomyCalculationResult,
        state: str,
    ) -> Dict[str, Any]:
        """Format PolicyEngine results to match our API response models."""

        # Poverty impact
        poverty = result.poverty
        deep_poverty = result.deep_poverty

        child_baseline = poverty.get("child", {}).get("baseline", 0)
        child_reform = poverty.get("child", {}).get("reform", 0)
        child_change = child_reform - child_baseline
        child_pct_change = (child_change / child_baseline * 100) if child_baseline > 0 else 0

        # Estimate children lifted using rate change and household count
        # This is approximate - actual would need child population count
        children_lifted = int(abs(child_change) * result.households * 0.3)  # ~30% have children

        young_child_baseline = poverty.get("child", {}).get("baseline", 0)  # Use child as proxy
        young_child_reform = poverty.get("child", {}).get("reform", 0)

        deep_child_baseline = deep_poverty.get("child", {}).get("baseline", 0)
        deep_child_reform = deep_poverty.get("child", {}).get("reform", 0)

        poverty_dict = {
            # Rates as decimals (0-1), frontend will convert to percentages
            "baseline_child_poverty_rate": round(child_baseline, 4),
            "reform_child_poverty_rate": round(child_reform, 4),
            "child_poverty_change_pp": round(child_change * 100, 2),  # pp stays as percentage points
            "child_poverty_percent_change": round(child_pct_change, 1),  # percent change stays as %
            "baseline_young_child_poverty_rate": round(young_child_baseline, 4),
            "reform_young_child_poverty_rate": round(young_child_reform, 4),
            "young_child_poverty_change_pp": round((young_child_reform - young_child_baseline) * 100, 2),
            "young_child_poverty_percent_change": round(
                ((young_child_reform - young_child_baseline) / young_child_baseline * 100)
                if young_child_baseline > 0 else 0, 1
            ),
            "children_lifted_out_of_poverty": children_lifted,
            "young_children_lifted_out_of_poverty": int(children_lifted * 0.3),  # Estimate
            "baseline_deep_child_poverty_rate": round(deep_child_baseline, 4),
            "reform_deep_child_poverty_rate": round(deep_child_reform, 4),
            "deep_poverty_change_pp": round((deep_child_reform - deep_child_baseline) * 100, 2),
            "state": state,
        }

        # Fiscal impact
        # tax_revenue_impact is total (federal + state); federal = total - state
        federal_revenue_impact = result.tax_revenue_impact - result.state_tax_revenue_impact
        fiscal_dict = {
            "total_cost_billions": round(-result.budgetary_impact / 1e9, 2),
            "federal_cost_billions": round(-federal_revenue_impact / 1e9, 2),
            "state_cost_billions": round(-result.state_tax_revenue_impact / 1e9, 2),
            "ctc_cost_billions": 0,  # Not broken out in API response
            "eitc_cost_billions": 0,
            "dependent_exemption_cost_billions": 0,
            "ubi_cost_billions": 0,
            "snap_cost_billions": 0,
            "state_ctc_cost_billions": 0,
            "income_tax_change_billions": round(result.tax_revenue_impact / 1e9, 2),
            "payroll_tax_change_billions": 0,
            "cost_per_child": round(
                abs(result.budgetary_impact) / (result.households * 0.3)
                if result.households > 0 else 0, 0
            ),
            "cost_per_child_lifted_from_poverty": round(
                abs(result.budgetary_impact) / children_lifted
                if children_lifted > 0 else 0, 0
            ),
            "state": state,
        }

        # Distributional impact
        decile_average = result.decile_average
        decile_relative = result.decile_relative

        # Build decile impacts list
        decile_impacts = []
        total_benefit = sum(float(v) for v in decile_average.values())

        for i in range(1, 11):
            key = str(i)
            avg_gain = float(decile_average.get(key, 0))
            rel_gain = float(decile_relative.get(key, 0))

            # Estimate percent gaining/losing from intra_decile data
            intra = result.intra_decile
            deciles = intra.get("deciles", {})
            gain_more = deciles.get("Gain more than 5%", [0]*10)
            gain_less = deciles.get("Gain less than 5%", [0]*10)
            lose_less = deciles.get("Lose less than 5%", [0]*10)
            lose_more = deciles.get("Lose more than 5%", [0]*10)

            idx = i - 1
            pct_gaining = (
                (gain_more[idx] if len(gain_more) > idx else 0) +
                (gain_less[idx] if len(gain_less) > idx else 0)
            ) * 100
            pct_losing = (
                (lose_more[idx] if len(lose_more) > idx else 0) +
                (lose_less[idx] if len(lose_less) > idx else 0)
            ) * 100

            no_change_list = deciles.get("No change", [0]*10)
            decile_impacts.append({
                "decile": i,
                "average_gain": round(avg_gain, 2),
                "percent_gaining": round(pct_gaining, 1),
                "percent_losing": round(pct_losing, 1),
                "gain_more_than_5_pct": round((gain_more[idx] if len(gain_more) > idx else 0) * 100, 1),
                "gain_less_than_5_pct": round((gain_less[idx] if len(gain_less) > idx else 0) * 100, 1),
                "no_change_pct": round((no_change_list[idx] if len(no_change_list) > idx else 0) * 100, 1),
                "lose_less_than_5_pct": round((lose_less[idx] if len(lose_less) > idx else 0) * 100, 1),
                "lose_more_than_5_pct": round((lose_more[idx] if len(lose_more) > idx else 0) * 100, 1),
                "total_benefit_billions": round(avg_gain * result.households / 10 / 1e9, 3),
                "share_of_total_benefit": round(
                    avg_gain / total_benefit * 100 if total_benefit != 0 else 0, 1
                ),
            })

        # Calculate summary stats
        bottom_5_avg = sum(float(decile_average.get(str(i), 0)) for i in range(1, 6)) / 5
        top_10_avg = float(decile_average.get("10", 0))
        overall_avg = sum(float(v) for v in decile_average.values()) / 10

        # Gini and inequality
        gini_baseline = result.gini.get("baseline", 0)
        gini_reform = result.gini.get("reform", 0)

        all_intra = result.intra_decile.get("all", {})
        pct_gaining = (
            all_intra.get("Gain more than 5%", 0) +
            all_intra.get("Gain less than 5%", 0)
        ) * 100
        pct_losing = (
            all_intra.get("Lose more than 5%", 0) +
            all_intra.get("Lose less than 5%", 0)
        ) * 100
        pct_unchanged = all_intra.get("No change", 0) * 100

        distributional_dict = {
            "decile_impacts": decile_impacts,
            "average_gain_all": round(overall_avg, 2),
            "average_gain_bottom_50": round(bottom_5_avg, 2),
            "average_gain_top_10": round(top_10_avg, 2),
            "share_to_bottom_20_pct": round(
                sum(d["share_of_total_benefit"] for d in decile_impacts[:2]), 1
            ),
            "share_to_bottom_50_pct": round(
                sum(d["share_of_total_benefit"] for d in decile_impacts[:5]), 1
            ),
            "share_to_top_20_pct": round(
                sum(d["share_of_total_benefit"] for d in decile_impacts[8:]), 1
            ),
            "share_to_top_10_pct": round(decile_impacts[9]["share_of_total_benefit"], 1),
            "baseline_gini": round(gini_baseline, 4),
            "reform_gini": round(gini_reform, 4),
            "gini_change": round(gini_reform - gini_baseline, 4),
            "percent_gaining": round(pct_gaining, 1),
            "percent_losing": round(pct_losing, 1),
            "percent_unchanged": round(pct_unchanged, 1),
            "all_gain_more_than_5_pct": round(all_intra.get("Gain more than 5%", 0) * 100, 1),
            "all_gain_less_than_5_pct": round(all_intra.get("Gain less than 5%", 0) * 100, 1),
            "all_no_change_pct": round(all_intra.get("No change", 0) * 100, 1),
            "all_lose_less_than_5_pct": round(all_intra.get("Lose less than 5%", 0) * 100, 1),
            "all_lose_more_than_5_pct": round(all_intra.get("Lose more than 5%", 0) * 100, 1),
            "state": state,
        }

        return {
            "poverty": poverty_dict,
            "fiscal": fiscal_dict,
            "distributional": distributional_dict,
        }


# Global client instance
_client: Optional[PolicyEngineClient] = None


def get_policyengine_client() -> PolicyEngineClient:
    """Get the global PolicyEngine client instance."""
    global _client
    if _client is None:
        _client = PolicyEngineClient()
    return _client
