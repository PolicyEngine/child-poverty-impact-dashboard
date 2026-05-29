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

// Calculate baseline for household
export async function calculateBaseline(
  household: HouseholdInput,
): Promise<HouseholdResults> {
  return tryLocalThen(
    async () => (await api.post('/household/baseline', household)).data,
    () => calculateBaselineViaApi(household),
  );
}

// Calculate impact of reforms
export async function calculateImpact(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>,
): Promise<HouseholdImpact> {
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

// Run income sweep analysis
export async function runIncomeSweep(
  household: HouseholdInput,
  reformOptionIds?: string[],
  minIncome: number = 0,
  maxIncome: number = 150000,
  step: number = 5000,
  parameterValues?: Record<string, Record<string, number>>,
): Promise<IncomeSweepResponse> {
  return tryLocalThen(
    async () => {
      const params = new URLSearchParams({
        min_income: minIncome.toString(),
        max_income: maxIncome.toString(),
        step: step.toString(),
      });
      if (reformOptionIds && reformOptionIds.length > 0) {
        reformOptionIds.forEach((id) => params.append('reform_option_ids', id));
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
        reformOptionIds ?? [],
        parameterValues ?? {},
        minIncome,
        maxIncome,
        step,
      ),
  );
}

export default api;
