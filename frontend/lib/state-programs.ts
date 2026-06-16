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

// ---- Current-law state CTC registry ------------------------------------
//
// Each entry maps a state's existing Child Tax Credit to the PolicyEngine-US
// parameters a user can modify (amount, age, phase-out). `default_value` is
// the current-law value in UI units; `path` is the reform-dict key;
// `divide_by` converts a UI percent to PE-US's /1 rate. Income measures for
// phase-outs are noted per state (AGI / earned income / state taxable income).
//
// IMPORTANT: buildStateCtcReform only emits params the user *changed* from
// `default_value`, so an unchanged selection is a no-op and a slightly stale
// default can never silently create a phantom reform.

interface CtcParam {
  name: string;
  label: string;
  path: string;
  default_value: number;
  min_value: number;
  max_value: number;
  step: number;
  unit: string;
  description: string;
  divide_by?: number; // UI percent -> /1 rate when set to 100
}

interface CtcRegistryEntry {
  name: string;
  description: string;
  params: CtcParam[];
}

const AMT = (
  path: string,
  def: number,
  max = 5000,
): CtcParam => ({
  name: 'amount',
  label: 'Credit amount',
  path,
  default_value: def,
  min_value: 0,
  max_value: max,
  step: 50,
  unit: '$',
  description: 'Maximum credit per eligible child.',
});

const AGE = (
  path: string,
  def: number,
  label = 'Eligible if under age',
  name = 'age',
): CtcParam => ({
  name,
  label,
  path,
  default_value: def,
  min_value: 0,
  max_value: 19,
  step: 1,
  unit: 'yr',
  description: 'Age limit for an eligible child.',
});

const DOLLAR = (
  name: string,
  label: string,
  path: string,
  def: number,
  description: string,
  max = 500000,
): CtcParam => ({
  name,
  label,
  path,
  default_value: def,
  min_value: 0,
  max_value: max,
  step: 1000,
  unit: '$',
  description,
});

const RATE = (
  name: string,
  label: string,
  path: string,
  def: number,
  description: string,
): CtcParam => ({
  name,
  label,
  path,
  default_value: def,
  min_value: 0,
  max_value: 100,
  step: 1,
  unit: '%',
  description,
  divide_by: 100,
});

const CTC_REFORMS: Record<string, CtcRegistryEntry> = {
  CA: {
    name: 'California Young Child Tax Credit',
    description:
      'Refundable credit for young children. Phases out against earned income.',
    params: [
      AMT('gov.states.ca.tax.income.credits.young_child.amount', 1189),
      AGE('gov.states.ca.tax.income.credits.young_child.ineligible_age', 6),
      DOLLAR(
        'phaseout_start',
        'Phase-out start (earned income)',
        'gov.states.ca.tax.income.credits.young_child.phase_out.start',
        27425,
        'Earned income at which the credit starts phasing out.',
      ),
    ],
  },
  DC: {
    name: 'DC Child Tax Credit',
    description:
      'Refundable credit (up to $1,000/child). Phases out against DC taxable income by filing status.',
    params: [
      AMT('gov.states.dc.tax.income.credits.ctc.amount', 1000),
      AGE('gov.states.dc.tax.income.credits.ctc.child.age_threshold', 18),
      DOLLAR('threshold_single', 'Phase-out — single', 'gov.states.dc.tax.income.credits.ctc.income_threshold.SINGLE', 55000, 'DC taxable income where phase-out begins (single).'),
      DOLLAR('threshold_joint', 'Phase-out — joint', 'gov.states.dc.tax.income.credits.ctc.income_threshold.JOINT', 70000, 'DC taxable income where phase-out begins (joint).'),
      DOLLAR('threshold_hoh', 'Phase-out — head of household', 'gov.states.dc.tax.income.credits.ctc.income_threshold.HEAD_OF_HOUSEHOLD', 55000, 'DC taxable income where phase-out begins (HoH).'),
      DOLLAR('threshold_separate', 'Phase-out — separate', 'gov.states.dc.tax.income.credits.ctc.income_threshold.SEPARATE', 35000, 'DC taxable income where phase-out begins (separate).'),
      DOLLAR('threshold_surviving_spouse', 'Phase-out — surviving spouse', 'gov.states.dc.tax.income.credits.ctc.income_threshold.SURVIVING_SPOUSE', 55000, 'DC taxable income where phase-out begins (surviving spouse).'),
    ],
  },
  GA: {
    name: 'Georgia Child Tax Credit',
    description: 'Non-refundable credit ($250/child under 6). No income phase-out.',
    params: [
      AMT('gov.states.ga.tax.income.credits.ctc.amount', 250, 3000),
      AGE('gov.states.ga.tax.income.credits.ctc.age_threshold', 6),
    ],
  },
  IL: {
    name: 'Illinois Child Tax Credit',
    description:
      'Refundable credit set as a percentage of the state EITC, for filers with an eligible child.',
    params: [
      RATE('rate', 'Credit (% of state EITC)', 'gov.states.il.tax.income.credits.ctc.rate', 40, 'Credit as a percentage of the Illinois EITC.'),
      AGE('gov.states.il.tax.income.credits.ctc.age_limit', 12),
    ],
  },
  MD: {
    name: 'Maryland Child Tax Credit',
    description:
      'Refundable credit ($500/child). Phases out against federal AGI (2025+).',
    params: [
      AMT('gov.states.md.tax.income.credits.ctc.amount', 500),
      AGE('gov.states.md.tax.income.credits.ctc.age_threshold.main', 6),
      AGE('gov.states.md.tax.income.credits.ctc.age_threshold.disabled', 17, 'Disabled child age limit', 'age_disabled'),
      DOLLAR('phaseout_threshold', 'Phase-out start (AGI)', 'gov.states.md.tax.income.credits.ctc.phase_out.threshold', 15000, 'Federal AGI where the credit starts phasing out.', 100000),
      {
        name: 'phaseout_rate',
        label: 'Reduction per $1,000 AGI',
        path: 'gov.states.md.tax.income.credits.ctc.phase_out.rate',
        default_value: 50,
        min_value: 0,
        max_value: 500,
        step: 5,
        unit: '$',
        description: 'Dollars of credit lost per $1,000 of AGI over the threshold.',
      },
    ],
  },
  MN: {
    name: 'Minnesota Child Tax Credit',
    description:
      'Refundable credit ($1,750/child). Phases out against the larger of earned income or AGI.',
    params: [
      AMT('gov.states.mn.tax.income.credits.cwfc.ctc.amount', 1750, 6000),
      AGE('gov.states.mn.tax.income.credits.cwfc.ctc.age_limit', 18),
      DOLLAR('threshold_joint', 'Phase-out start — joint', 'gov.states.mn.tax.income.credits.cwfc.phase_out.threshold.joint', 37910, 'Income where phase-out begins (joint).'),
      DOLLAR('threshold_other', 'Phase-out start — non-joint', 'gov.states.mn.tax.income.credits.cwfc.phase_out.threshold.other', 31950, 'Income where phase-out begins (non-joint).'),
      RATE('phaseout_rate', 'Phase-out rate', 'gov.states.mn.tax.income.credits.cwfc.phase_out.rate.main', 12, 'Share of income above the threshold that reduces the credit.'),
    ],
  },
  OR: {
    name: 'Oregon Child Tax Credit',
    description:
      'Refundable credit ($1,050/child, ages 0–5 only — note Oregon excludes children at/over the age below). Phases out against Oregon AGI.',
    params: [
      AMT('gov.states.or.tax.income.credits.ctc.amount', 1050, 6000),
      AGE('gov.states.or.tax.income.credits.ctc.ineligible_age', 6, 'Ineligible at/above age'),
      {
        name: 'child_limit',
        label: 'Max children',
        path: 'gov.states.or.tax.income.credits.ctc.child_limit',
        default_value: 5,
        min_value: 1,
        max_value: 12,
        step: 1,
        unit: '',
        description: 'Maximum number of children the credit covers.',
      },
      DOLLAR('phaseout_start', 'Phase-out start (OR AGI)', 'gov.states.or.tax.income.credits.ctc.reduction.start', 26550, 'Oregon AGI where the credit starts phasing out.', 200000),
      DOLLAR('phaseout_width', 'Phase-out width', 'gov.states.or.tax.income.credits.ctc.reduction.width', 5000, 'Income range over which the credit phases to $0.', 100000),
    ],
  },
  UT: {
    name: 'Utah Child Tax Credit',
    description:
      'Non-refundable credit ($1,000/child). Phases out by filing status against state AGI plus tax-exempt interest. (Age eligibility is a fixed band and is not adjustable here.)',
    params: [
      AMT('gov.states.ut.tax.income.credits.ctc.amount', 1000),
      DOLLAR('threshold_single', 'Phase-out — single', 'gov.states.ut.tax.income.credits.ctc.reduction.start.SINGLE', 43000, 'Income where phase-out begins (single).'),
      DOLLAR('threshold_hoh', 'Phase-out — head of household', 'gov.states.ut.tax.income.credits.ctc.reduction.start.HEAD_OF_HOUSEHOLD', 43000, 'Income where phase-out begins (HoH).'),
      DOLLAR('threshold_joint', 'Phase-out — joint', 'gov.states.ut.tax.income.credits.ctc.reduction.start.JOINT', 54000, 'Income where phase-out begins (joint).'),
      DOLLAR('threshold_surviving_spouse', 'Phase-out — surviving spouse', 'gov.states.ut.tax.income.credits.ctc.reduction.start.SURVIVING_SPOUSE', 54000, 'Income where phase-out begins (surviving spouse).'),
      DOLLAR('threshold_separate', 'Phase-out — separate', 'gov.states.ut.tax.income.credits.ctc.reduction.start.SEPARATE', 27000, 'Income where phase-out begins (separate).'),
      RATE('phaseout_rate', 'Phase-out rate', 'gov.states.ut.tax.income.credits.ctc.reduction.rate', 10, 'Share of income above the threshold that reduces the credit.'),
    ],
  },
  VT: {
    name: 'Vermont Child Tax Credit',
    description:
      'Refundable credit ($1,000/child, ages 0–6). Phases out against AGI above $125,000.',
    params: [
      AMT('gov.states.vt.tax.income.credits.ctc.amount', 1000),
      AGE('gov.states.vt.tax.income.credits.ctc.age_limit', 6, 'Eligible if age at most'),
      DOLLAR('phaseout_start', 'Phase-out start (AGI)', 'gov.states.vt.tax.income.credits.ctc.reduction.start', 125000, 'AGI where the credit starts phasing out.'),
      {
        name: 'phaseout_amount',
        label: 'Reduction per $1,000 AGI',
        path: 'gov.states.vt.tax.income.credits.ctc.reduction.amount',
        default_value: 20,
        min_value: 0,
        max_value: 500,
        step: 5,
        unit: '$',
        description: 'Dollars of credit lost per $1,000 of AGI over the threshold.',
      },
    ],
  },
};

/** Reform options for the selected state's current-law CTC (one card with
 *  its modifiable parameters), or [] if the state has no wired CTC. */
export function buildStateCtcOptions(stateCode: string): ReformOption[] {
  const entry = CTC_REFORMS[stateCode.toUpperCase()];
  if (!entry) return [];
  return [
    {
      id: `${stateCode.toLowerCase()}_ctc`,
      name: entry.name,
      description: entry.description,
      category: 'state_ctc',
      is_new_program: false,
      is_enhancement: true,
      is_configurable: true,
      adjustable_params: entry.params.map((p) => ({
        name: p.name,
        label: p.label,
        min_value: p.min_value,
        max_value: p.max_value,
        default_value: p.default_value,
        step: p.step,
        unit: p.unit,
        description: p.description,
      })),
    },
  ];
}

/** PolicyEngine-US reform dict for a state's CTC. Emits ONLY parameters the
 *  user changed from current law, so an unmodified selection is a no-op. */
export function buildStateCtcReform(
  stateCode: string,
  paramValues?: Record<string, number>,
): Record<string, number> {
  const entry = CTC_REFORMS[stateCode.toUpperCase()];
  if (!entry) return {};
  const out: Record<string, number> = {};
  for (const p of entry.params) {
    const ui = paramValues?.[p.name];
    if (ui === undefined || ui === p.default_value) continue; // unchanged
    out[p.path] = p.divide_by ? ui / p.divide_by : ui;
  }
  return out;
}

/** State codes that have a wired current-law CTC. */
export function stateHasCtc(stateCode: string): boolean {
  return CTC_REFORMS[stateCode.toUpperCase()] !== undefined;
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
    ctc_options: buildStateCtcOptions(programs.state_code),
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
