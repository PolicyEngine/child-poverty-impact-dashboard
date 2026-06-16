/**
 * State programs and reform-options registry, ported from the
 * backend's cpid_calc.data.state_programs + cpid_calc.reforms.state_aware
 * modules so the frontend can serve them without a running FastAPI
 * backend (Vercel has no Python runtime in front of this app).
 *
 * Source of truth for the rate tables stays in
 * cpid_calc/data/state_programs.py — when those values change, regenerate
 * frontend/data/state-programs.json with the export script.
 */

import statePrograms from '@/data/state-programs.json';
import eitcReforms from '@/data/eitc-reforms.json';

export interface StateEITCRecord {
  name: string;
  match_rate: number;
  refundable: boolean;
  has_childless_credit?: boolean;
  age_min?: number | null;
  age_max?: number | null;
  notes?: string;
  pe_variable?: string;
}

export interface StateCTCRecord {
  name: string;
  max_amount: number;
  amount_young?: number | null;
  amount_older?: number | null;
  age_limit: number;
  young_child_age?: number;
  refundable: boolean;
  income_limit?: number | null;
  phaseout_start?: number | null;
  phaseout_rate?: number | null;
  notes?: string;
  pe_variable?: string;
}

export interface StateProgramRecord {
  state_code: string;
  state_name: string;
  has_income_tax: boolean;
  ctc: StateCTCRecord | null;
  eitc: StateEITCRecord | null;
  exemption: {
    personal_amount: number;
    dependent_amount: number;
  } | null;
  cdcc: {
    name: string;
    max_percent: number;
    max_expenses: number;
    refundable: boolean;
  } | null;
}

type EitcReformEntry =
  | null
  | {
      type: 'existing' | 'contrib';
      match: string;
      in_effect?: string;
      current_rate: number;
      note?: string;
    };

const STATE_PROGRAMS = statePrograms as Record<string, StateProgramRecord>;
const EITC_REFORMS = eitcReforms as unknown as Record<
  string,
  EitcReformEntry | string
>;

export function getStateProgram(stateCode: string): StateProgramRecord | null {
  return STATE_PROGRAMS[stateCode.toUpperCase()] ?? null;
}

export function allStateCodes(): string[] {
  return Object.keys(STATE_PROGRAMS);
}

export function eitcConfigurable(stateCode: string): boolean {
  const entry = EITC_REFORMS[stateCode.toUpperCase()];
  return entry !== null && typeof entry !== 'string';
}

/** PolicyEngine-US reform dict for a state EITC at the given match rate.
 *  Returns scalar values — Modal's policyengine.py wrapper defaults the
 *  effective date to ``{simulation_year}-01-01``. ``year`` is no longer
 *  used by this function but kept on the signature for callers that
 *  pass it. */
export function buildStateEitcReform(
  stateCode: string,
  matchRate: number,
  _year: number,
): Record<string, number | boolean> {
  const entry = EITC_REFORMS[stateCode.toUpperCase()];
  if (!entry || typeof entry === 'string') return {};
  const reform: Record<string, number | boolean> = {};
  if (entry.type === 'contrib' && entry.in_effect) {
    reform[entry.in_effect] = true;
  }
  reform[entry.match] = matchRate;
  return reform;
}

// ---- Reform options registry --------------------------------------------

export type ReformCategory =
  | 'state_ctc'
  | 'state_eitc'
  | 'federal_ctc'
  | 'federal_eitc'
  | 'snap'
  | 'child_allowance';

export interface AdjustableParameter {
  name: string;
  label: string;
  min_value: number;
  max_value: number;
  default_value: number;
  step: number;
  unit: string;
  description: string;
  /** Control type. 'number' (default) renders a number input + slider;
   *  'toggle' renders a checkbox (stored as 0/1). */
  control?: 'number' | 'toggle';
  /** Only render this parameter when the named sibling param is truthy
   *  (>0). Used to reveal phase-out inputs behind their enable toggle. */
  depends_on?: string;
}

export interface ReformOption {
  id: string;
  name: string;
  description: string;
  category: ReformCategory;
  is_new_program: boolean;
  is_enhancement: boolean;
  is_configurable?: boolean;
  estimated_household_impact?: number;
  adjustable_params?: AdjustableParameter[];
  /** IDs that cannot be selected at the same time as this option. Used by
   *  the selector to deselect conflicting reforms. */
  exclusive_with?: string[];
  /** When true the option is shown greyed-out and cannot be selected — it
   *  is surfaced so users can see it's planned, but isn't wired to a PE-US
   *  lever yet. */
  in_development?: boolean;
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

function describeEitcAction(programs: StateProgramRecord): {
  action: string;
  current_rate: number;
  description: string;
} {
  const has_existing = programs.eitc !== null;
  const is_nonrefundable =
    has_existing && programs.eitc?.refundable === false;
  const current_rate = programs.eitc?.match_rate
    ? Math.round(programs.eitc.match_rate * 100)
    : 0;

  if (is_nonrefundable) {
    return {
      action: 'convert',
      current_rate,
      description: `Convert ${programs.state_name}'s nonrefundable EITC to refundable and adjust the match rate. Current: ${current_rate}% (nonrefundable).`,
    };
  }
  if (has_existing) {
    return {
      action: 'adjust',
      current_rate,
      description: `Adjust ${programs.state_name}'s state EITC as a percentage of the federal EITC. Current: ${current_rate}%.`,
    };
  }
  return {
    action: 'create',
    current_rate: 0,
    description: `Create a refundable ${programs.state_name} EITC as a percentage of the federal EITC.`,
  };
}

function buildEitcOptions(programs: StateProgramRecord): ReformOption[] {
  if (!programs.has_income_tax) return [];
  if (!eitcConfigurable(programs.state_code)) return [];
  const { current_rate, description } = describeEitcAction(programs);
  return [
    {
      id: `${programs.state_code.toLowerCase()}_eitc`,
      name: `${programs.state_name} EITC`,
      description,
      category: 'state_eitc',
      is_new_program: programs.eitc === null,
      is_enhancement: programs.eitc !== null,
      is_configurable: true,
      estimated_household_impact: 500,
      adjustable_params: [
        {
          name: 'match_rate',
          label: 'Match rate',
          min_value: 0,
          max_value: 100,
          default_value: current_rate,
          step: 5,
          unit: '%',
          description: `Percentage of federal EITC. Current: ${current_rate}%.`,
        },
      ],
    },
  ];
}

/** Federal, age-tiered unconditional child allowance, implemented through
 *  the ubi_center basic-income schedule (see lib/reforms.ts). Three tiers
 *  (under 1, 1–5, 6 to an adjustable cutoff) that all compose — set them
 *  equal for a flat allowance, or zero out a tier to exclude it. */
function buildChildAllowanceOptions(): ReformOption[] {
  return [
    {
      id: 'child_allowance',
      name: 'Child allowance',
      description:
        'Annual cash payment per child, by age tier. Set all three amounts equal for a flat allowance, or any to $0 to drop that tier. Optionally income-test it (AGI phase-out) to act as a child tax credit — works in every state, including those with no state CTC.',
      category: 'child_allowance',
      is_new_program: true,
      is_enhancement: false,
      is_configurable: true,
      adjustable_params: [
        {
          name: 'infant_amount',
          label: 'Under 1',
          min_value: 0,
          max_value: 12000,
          default_value: 3600,
          step: 100,
          unit: '$',
          description: 'Annual amount per child under age 1.',
        },
        {
          name: 'young_child_amount',
          label: 'Ages 1–5 (under 6)',
          min_value: 0,
          max_value: 12000,
          default_value: 3000,
          step: 100,
          unit: '$',
          description: 'Annual amount per child age 1 through 5.',
        },
        {
          name: 'older_child_amount',
          label: 'Ages 6+ (to cutoff)',
          min_value: 0,
          max_value: 12000,
          default_value: 3000,
          step: 100,
          unit: '$',
          description: 'Annual amount per child age 6 up to the cutoff age.',
        },
        {
          name: 'cutoff_age',
          label: 'Top age cutoff',
          min_value: 18,
          max_value: 19,
          default_value: 18,
          step: 1,
          unit: 'yr',
          description:
            'Oldest eligible age band: 18 = children under 18, 19 = children under 19.',
        },
        {
          name: 'phaseout_enabled',
          label: 'Phase out by income',
          control: 'toggle',
          min_value: 0,
          max_value: 1,
          default_value: 0,
          step: 1,
          unit: '',
          description:
            'Income-test the allowance (turns it into a CTC-style credit). Phases out against adjusted gross income (AGI) above the thresholds below.',
        },
        {
          name: 'phaseout_rate',
          label: 'Phase-out rate',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 50,
          default_value: 5,
          step: 1,
          unit: '%',
          description: 'Reduction per $1 of AGI above the threshold.',
        },
        {
          name: 'phaseout_threshold_single',
          label: 'Threshold — single',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 1000000,
          default_value: 100000,
          step: 5000,
          unit: '$',
          description: 'AGI where the phase-out begins for single filers.',
        },
        {
          name: 'phaseout_threshold_hoh',
          label: 'Threshold — head of household',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 1000000,
          default_value: 100000,
          step: 5000,
          unit: '$',
          description: 'AGI where the phase-out begins for heads of household.',
        },
        {
          name: 'phaseout_threshold_separate',
          label: 'Threshold — married filing separately',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 1000000,
          default_value: 100000,
          step: 5000,
          unit: '$',
          description:
            'AGI where the phase-out begins for married-filing-separately.',
        },
        {
          name: 'phaseout_threshold_joint',
          label: 'Threshold — married filing jointly',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 1000000,
          default_value: 200000,
          step: 5000,
          unit: '$',
          description: 'AGI where the phase-out begins for joint filers.',
        },
        {
          name: 'phaseout_threshold_surviving_spouse',
          label: 'Threshold — surviving spouse',
          depends_on: 'phaseout_enabled',
          min_value: 0,
          max_value: 1000000,
          default_value: 200000,
          step: 5000,
          unit: '$',
          description: 'AGI where the phase-out begins for surviving spouses.',
        },
      ],
    },
  ];
}

/** SNAP benefit increases. Not yet wired — PolicyEngine-US has no single
 *  "scale all SNAP benefits by X%" lever — so these are shown greyed-out. */
function buildSnapOptions(): ReformOption[] {
  return [
    {
      id: 'snap_increase_15',
      name: '15% SNAP benefit increase',
      description: 'Increase SNAP benefits by 15% for all recipients.',
      category: 'snap',
      is_new_program: false,
      is_enhancement: true,
      in_development: true,
    },
    {
      id: 'snap_increase_25',
      name: '25% SNAP benefit increase',
      description: 'Increase SNAP benefits by 25% for all recipients.',
      category: 'snap',
      is_new_program: false,
      is_enhancement: true,
      in_development: true,
    },
  ];
}

function buildFederalOptions(): ReformOption[] {
  return [
    {
      id: 'federal_ctc_expanded',
      name: 'Restore 2021 expanded CTC',
      description:
        '$3,600 for children under 6, $3,000 for ages 6–17, fully refundable.',
      category: 'federal_ctc',
      is_new_program: false,
      is_enhancement: true,
      estimated_household_impact: 2400,
    },
    {
      id: 'federal_eitc_expansion',
      name: '50% EITC expansion',
      description: 'Increase the federal EITC by 50%.',
      category: 'federal_eitc',
      is_new_program: false,
      is_enhancement: true,
      in_development: true,
    },
  ];
}

export function getReformOptionsForState(
  stateCode: string,
): StateReformOptions {
  const programs = getStateProgram(stateCode);
  if (!programs) {
    return {
      state_code: stateCode,
      state_name: stateCode,
      has_income_tax: true,
      existing_programs: {},
      ctc_options: [],
      eitc_options: [],
      snap_options: buildSnapOptions(),
      child_allowance_options: buildChildAllowanceOptions(),
      federal_options: buildFederalOptions(),
    };
  }

  return {
    state_code: programs.state_code,
    state_name: programs.state_name,
    has_income_tax: programs.has_income_tax,
    existing_programs: {
      state_ctc: programs.ctc !== null,
      state_eitc: programs.eitc !== null,
      state_cdcc: programs.cdcc !== null,
    },
    ctc_options: [],
    eitc_options: buildEitcOptions(programs),
    snap_options: buildSnapOptions(),
    child_allowance_options: buildChildAllowanceOptions(),
    federal_options: buildFederalOptions(),
  };
}

/** Frontend-shaped programs summary, matching the legacy
 *  /api/household/state-programs/{state} response. */
export interface StateProgramsSummary {
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

export function getStateProgramsSummary(
  stateCode: string,
): StateProgramsSummary | null {
  const p = getStateProgram(stateCode);
  if (!p) return null;
  return {
    state_code: p.state_code,
    state_name: p.state_name,
    has_income_tax: p.has_income_tax,
    has_state_ctc: p.ctc !== null,
    ctc_name: p.ctc?.name,
    ctc_max_amount: p.ctc?.max_amount,
    ctc_age_limit: p.ctc?.age_limit,
    ctc_refundable: p.ctc?.refundable,
    has_state_eitc: p.eitc !== null,
    eitc_name: p.eitc?.name,
    eitc_match_rate: p.eitc?.match_rate,
    has_cdcc: p.cdcc !== null,
    has_dependent_exemption:
      (p.exemption?.dependent_amount ?? 0) > 0,
  };
}
