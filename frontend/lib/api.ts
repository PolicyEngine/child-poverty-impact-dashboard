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

/**
 * Modal's compact /economy response holds only what the cpid-backend
 * microsim currently computes: a handful of poverty rates plus three
 * fiscal aggregates. The statewide tabs were built for the legacy
 * FastAPI's much richer AnalysisResponse shape, so we translate here and
 * fill the gaps with zeros. The tabs surface those zero fields as "0%"
 * etc. — better than crashing, but a real fix requires expanding the
 * Modal endpoint to return young-child poverty, deep poverty, per-program
 * fiscal breakdown, and decile distributional data.
 *
 * Scale conversions:
 *   - Modal poverty rates are percentages (0-100); AnalysisResponse uses
 *     fractions (0-1), so divide by 100.
 *   - Modal fiscal numbers are raw dollars; AnalysisResponse uses
 *     billions, so divide by 1e9.
 *   - A reform that loses revenue / increases benefits produces a
 *     negative total_budgetary_impact on Modal. The tabs flip that into a
 *     positive "cost" via negation in the consumers; we keep that sign
 *     convention by negating here.
 */
function mapEconomyToAnalysisResponse(
  economy: import('./modalApi').EconomyImpactResult,
  state: string,
  year: number,
): AnalysisResponse {
  const baselineChild = (economy.poverty?.child_baseline_rate ?? 0) / 100;
  const reformChild = (economy.poverty?.child_reform_rate ?? 0) / 100;
  const childPpChange = (reformChild - baselineChild) * 100;
  const childPctChange =
    baselineChild > 0 ? ((reformChild - baselineChild) / baselineChild) * 100 : 0;

  const totalCostBillions = -(economy.fiscal?.total_budgetary_impact ?? 0) / 1e9;
  const federalCostBillions = -(economy.fiscal?.federal_tax_change ?? 0) / 1e9;
  const stateCostBillions = -(economy.fiscal?.state_tax_change ?? 0) / 1e9;
  const childrenLifted = economy.poverty?.children_lifted ?? 0;

  return {
    reform_name: 'Reform',
    reform_description: '',
    year,
    states_analyzed: [state],
    poverty_impact: {
      baseline_child_poverty_rate: baselineChild,
      reform_child_poverty_rate: reformChild,
      child_poverty_change_pp: childPpChange,
      child_poverty_percent_change: childPctChange,
      // Modal doesn't break out young-child or deep poverty yet.
      baseline_young_child_poverty_rate: 0,
      reform_young_child_poverty_rate: 0,
      young_child_poverty_change_pp: 0,
      young_child_poverty_percent_change: 0,
      children_lifted_out_of_poverty: childrenLifted,
      young_children_lifted_out_of_poverty: 0,
      baseline_deep_child_poverty_rate: 0,
      reform_deep_child_poverty_rate: 0,
      deep_poverty_change_pp: 0,
      state,
    },
    fiscal_cost: {
      total_cost_billions: totalCostBillions,
      federal_cost_billions: federalCostBillions,
      state_cost_billions: stateCostBillions,
      ctc_cost_billions: 0,
      eitc_cost_billions: 0,
      dependent_exemption_cost_billions: 0,
      ubi_cost_billions: 0,
      snap_cost_billions: 0,
      state_ctc_cost_billions: 0,
      income_tax_change_billions: -federalCostBillions - stateCostBillions,
      payroll_tax_change_billions: 0,
      cost_per_child:
        childrenLifted > 0 ? (totalCostBillions * 1e9) / childrenLifted : 0,
      cost_per_child_lifted_from_poverty:
        childrenLifted > 0 ? (totalCostBillions * 1e9) / childrenLifted : 0,
      state,
    },
    distributional_impact: {
      decile_impacts: [],
      average_gain_all: 0,
      average_gain_bottom_50: 0,
      average_gain_top_10: 0,
      share_to_bottom_20_pct: 0,
      share_to_bottom_50_pct: 0,
      share_to_top_20_pct: 0,
      share_to_top_10_pct: 0,
      baseline_gini: 0,
      reform_gini: 0,
      gini_change: 0,
      percent_gaining: 0,
      percent_losing: 0,
      percent_unchanged: 100,
      state,
    },
    headline_stats: {},
  };
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
      return mapEconomyToAnalysisResponse(economy, state, year);
    } catch (err) {
      console.error('Modal economy failed', err);
      throw err;
    }
  }
  // No Modal URL configured AND no direct-PE fallback. The PE-direct
  // fallbacks used to fan out hundreds of calls against
  // api.policyengine.org from the browser, which caused short prod
  // outages when devs hit them in parallel. Set
  // NEXT_PUBLIC_MODAL_CPID_URL in .env.local instead.
  throw new Error(
    'NEXT_PUBLIC_MODAL_CPID_URL is not set; statewide analysis requires Modal.',
  );
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
