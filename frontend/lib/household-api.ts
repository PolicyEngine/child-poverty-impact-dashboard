import axios from 'axios';
import type {
  HouseholdInput,
  HouseholdResults,
  HouseholdImpact,
  StateReformOptions,
  StatePrograms,
  IncomeSweepResponse,
} from './household-types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get current state programs
export async function getStatePrograms(stateCode: string): Promise<StatePrograms> {
  const response = await api.get(`/household/state-programs/${stateCode}`);
  return response.data;
}

// Get available reform options for a state
export async function getReformOptions(stateCode: string): Promise<StateReformOptions> {
  const response = await api.get(`/household/reform-options/${stateCode}`);
  return response.data;
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
