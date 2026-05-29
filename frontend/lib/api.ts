import axios from 'axios';
import type {
  ReformRequest,
  AnalysisResponse,
  PovertyImpactResponse,
  FiscalCostResponse,
  DistributionalResponse,
  StateInfo,
  PresetReform,
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minute timeout for long-running PolicyEngine calculations
});

// Reform endpoints
export async function getPresetReforms(): Promise<PresetReform[]> {
  const response = await api.get('/reforms/presets');
  return response.data;
}

export async function getPresetReform(id: string): Promise<PresetReform> {
  const response = await api.get(`/reforms/presets/${id}`);
  return response.data;
}

export async function validateReform(
  reform: ReformRequest
): Promise<{ valid: boolean; message: string; enabled_reforms: string[] }> {
  const response = await api.post('/reforms/validate', reform);
  return response.data;
}

// Analysis endpoints
export async function runFullAnalysis(
  reform: ReformRequest
): Promise<AnalysisResponse> {
  const response = await api.post('/analysis/full', reform);
  return response.data;
}

export async function runPovertyAnalysis(
  reform: ReformRequest
): Promise<PovertyImpactResponse> {
  const response = await api.post('/analysis/poverty', reform);
  return response.data;
}

export async function runFiscalAnalysis(
  reform: ReformRequest
): Promise<FiscalCostResponse> {
  const response = await api.post('/analysis/fiscal', reform);
  return response.data;
}

export async function runDistributionalAnalysis(
  reform: ReformRequest
): Promise<DistributionalResponse> {
  const response = await api.post('/analysis/distributional', reform);
  return response.data;
}

export async function runAnalysisFromOptions(
  state: string,
  year: number,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>
): Promise<AnalysisResponse> {
  // Modal first when configured (production path); fall through to the
  // local FastAPI shim, then a direct api.policyengine.org call.
  const { modalConfigured, createPolicy, runEconomyOnModal } = await import(
    './modalApi'
  );
  if (modalConfigured()) {
    try {
      const { buildStateEitcReform } = await import('./state-programs');
      const reform: Record<string, Record<string, number | boolean>> = {};
      for (const id of reformOptionIds) {
        if (id.endsWith('_eitc')) {
          const st = id.slice(0, 2).toUpperCase();
          const ratePct = parameterValues?.[id]?.match_rate ?? 30;
          Object.assign(
            reform,
            buildStateEitcReform(st, ratePct / 100, year),
          );
        }
        if (id === 'federal_ctc_expanded') {
          const range = `${year}-01-01.2100-12-31`;
          reform['gov.irs.credits.ctc.refundable.fully_refundable'] = {
            [range]: true,
          };
        }
      }
      const policyId =
        Object.keys(reform).length > 0 ? await createPolicy(reform) : 1;
      const economy = await runEconomyOnModal(policyId, year, state);
      // Map Modal's EconomyImpactResult into the AnalysisResponse shape
      // the existing statewide tabs read. Only the fields used by the
      // tabs are populated; everything else gets a zero stub.
      const stub: unknown = {
        state,
        year,
        poverty: economy.poverty,
        fiscal: economy.fiscal,
        distributional: {},
      };
      return stub as AnalysisResponse;
    } catch (err) {
      console.warn('Modal economy failed; falling back', err);
    }
  }
  try {
    const response = await api.post('/analysis/from-options', {
      state,
      year,
      reform_option_ids: reformOptionIds,
      parameter_values: parameterValues,
    });
    return response.data;
  } catch (err: unknown) {
    const status =
      (err as { response?: { status?: number } })?.response?.status;
    const code = (err as { code?: string })?.code;
    if (status === 404 || status === 500 || code === 'ERR_NETWORK') {
      const { runStatewideViaApi } = await import('./pe-api');
      const householdShim = {
        state,
        year,
        filing_status: 'single' as const,
        adults: [{ age: 30 }],
        children: [],
        income: { employment_income: 0 },
      };
      return await runStatewideViaApi(
        state,
        year,
        reformOptionIds,
        parameterValues ?? {},
        householdShim,
      );
    }
    throw err;
  }
}

// State endpoints
export async function getAllStates(): Promise<StateInfo[]> {
  const response = await api.get('/states/');
  return response.data;
}

export async function getState(stateCode: string): Promise<StateInfo> {
  const response = await api.get(`/states/${stateCode}`);
  return response.data;
}

export async function getStatesWithCTC(): Promise<StateInfo[]> {
  const response = await api.get('/states/with-ctc');
  return response.data;
}

export async function getStatesWithoutCTC(): Promise<StateInfo[]> {
  const response = await api.get('/states/without-ctc');
  return response.data;
}

export interface StateComparisonResponse {
  reform_name: string;
  year: number;
  states: Array<{
    state_code: string;
    state_name: string;
    poverty_impact: PovertyImpactResponse;
    fiscal_cost: FiscalCostResponse;
  }>;
  national_poverty_impact: PovertyImpactResponse;
  national_fiscal_cost: FiscalCostResponse;
  states_by_poverty_reduction: string[];
  states_by_cost_effectiveness: string[];
}

export async function compareStates(
  reform: ReformRequest,
  states?: string[]
): Promise<StateComparisonResponse> {
  const params = states ? { states: states.join(',') } : {};
  const response = await api.post('/states/compare', reform, { params });
  return response.data;
}

export default api;
