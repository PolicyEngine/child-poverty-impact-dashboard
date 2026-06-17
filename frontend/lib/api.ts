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
  // Modal poverty rates are percentages (0-100). AnalysisResponse uses
  // fractions (0-1); the consumers multiply by 100 to render. Convert.
  const toFraction = (pct: number | undefined): number => (pct ?? 0) / 100;
  const pp = (baseline: number, reform: number): number =>
    (reform - baseline) * 100;
  const pctChange = (baseline: number, reform: number): number =>
    baseline > 0 ? ((reform - baseline) / baseline) * 100 : 0;

  const baselineChild = toFraction(economy.poverty?.child_baseline_rate);
  const reformChild = toFraction(economy.poverty?.child_reform_rate);
  const baselineYoungChild = toFraction(economy.poverty?.young_child_baseline_rate);
  const reformYoungChild = toFraction(economy.poverty?.young_child_reform_rate);
  const baselineDeep = toFraction(economy.poverty?.deep_child_baseline_rate);
  const reformDeep = toFraction(economy.poverty?.deep_child_reform_rate);

  const childrenLifted = economy.poverty?.children_lifted ?? 0;
  const youngChildrenLifted = economy.poverty?.young_children_lifted ?? 0;

  // Modal returns raw-dollar fiscal numbers; AnalysisResponse uses
  // billions. Reform that reduces revenue → negative total_budgetary_impact
  // → positive "cost" after negation. Same convention for per-program.
  const toBillionsCost = (raw: number | undefined): number =>
    -(raw ?? 0) / 1e9;

  const totalCostBillions = toBillionsCost(economy.fiscal?.total_budgetary_impact);
  const federalCostBillions = toBillionsCost(economy.fiscal?.federal_tax_change);
  const stateCostBillions = toBillionsCost(economy.fiscal?.state_tax_change);
  // Program-level "cost" = positive when reform increases the benefit
  // (i.e. positive change in spending). Modal returns reform - baseline,
  // so a positive delta IS a cost.
  const ctcCostBillions = (economy.fiscal?.ctc_change ?? 0) / 1e9;
  const eitcCostBillions = (economy.fiscal?.eitc_change ?? 0) / 1e9;
  const snapCostBillions = (economy.fiscal?.snap_change ?? 0) / 1e9;
  const stateCtcCostBillions = (economy.fiscal?.state_ctc_change ?? 0) / 1e9;
  const stateEitcCostBillions = (economy.fiscal?.state_eitc_change ?? 0) / 1e9;
  // ubi_change covers the child allowance / baby bonus (ubi_center basic
  // income). Older Modal deployments don't return it — falls back to 0.
  const ubiCostBillions = (economy.fiscal?.ubi_change ?? 0) / 1e9;

  const dist = economy.distributional;

  return {
    reform_name: 'Reform',
    reform_description: '',
    year,
    states_analyzed: [state],
    poverty_impact: {
      baseline_child_poverty_rate: baselineChild,
      reform_child_poverty_rate: reformChild,
      child_poverty_change_pp: pp(baselineChild, reformChild),
      child_poverty_percent_change: pctChange(baselineChild, reformChild),
      baseline_young_child_poverty_rate: baselineYoungChild,
      reform_young_child_poverty_rate: reformYoungChild,
      young_child_poverty_change_pp: pp(baselineYoungChild, reformYoungChild),
      young_child_poverty_percent_change: pctChange(
        baselineYoungChild,
        reformYoungChild,
      ),
      children_lifted_out_of_poverty: childrenLifted,
      young_children_lifted_out_of_poverty: youngChildrenLifted,
      baseline_deep_child_poverty_rate: baselineDeep,
      reform_deep_child_poverty_rate: reformDeep,
      deep_poverty_change_pp: pp(baselineDeep, reformDeep),
      state,
    },
    fiscal_cost: {
      total_cost_billions: totalCostBillions,
      federal_cost_billions: federalCostBillions,
      state_cost_billions: stateCostBillions,
      ctc_cost_billions: ctcCostBillions,
      eitc_cost_billions: eitcCostBillions,
      // Dependent exemption isn't broken out by Modal yet. UBI now is
      // (basic_income), surfacing the child allowance / baby bonus cost.
      dependent_exemption_cost_billions: 0,
      ubi_cost_billions: ubiCostBillions,
      snap_cost_billions: snapCostBillions,
      state_ctc_cost_billions: stateCtcCostBillions,
      state_eitc_cost_billions: stateEitcCostBillions,
      income_tax_change_billions:
        (economy.fiscal?.federal_tax_change ?? 0) / 1e9
        + (economy.fiscal?.state_tax_change ?? 0) / 1e9,
      payroll_tax_change_billions: 0,
      cost_per_child:
        childrenLifted > 0 ? (totalCostBillions * 1e9) / childrenLifted : 0,
      cost_per_child_lifted_from_poverty:
        childrenLifted > 0 ? (totalCostBillions * 1e9) / childrenLifted : 0,
      state,
    },
    distributional_impact: {
      decile_impacts: (dist?.deciles ?? []).map((d) => ({
        decile: d.decile,
        average_gain: d.average_gain,
        percent_gaining: d.percent_gaining,
        percent_losing: d.percent_losing,
        gain_more_than_5_pct: d.gain_more_than_5_pct,
        gain_less_than_5_pct: d.gain_less_than_5_pct,
        no_change_pct: d.no_change_pct,
        lose_less_than_5_pct: d.lose_less_than_5_pct,
        lose_more_than_5_pct: d.lose_more_than_5_pct,
        total_benefit_billions: d.total_benefit / 1e9,
        share_of_total_benefit: d.share_of_total_benefit,
      })),
      average_gain_all: dist?.average_gain_all ?? 0,
      average_gain_bottom_50: dist?.average_gain_bottom_50 ?? 0,
      average_gain_top_10: dist?.average_gain_top_10 ?? 0,
      share_to_bottom_20_pct: dist?.share_to_bottom_20_pct ?? 0,
      share_to_bottom_50_pct: dist?.share_to_bottom_50_pct ?? 0,
      share_to_top_20_pct: dist?.share_to_top_20_pct ?? 0,
      share_to_top_10_pct: dist?.share_to_top_10_pct ?? 0,
      baseline_gini: dist?.baseline_gini ?? 0,
      reform_gini: dist?.reform_gini ?? 0,
      gini_change: dist?.gini_change ?? 0,
      percent_gaining: dist?.percent_gaining ?? 0,
      percent_losing: dist?.percent_losing ?? 0,
      percent_unchanged: dist?.percent_unchanged ?? 100,
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
  // Modal is the only supported path; the PE-direct fallbacks used to
  // fan out hundreds of calls against api.policyengine.org and have
  // been removed. Reforms are sent as flat dicts; Modal's wrapper
  // compiles them via Simulation(policy=...) — no PE policy-mint hop.
  const { modalConfigured, runEconomyOnModal } = await import('./modalApi');
  if (modalConfigured()) {
    try {
      const { buildReformDict } = await import('./reforms');
      const reform = buildReformDict(reformOptionIds, parameterValues, year);
      const economy = await runEconomyOnModal(
        Object.keys(reform).length > 0 ? reform : null,
        year,
        state,
      );
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
