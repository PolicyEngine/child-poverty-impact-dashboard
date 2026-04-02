// Household configuration types

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'surviving_spouse';

export interface PersonInput {
  age: number;
  is_disabled?: boolean;
}

export interface ChildInput extends PersonInput {
  in_childcare?: boolean;
  childcare_expenses_annual?: number;
}

export interface IncomeInput {
  employment_income: number;
  spouse_employment_income?: number;
  self_employment_income?: number;
  social_security_income?: number;
  unemployment_income?: number;
}

export interface HouseholdInput {
  state: string;
  year: number;
  filing_status: FilingStatus;
  adults: PersonInput[];
  children: ChildInput[];
  income: IncomeInput;
  rent_monthly?: number;
}

export interface HouseholdResults {
  year: number;
  state: string;
  gross_income: number;
  adjusted_gross_income: number;
  federal_income_tax: number;
  state_income_tax: number;
  payroll_tax: number;
  net_income: number;
  federal_ctc: number;
  federal_eitc: number;
  state_ctc: number;
  state_eitc: number;
  snap_benefits: number;
  total_benefits: number;
  in_poverty: boolean;
  in_deep_poverty: boolean;
  poverty_gap: number;
  effective_tax_rate: number;
  total_child_benefits: number;
}

export interface HouseholdImpact {
  baseline: HouseholdResults;
  reform: HouseholdResults;
  net_income_change: number;
  percent_income_change: number;
  ctc_change: number;
  eitc_change: number;
  poverty_status_change: 'lifted' | 'fell_into' | 'unchanged';
}

export interface AdjustableParameter {
  name: string;
  label: string;
  min_value: number;
  max_value: number;
  default_value: number;
  step: number;
  unit: string;
  description: string;
}

export interface ReformOption {
  id: string;
  name: string;
  description: string;
  category: string;
  is_new_program: boolean;
  is_enhancement: boolean;
  estimated_household_impact?: number;
  customizable_params: string[];
  is_configurable?: boolean;
  adjustable_params?: AdjustableParameter[];
}

export interface StateReformOptions {
  state_code: string;
  state_name: string;
  has_income_tax: boolean;
  existing_programs: Record<string, boolean>;
  ctc_options: ReformOption[];
  eitc_options: ReformOption[];
  snap_options: ReformOption[];
  child_allowance_options: ReformOption[];
  federal_options: ReformOption[];
}

export interface StatePrograms {
  state_code: string;
  state_name: string;
  has_income_tax: boolean;
  has_state_ctc: boolean;
  ctc_name?: string;
  ctc_max_amount?: number;
  ctc_age_limit?: number;
  ctc_refundable?: boolean;
  has_state_eitc: boolean;
  eitc_name?: string;
  eitc_match_rate?: number;
  has_cdcc: boolean;
  has_dependent_exemption: boolean;
}

export interface IncomeSweepDataPoint {
  income: number;
  net_income: number;
  federal_ctc: number;
  state_ctc: number;
  federal_eitc: number;
  state_eitc: number;
  snap_benefits: number;
  total_benefits: number;
  effective_tax_rate: number;
  in_poverty: boolean;
}

export interface IncomeSweepResponse {
  state: string;
  year: number;
  data_points: IncomeSweepDataPoint[];
}

// Default values
export const defaultHousehold: HouseholdInput = {
  state: 'CA',
  year: 2026,
  filing_status: 'single',
  adults: [{ age: 30 }],
  children: [],
  income: {
    employment_income: 40000,
  },
};

export const defaultSingleParent: HouseholdInput = {
  state: 'CA',
  year: 2026,
  filing_status: 'head_of_household',
  adults: [{ age: 35 }],
  children: [{ age: 5 }, { age: 8 }],
  income: {
    employment_income: 35000,
  },
};

export const defaultMarriedCouple: HouseholdInput = {
  state: 'CA',
  year: 2026,
  filing_status: 'married_filing_jointly',
  adults: [{ age: 35 }, { age: 33 }],
  children: [{ age: 3 }, { age: 7 }],
  income: {
    employment_income: 60000,
    spouse_employment_income: 30000,
  },
};

// State list with names
export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};
