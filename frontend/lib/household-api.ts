import axios from 'axios';
import type {
  HouseholdInput,
  HouseholdResults,
  HouseholdImpact,
  StateReformOptions,
  StatePrograms,
  IncomeSweepResponse,
} from './household-types';
import {
  getReformOptionsForState,
  getStateProgramsSummary,
} from './state-programs';
import {
  calculateBaselineViaApi,
  calculateImpactViaApi,
  runIncomeSweepViaApi,
} from './pe-api';
import {
  createPolicy,
  modalConfigured,
  runHouseholdSweepOnModal,
} from './modalApi';
import { buildStateEitcReform } from './state-programs';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Static lookup — moved off the FastAPI backend so the Vercel build
// (no Python runtime) can resolve these without a network hop. Source
// of truth: cpid_calc/data/state_programs.py + frontend/lib/state-programs.ts.
export async function getStatePrograms(stateCode: string): Promise<StatePrograms> {
  const summary = getStateProgramsSummary(stateCode);
  if (!summary) {
    throw new Error(`Unknown state code: ${stateCode}`);
  }
  return summary as StatePrograms;
}

export async function getReformOptions(
  stateCode: string,
): Promise<StateReformOptions> {
  return getReformOptionsForState(stateCode) as unknown as StateReformOptions;
}

/** Try the local FastAPI shim first (used by `make dev`); on 404 (the
 *  Vercel deployment has no Python backend) fall back to direct
 *  api.policyengine.org calls so production at least computes. */
async function tryLocalThen<T>(
  attempt: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await attempt();
  } catch (err: unknown) {
    const status =
      (err as { response?: { status?: number } })?.response?.status;
    const code = (err as { code?: string })?.code;
    if (status === 404 || status === 500 || code === 'ERR_NETWORK') {
      return await fallback();
    }
    throw err;
  }
}

/** Map a single Modal IncomeSweep point into our HouseholdResults shape.
 *  Modal returns net_income, federal_ctc, federal_eitc, state_ctc,
 *  state_eitc, snap_benefits, in_poverty per point; the remaining fields
 *  on HouseholdResults (taxes, AGI, poverty gap, …) aren't currently
 *  surfaced by the dashboard's overview/poverty tabs so they're stubbed. */
function pointToResults(
  household: HouseholdInput,
  point: {
    net_income: number;
    federal_ctc: number;
    federal_eitc: number;
    state_ctc: number;
    state_eitc: number;
    snap_benefits: number;
    in_poverty: boolean;
  },
): HouseholdResults {
  const grossIncome =
    (household.income.employment_income || 0) +
    (household.income.spouse_employment_income || 0) +
    (household.income.self_employment_income || 0) +
    (household.income.social_security_income || 0) +
    (household.income.unemployment_income || 0);
  return {
    year: household.year,
    state: household.state,
    gross_income: grossIncome,
    adjusted_gross_income: grossIncome,
    federal_income_tax: 0,
    state_income_tax: 0,
    payroll_tax: 0,
    net_income: point.net_income,
    federal_ctc: point.federal_ctc,
    federal_eitc: point.federal_eitc,
    state_ctc: point.state_ctc,
    state_eitc: point.state_eitc,
    snap_benefits: point.snap_benefits,
    total_benefits: point.snap_benefits,
    in_poverty: point.in_poverty,
    in_deep_poverty: false,
    poverty_gap: 0,
    effective_tax_rate: 0,
    total_child_benefits: point.federal_ctc + point.federal_eitc,
  };
}

/** Common single-point Modal household call. Returns the first (and
 *  only) point from a Modal sweep at the household's employment income. */
async function singlePointOnModal(
  household: HouseholdInput,
  policyId: number,
): Promise<{
  baseline: HouseholdResults;
  reform: HouseholdResults;
}> {
  const sweep = await runHouseholdSweepOnModal({
    policy_id: policyId,
    year: household.year,
    state: household.state,
    married: household.adults.length > 1,
    head_age: household.adults[0]?.age ?? 35,
    spouse_age: household.adults[1]?.age ?? null,
    dependent_ages: household.children.map((c) => c.age),
    income_range: [household.income.employment_income || 0],
    spouse_employment_income: household.income.spouse_employment_income ?? 0,
    self_employment_income: household.income.self_employment_income ?? 0,
    social_security: household.income.social_security_income ?? 0,
    unemployment_compensation: household.income.unemployment_income ?? 0,
    taxable_pension_income:
      (household.income.pension_income ?? 0) +
      (household.income.taxable_retirement_distributions ?? 0),
    long_term_capital_gains: household.income.capital_gains ?? 0,
    qualified_dividend_income: household.income.dividend_income ?? 0,
    taxable_interest_income: household.income.taxable_interest_income ?? 0,
  });
  const basePoint = sweep.baseline_data_points?.[0] ?? sweep.data_points[0];
  const reformPoint = sweep.data_points[0];
  return {
    baseline: pointToResults(household, basePoint),
    reform: pointToResults(household, reformPoint),
  };
}

// Calculate baseline for household. Modal first when configured.
export async function calculateBaseline(
  household: HouseholdInput,
): Promise<HouseholdResults> {
  if (modalConfigured()) {
    try {
      const { baseline } = await singlePointOnModal(household, 1);
      return baseline;
    } catch (err) {
      console.warn('Modal baseline failed; falling back', err);
    }
  }
  return tryLocalThen(
    async () => (await api.post('/household/baseline', household)).data,
    () => calculateBaselineViaApi(household),
  );
}

// Calculate impact of reforms. Modal first when configured.
export async function calculateImpact(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>,
): Promise<HouseholdImpact> {
  if (modalConfigured()) {
    try {
      const reformDict = buildReformDict(
        household,
        reformOptionIds,
        parameterValues,
      );
      const policyId =
        Object.keys(reformDict).length > 0
          ? await createPolicy(reformDict)
          : 1;
      const { baseline, reform } = await singlePointOnModal(household, policyId);
      const netChange = reform.net_income - baseline.net_income;
      return {
        baseline,
        reform,
        net_income_change: netChange,
        percent_income_change:
          baseline.net_income > 0
            ? (netChange / baseline.net_income) * 100
            : 0,
        ctc_change: reform.federal_ctc - baseline.federal_ctc,
        eitc_change: reform.federal_eitc - baseline.federal_eitc,
        poverty_status_change:
          baseline.in_poverty && !reform.in_poverty
            ? 'lifted'
            : !baseline.in_poverty && reform.in_poverty
              ? 'fell_into'
              : 'unchanged',
      };
    } catch (err) {
      console.warn('Modal impact failed; falling back', err);
    }
  }
  return tryLocalThen(
    async () =>
      (
        await api.post('/household/impact', {
          household,
          reform_option_ids: reformOptionIds,
        })
      ).data,
    () =>
      calculateImpactViaApi(household, reformOptionIds, parameterValues),
  );
}

function buildIncomes(min: number, max: number, step: number): number[] {
  const xs: number[] = [];
  for (let v = min; v <= max; v += step) xs.push(v);
  return xs;
}

/** Build the PolicyEngine-US parameter dict for the reforms this dashboard
 *  exposes. Mirrors pe-api.ts::reformFromOptions but kept inline here so
 *  the Modal path doesn't pull in the full pe-api module. */
function buildReformDict(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>,
): Record<string, Record<string, number | boolean>> {
  const year = household.year;
  const reform: Record<string, Record<string, number | boolean>> = {};
  for (const id of reformOptionIds) {
    if (id.endsWith('_eitc')) {
      const state = id.slice(0, 2).toUpperCase();
      const ratePct = parameterValues?.[id]?.match_rate ?? 30;
      Object.assign(reform, buildStateEitcReform(state, ratePct / 100, year));
    }
    if (id === 'federal_ctc_expanded') {
      const range = `${year}-01-01.2100-12-31`;
      reform['gov.irs.credits.ctc.refundable.fully_refundable'] = {
        [range]: true,
      };
      reform['gov.irs.credits.ctc.phase_out.threshold.SINGLE'] = {
        [range]: 75_000,
      };
      reform['gov.irs.credits.ctc.phase_out.threshold.JOINT'] = {
        [range]: 150_000,
      };
    }
  }
  return reform;
}

// Run income sweep analysis. Modal first (if configured), then the local
// FastAPI shim, then a direct api.policyengine.org sweep.
export async function runIncomeSweep(
  household: HouseholdInput,
  reformOptionIds?: string[],
  minIncome: number = 0,
  maxIncome: number = 150000,
  step: number = 5000,
  parameterValues?: Record<string, Record<string, number>>,
): Promise<IncomeSweepResponse> {
  const ids = reformOptionIds ?? [];
  if (modalConfigured()) {
    try {
      const reform = buildReformDict(household, ids, parameterValues);
      const policyId =
        Object.keys(reform).length > 0 ? await createPolicy(reform) : 1;
      return await runHouseholdSweepOnModal({
        policy_id: policyId,
        year: household.year,
        state: household.state,
        married: household.adults.length > 1,
        head_age: household.adults[0]?.age ?? 35,
        spouse_age: household.adults[1]?.age ?? null,
        dependent_ages: household.children.map((c) => c.age),
        income_range: buildIncomes(minIncome, maxIncome, step),
        spouse_employment_income:
          household.income.spouse_employment_income ?? 0,
        self_employment_income:
          household.income.self_employment_income ?? 0,
        social_security: household.income.social_security_income ?? 0,
        unemployment_compensation: household.income.unemployment_income ?? 0,
        taxable_pension_income:
          (household.income.pension_income ?? 0) +
          (household.income.taxable_retirement_distributions ?? 0),
        long_term_capital_gains: household.income.capital_gains ?? 0,
        qualified_dividend_income: household.income.dividend_income ?? 0,
        taxable_interest_income:
          household.income.taxable_interest_income ?? 0,
      });
    } catch (err) {
      console.warn('Modal household sweep failed; falling back', err);
    }
  }
  return tryLocalThen(
    async () => {
      const params = new URLSearchParams({
        min_income: minIncome.toString(),
        max_income: maxIncome.toString(),
        step: step.toString(),
      });
      if (ids.length > 0) {
        ids.forEach((id) => params.append('reform_option_ids', id));
      }
      const response = await api.post(
        `/household/income-sweep?${params}`,
        household,
      );
      return response.data;
    },
    () =>
      runIncomeSweepViaApi(
        household,
        ids,
        parameterValues ?? {},
        minIncome,
        maxIncome,
        step,
      ),
  );
}

export default api;
