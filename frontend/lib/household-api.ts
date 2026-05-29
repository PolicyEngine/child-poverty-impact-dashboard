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

// Calculate baseline for household
export async function calculateBaseline(household: HouseholdInput): Promise<HouseholdResults> {
  const response = await api.post('/household/baseline', household);
  return response.data;
}

// Calculate impact of reforms
export async function calculateImpact(
  household: HouseholdInput,
  reformOptionIds: string[]
): Promise<HouseholdImpact> {
  const response = await api.post('/household/impact', {
    household,
    reform_option_ids: reformOptionIds,
  });
  return response.data;
}

// Run income sweep analysis
export async function runIncomeSweep(
  household: HouseholdInput,
  reformOptionIds?: string[],
  minIncome: number = 0,
  maxIncome: number = 150000,
  step: number = 5000
): Promise<IncomeSweepResponse> {
  const params = new URLSearchParams({
    min_income: minIncome.toString(),
    max_income: maxIncome.toString(),
    step: step.toString(),
  });

  if (reformOptionIds && reformOptionIds.length > 0) {
    reformOptionIds.forEach((id) => params.append('reform_option_ids', id));
  }

  const response = await api.post(`/household/income-sweep?${params}`, household);
  return response.data;
}

export default api;
