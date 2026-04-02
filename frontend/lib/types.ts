// API Types for the Child Poverty Impact Dashboard

export type AgeEligibility = 'prenatal_3' | '0_5' | '0_17' | '6_17';
export type IncomeBasis = 'agi' | 'earned' | 'gross';
export type PhaseoutStructure = 'none' | 'symmetric' | 'asymmetric';

export interface CTCConfig {
  enabled: boolean;
  amount_young: number;
  amount_older: number;
  age_eligibility: AgeEligibility;
  income_basis: IncomeBasis;
  phaseout_structure: PhaseoutStructure;
  phaseout_start_single: number;
  phaseout_start_joint: number;
  phaseout_rate: number;
  refundable: boolean;
  refundable_amount: number | null;
}

export interface EITCConfig {
  enabled: boolean;
  individualized: boolean;
  expansion_percent: number;
  childless_expansion: boolean;
  age_floor_reduction: number;
  age_ceiling_increase: number;
}

export interface DependentExemptionConfig {
  enabled: boolean;
  amount_per_dependent: number;
  refundable: boolean;
  income_limit_single: number | null;
  income_limit_joint: number | null;
}

export interface UBIConfig {
  enabled: boolean;
  amount_per_child: number;
  amount_per_adult: number;
  age_eligibility: AgeEligibility;
  phase_out_with_income: boolean;
  phaseout_start: number;
  phaseout_rate: number;
}

export interface SNAPConfig {
  enabled: boolean;
  benefit_increase_percent: number;
  expand_eligibility_percent: number;
  remove_asset_test: boolean;
  increase_child_allotment: number;
}

export interface StateCTCConfig {
  enabled: boolean;
  state: string;
  amount_young: number;
  amount_older: number;
  age_eligibility: AgeEligibility;
  income_limit: number | null;
  refundable: boolean;
  matches_federal: boolean;
  match_percent: number;
}

export interface ReformRequest {
  name: string;
  description: string;
  year: number;
  states: string[];
  ctc: CTCConfig;
  eitc: EITCConfig;
  dependent_exemption: DependentExemptionConfig;
  ubi: UBIConfig;
  snap: SNAPConfig;
  state_ctc: StateCTCConfig;
}

export interface DecileImpact {
  decile: number;
  average_gain: number;
  percent_gaining: number;
  percent_losing: number;
  total_benefit_billions: number;
  share_of_total_benefit: number;
}

export interface PovertyImpactResponse {
  baseline_child_poverty_rate: number;
  reform_child_poverty_rate: number;
  child_poverty_change_pp: number;
  child_poverty_percent_change: number;
  baseline_young_child_poverty_rate: number;
  reform_young_child_poverty_rate: number;
  young_child_poverty_change_pp: number;
  young_child_poverty_percent_change: number;
  children_lifted_out_of_poverty: number;
  young_children_lifted_out_of_poverty: number;
  baseline_deep_child_poverty_rate: number;
  reform_deep_child_poverty_rate: number;
  deep_poverty_change_pp: number;
  state: string | null;
}

export interface FiscalCostResponse {
  total_cost_billions: number;
  federal_cost_billions: number;
  state_cost_billions: number;
  ctc_cost_billions: number;
  eitc_cost_billions: number;
  dependent_exemption_cost_billions: number;
  ubi_cost_billions: number;
  snap_cost_billions: number;
  state_ctc_cost_billions: number;
  income_tax_change_billions: number;
  payroll_tax_change_billions: number;
  cost_per_child: number;
  cost_per_child_lifted_from_poverty: number;
  state: string | null;
}

export interface DistributionalResponse {
  decile_impacts: DecileImpact[];
  average_gain_all: number;
  average_gain_bottom_50: number;
  average_gain_top_10: number;
  share_to_bottom_20_pct: number;
  share_to_bottom_50_pct: number;
  share_to_top_20_pct: number;
  share_to_top_10_pct: number;
  baseline_gini: number;
  reform_gini: number;
  gini_change: number;
  percent_gaining: number;
  percent_losing: number;
  percent_unchanged: number;
  state: string | null;
}

export interface AnalysisResponse {
  reform_name: string;
  reform_description: string;
  year: number;
  states_analyzed: string[];
  poverty_impact: PovertyImpactResponse;
  fiscal_cost: FiscalCostResponse;
  distributional_impact: DistributionalResponse;
  headline_stats: Record<string, number>;
}

export interface StateInfo {
  state_code: string;
  state_name: string;
  has_state_ctc: boolean;
  existing_ctc_amount: number | null;
  existing_ctc_age_eligibility: string | null;
  has_state_eitc: boolean;
  state_eitc_match_percent: number | null;
}

export interface PresetReform {
  id: string;
  name: string;
  description: string;
  category: string;
  estimated_cost_billions: number | null;
  estimated_poverty_reduction_pct: number | null;
}

// Default configurations
export const defaultCTCConfig: CTCConfig = {
  enabled: false,
  amount_young: 0,
  amount_older: 0,
  age_eligibility: '0_17',
  income_basis: 'agi',
  phaseout_structure: 'asymmetric',
  phaseout_start_single: 200000,
  phaseout_start_joint: 400000,
  phaseout_rate: 0.05,
  refundable: true,
  refundable_amount: null,
};

export const defaultEITCConfig: EITCConfig = {
  enabled: false,
  individualized: false,
  expansion_percent: 0,
  childless_expansion: false,
  age_floor_reduction: 0,
  age_ceiling_increase: 0,
};

export const defaultDependentExemptionConfig: DependentExemptionConfig = {
  enabled: false,
  amount_per_dependent: 0,
  refundable: false,
  income_limit_single: null,
  income_limit_joint: null,
};

export const defaultUBIConfig: UBIConfig = {
  enabled: false,
  amount_per_child: 0,
  amount_per_adult: 0,
  age_eligibility: '0_17',
  phase_out_with_income: false,
  phaseout_start: 0,
  phaseout_rate: 0,
};

export const defaultSNAPConfig: SNAPConfig = {
  enabled: false,
  benefit_increase_percent: 0,
  expand_eligibility_percent: 0,
  remove_asset_test: false,
  increase_child_allotment: 0,
};

export const defaultStateCTCConfig: StateCTCConfig = {
  enabled: false,
  state: '',
  amount_young: 0,
  amount_older: 0,
  age_eligibility: '0_17',
  income_limit: null,
  refundable: true,
  matches_federal: false,
  match_percent: 0,
};

export const defaultReformRequest: ReformRequest = {
  name: 'Custom Reform',
  description: '',
  year: 2026,
  states: [],
  ctc: defaultCTCConfig,
  eitc: defaultEITCConfig,
  dependent_exemption: defaultDependentExemptionConfig,
  ubi: defaultUBIConfig,
  snap: defaultSNAPConfig,
  state_ctc: defaultStateCTCConfig,
};
