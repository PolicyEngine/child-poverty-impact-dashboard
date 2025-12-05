"""
Household-level simulation engine.

Runs PolicyEngine simulations for individual households and calculates
impacts of policy reforms.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple
from policyengine_us import Simulation
from policyengine_core.reforms import Reform

from cpid_calc.household.config import HouseholdConfig
from cpid_calc.household.builder import build_household_situation
from cpid_calc.reforms.config import ReformConfig
from cpid_calc.reforms.builder import create_reform
from cpid_calc.data.state_programs import get_state_programs


@dataclass
class HouseholdResults:
    """Results from a household simulation."""
    year: int
    state: str

    # Income and taxes
    gross_income: float
    adjusted_gross_income: float
    federal_income_tax: float
    state_income_tax: float
    payroll_tax: float
    net_income: float

    # Federal credits
    federal_ctc: float
    federal_eitc: float
    federal_cdcc: float
    other_federal_credits: float

    # State credits
    state_ctc: float
    state_eitc: float
    state_cdcc: float
    other_state_credits: float

    # Benefits
    snap_benefits: float
    tanf_benefits: float
    ssi_benefits: float
    wic_benefits: float
    housing_subsidy: float

    # Poverty status
    spm_resources: float
    spm_poverty_threshold: float
    in_poverty: bool
    in_deep_poverty: bool
    poverty_gap: float  # How far below poverty line

    # Child-specific
    ctc_per_child: float = 0
    total_child_benefits: float = 0

    def __post_init__(self):
        """Calculate derived fields."""
        self.total_federal_credits = (
            self.federal_ctc +
            self.federal_eitc +
            self.federal_cdcc +
            self.other_federal_credits
        )
        self.total_state_credits = (
            self.state_ctc +
            self.state_eitc +
            self.state_cdcc +
            self.other_state_credits
        )
        self.total_benefits = (
            self.snap_benefits +
            self.tanf_benefits +
            self.ssi_benefits +
            self.wic_benefits +
            self.housing_subsidy
        )
        self.total_child_benefits = (
            self.federal_ctc +
            self.state_ctc +
            self.federal_cdcc +
            self.state_cdcc
        )

    @property
    def effective_tax_rate(self) -> float:
        """Calculate effective tax rate."""
        if self.gross_income <= 0:
            return 0
        total_tax = self.federal_income_tax + self.state_income_tax + self.payroll_tax
        return total_tax / self.gross_income

    @property
    def marginal_benefit_rate(self) -> float:
        """Approximate marginal benefit rate (benefits as % of income)."""
        if self.gross_income <= 0:
            return 0
        return self.total_benefits / self.gross_income

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "year": self.year,
            "state": self.state,
            "gross_income": round(self.gross_income, 2),
            "adjusted_gross_income": round(self.adjusted_gross_income, 2),
            "federal_income_tax": round(self.federal_income_tax, 2),
            "state_income_tax": round(self.state_income_tax, 2),
            "payroll_tax": round(self.payroll_tax, 2),
            "net_income": round(self.net_income, 2),
            "federal_ctc": round(self.federal_ctc, 2),
            "federal_eitc": round(self.federal_eitc, 2),
            "federal_cdcc": round(self.federal_cdcc, 2),
            "state_ctc": round(self.state_ctc, 2),
            "state_eitc": round(self.state_eitc, 2),
            "state_cdcc": round(self.state_cdcc, 2),
            "total_federal_credits": round(self.total_federal_credits, 2),
            "total_state_credits": round(self.total_state_credits, 2),
            "snap_benefits": round(self.snap_benefits, 2),
            "tanf_benefits": round(self.tanf_benefits, 2),
            "total_benefits": round(self.total_benefits, 2),
            "spm_resources": round(self.spm_resources, 2),
            "spm_poverty_threshold": round(self.spm_poverty_threshold, 2),
            "in_poverty": self.in_poverty,
            "in_deep_poverty": self.in_deep_poverty,
            "poverty_gap": round(self.poverty_gap, 2),
            "effective_tax_rate": round(self.effective_tax_rate * 100, 2),
            "total_child_benefits": round(self.total_child_benefits, 2),
        }


@dataclass
class HouseholdImpact:
    """Impact of a reform on a household."""
    baseline: HouseholdResults
    reform: HouseholdResults

    # Calculated impacts
    net_income_change: float = 0
    federal_tax_change: float = 0
    state_tax_change: float = 0
    ctc_change: float = 0
    eitc_change: float = 0
    benefits_change: float = 0
    poverty_status_change: str = "unchanged"  # "lifted", "fell_into", "unchanged"

    def __post_init__(self):
        """Calculate impact metrics."""
        self.net_income_change = self.reform.net_income - self.baseline.net_income
        self.federal_tax_change = self.reform.federal_income_tax - self.baseline.federal_income_tax
        self.state_tax_change = self.reform.state_income_tax - self.baseline.state_income_tax
        self.ctc_change = (
            (self.reform.federal_ctc + self.reform.state_ctc) -
            (self.baseline.federal_ctc + self.baseline.state_ctc)
        )
        self.eitc_change = (
            (self.reform.federal_eitc + self.reform.state_eitc) -
            (self.baseline.federal_eitc + self.baseline.state_eitc)
        )
        self.benefits_change = self.reform.total_benefits - self.baseline.total_benefits

        # Determine poverty status change
        if self.baseline.in_poverty and not self.reform.in_poverty:
            self.poverty_status_change = "lifted"
        elif not self.baseline.in_poverty and self.reform.in_poverty:
            self.poverty_status_change = "fell_into"
        else:
            self.poverty_status_change = "unchanged"

    @property
    def percent_income_change(self) -> float:
        """Percentage change in net income."""
        if self.baseline.net_income <= 0:
            return 0
        return (self.net_income_change / self.baseline.net_income) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "baseline": self.baseline.to_dict(),
            "reform": self.reform.to_dict(),
            "net_income_change": round(self.net_income_change, 2),
            "percent_income_change": round(self.percent_income_change, 2),
            "federal_tax_change": round(self.federal_tax_change, 2),
            "state_tax_change": round(self.state_tax_change, 2),
            "ctc_change": round(self.ctc_change, 2),
            "eitc_change": round(self.eitc_change, 2),
            "benefits_change": round(self.benefits_change, 2),
            "poverty_status_change": self.poverty_status_change,
        }


def run_household_simulation(
    config: HouseholdConfig,
    reform: Optional[Reform] = None,
    year: int = None,
) -> HouseholdResults:
    """
    Run a PolicyEngine simulation for a single household.

    Args:
        config: Household configuration
        reform: Optional PolicyEngine Reform object
        year: Tax year (defaults to config.year)

    Returns:
        HouseholdResults with all calculated values
    """
    year = year or config.year

    # Build situation
    situation = build_household_situation(config, year)

    # Create simulation
    if reform:
        sim = Simulation(situation=situation, reform=reform)
    else:
        sim = Simulation(situation=situation)

    # Extract results
    results = _extract_results(sim, config.state, year, config.num_children)

    return results


def _extract_results(
    sim: Simulation,
    state: str,
    year: int,
    num_children: int,
) -> HouseholdResults:
    """Extract all relevant values from a simulation."""

    # Helper to safely get values
    def get_val(variable: str, default: float = 0) -> float:
        try:
            val = sim.calculate(variable, year)
            if hasattr(val, '__len__') and len(val) > 0:
                return float(val[0])
            return float(val)
        except Exception:
            return default

    # Income
    gross_income = get_val("household_market_income")
    agi = get_val("adjusted_gross_income")

    # Federal taxes
    federal_tax = get_val("income_tax")
    payroll_tax = get_val("employee_payroll_tax")

    # State taxes
    state_tax = get_val("state_income_tax")

    # Federal credits
    federal_ctc = get_val("ctc")
    federal_eitc = get_val("eitc")
    federal_cdcc = get_val("cdcc")
    other_federal = get_val("other_credits", 0)

    # State credits - try state-specific variables
    state_ctc = get_val(f"{state.lower()}_ctc", 0)
    if state_ctc == 0:
        # Try alternative names
        for alt in ["child_tax_credit", "yctc", "ctc", "child_credit"]:
            state_ctc = get_val(f"{state.lower()}_{alt}", 0)
            if state_ctc > 0:
                break

    state_eitc = get_val(f"{state.lower()}_eitc", 0)
    if state_eitc == 0:
        state_eitc = get_val(f"{state.lower()}_earned_income_credit", 0)

    state_cdcc = get_val(f"{state.lower()}_cdcc", 0)
    other_state = 0

    # Benefits
    snap = get_val("snap")
    tanf = get_val("tanf")
    ssi = get_val("ssi")
    wic = get_val("wic")
    housing = get_val("housing_subsidy", 0)

    # Net income
    net_income = get_val("household_net_income")

    # Poverty
    spm_resources = get_val("spm_unit_resources")
    spm_threshold = get_val("spm_unit_spm_threshold")
    in_poverty = get_val("spm_unit_is_in_spm_poverty") > 0.5
    in_deep_poverty = get_val("spm_unit_is_in_deep_spm_poverty") > 0.5

    poverty_gap = max(0, spm_threshold - spm_resources)

    # Per-child CTC
    ctc_per_child = (federal_ctc + state_ctc) / num_children if num_children > 0 else 0

    return HouseholdResults(
        year=year,
        state=state,
        gross_income=gross_income,
        adjusted_gross_income=agi,
        federal_income_tax=federal_tax,
        state_income_tax=state_tax,
        payroll_tax=payroll_tax,
        net_income=net_income,
        federal_ctc=federal_ctc,
        federal_eitc=federal_eitc,
        federal_cdcc=federal_cdcc,
        other_federal_credits=other_federal,
        state_ctc=state_ctc,
        state_eitc=state_eitc,
        state_cdcc=state_cdcc,
        other_state_credits=other_state,
        snap_benefits=snap,
        tanf_benefits=tanf,
        ssi_benefits=ssi,
        wic_benefits=wic,
        housing_subsidy=housing,
        spm_resources=spm_resources,
        spm_poverty_threshold=spm_threshold,
        in_poverty=in_poverty,
        in_deep_poverty=in_deep_poverty,
        poverty_gap=poverty_gap,
        ctc_per_child=ctc_per_child,
    )


def calculate_household_impact(
    config: HouseholdConfig,
    reform_config: ReformConfig,
    year: int = None,
) -> HouseholdImpact:
    """
    Calculate the impact of a reform on a household.

    Args:
        config: Household configuration
        reform_config: Reform configuration
        year: Tax year

    Returns:
        HouseholdImpact comparing baseline to reform
    """
    year = year or config.year

    # Run baseline
    baseline = run_household_simulation(config, reform=None, year=year)

    # Create and run reform
    reform = create_reform(reform_config)
    reform_results = run_household_simulation(config, reform=reform, year=year)

    return HouseholdImpact(baseline=baseline, reform=reform_results)


def run_income_sweep(
    config: HouseholdConfig,
    reform_config: Optional[ReformConfig] = None,
    income_range: Optional[List[float]] = None,
    year: int = None,
) -> List[Tuple[float, HouseholdResults]]:
    """
    Run simulations across a range of income levels.

    Useful for showing how benefits change with income.

    Args:
        config: Base household configuration
        reform_config: Optional reform to apply
        income_range: List of income values (defaults to 0-150000)
        year: Tax year

    Returns:
        List of (income, results) tuples
    """
    year = year or config.year

    if income_range is None:
        income_range = [i * 5000 for i in range(31)]  # 0 to 150,000

    reform = create_reform(reform_config) if reform_config else None

    results = []
    for income in income_range:
        # Update config with new income
        config_copy = HouseholdConfig.from_dict(config.to_dict())
        config_copy.income.employment_income = income

        household_results = run_household_simulation(config_copy, reform=reform, year=year)
        results.append((income, household_results))

    return results


def compare_states(
    config: HouseholdConfig,
    states: List[str],
    reform_config: Optional[ReformConfig] = None,
    year: int = None,
) -> Dict[str, HouseholdResults]:
    """
    Compare household results across multiple states.

    Args:
        config: Base household configuration (state will be overridden)
        states: List of state codes to compare
        reform_config: Optional reform to apply
        year: Tax year

    Returns:
        Dictionary mapping state codes to results
    """
    year = year or config.year
    reform = create_reform(reform_config) if reform_config else None

    results = {}
    for state in states:
        config_copy = HouseholdConfig.from_dict(config.to_dict())
        config_copy.state = state

        household_results = run_household_simulation(config_copy, reform=reform, year=year)
        results[state] = household_results

    return results
