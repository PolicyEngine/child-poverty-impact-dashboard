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
import dependentExemptionReforms from '@/data/dependent-exemption-reforms.json';

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

// ---- Structured (non-match) state EITCs ----------------------------------
// Minnesota and Washington don't run a percentage-of-federal EITC: MN's
// Working Family Credit phases in on earnings with a per-child add-on, and
// WA's Working Families Tax Credit is a standalone refundable rebate (WA has
// no income tax). Both are wired here with their own parameters instead of a
// single match-rate slider. Reuses the CtcParam shape (path + default + range).
//
// Defaults are the latest published (2025) figures; PE uprates the dollar
// amounts to the analysis year. As with the CTC, buildStructuredEitcReform
// emits ONLY params the user changed, so an untouched slider is a no-op and
// the true (uprated) baseline is used. The non-uprated rates (MN's 4% phase-in
// and 12% phase-out) are exact.
interface StructuredEitcEntry {
  name: string;
  description: string;
  /** 'wfc' = a Working Family (Tax) Credit, not a percentage of the federal
   *  EITC (MN, WA) — labelled "State WFC". 'match' = a real federal-EITC match
   *  that just has more than one rate (WI by child count, OR by young-child
   *  status) — still labelled "State EITC". */
  kind: 'wfc' | 'match';
  /** WA's WFTC is a rebate with no income tax; skip the has_income_tax gate
   *  that blocks ordinary state-EITC options. The others keep it (true). */
  requires_income_tax: boolean;
  params: CtcParam[];
}

const STRUCTURED_EITC: Record<string, StructuredEitcEntry> = {
  MN: {
    name: 'Minnesota Working Family Credit',
    description:
      "Minnesota's Working Family Credit — the state's EITC-equivalent. It phases in on earned income, adds an amount per qualifying child over 18, and phases out with income (the phase-out is shared with the state Child Tax Credit).",
    kind: 'wfc',
    requires_income_tax: true,
    params: [
      {
        name: 'phase_in_rate',
        label: 'Phase-in rate',
        path: 'gov.states.mn.tax.income.credits.cwfc.wfc.phase_in[0].rate',
        default_value: 4,
        min_value: 0,
        max_value: 20,
        step: 1,
        unit: '%',
        divide_by: 100,
        description:
          'Credit as a share of earned income during phase-in. Current: 4%.',
      },
      {
        name: 'additional_1_child',
        label: 'Additional amount (1 child)',
        path: 'gov.states.mn.tax.income.credits.cwfc.wfc.additional.amount[1].amount',
        default_value: 1000,
        min_value: 0,
        max_value: 5000,
        step: 50,
        unit: '$',
        description:
          'Extra credit for one qualifying child over 18. Current: $1,000 (2025).',
      },
      {
        name: 'additional_2_children',
        label: 'Additional amount (2 children)',
        path: 'gov.states.mn.tax.income.credits.cwfc.wfc.additional.amount[2].amount',
        default_value: 2270,
        min_value: 0,
        max_value: 7000,
        step: 50,
        unit: '$',
        description:
          'Extra credit for two qualifying children over 18. Current: $2,270 (2025).',
      },
      {
        name: 'additional_3_children',
        label: 'Additional amount (3+ children)',
        path: 'gov.states.mn.tax.income.credits.cwfc.wfc.additional.amount[3].amount',
        default_value: 2710,
        min_value: 0,
        max_value: 8000,
        step: 50,
        unit: '$',
        description:
          'Extra credit for three or more qualifying children over 18. Current: $2,710 (2025).',
      },
      {
        name: 'phase_out_rate',
        label: 'Phase-out rate',
        path: 'gov.states.mn.tax.income.credits.cwfc.phase_out.rate.main',
        default_value: 12,
        min_value: 0,
        max_value: 30,
        step: 1,
        unit: '%',
        divide_by: 100,
        description:
          'Rate at which the credit phases out above the income threshold (shared with the MN child tax credit). Current: 12%.',
      },
    ],
  },
  WA: {
    name: 'Washington Working Families Tax Credit',
    description:
      "Washington's Working Families Tax Credit — a refundable EITC-style credit (Washington has no income tax). The maximum amount rises with the number of qualifying children.",
    kind: 'wfc',
    requires_income_tax: false,
    params: [
      {
        name: 'amount_0_children',
        label: 'Max amount (no children)',
        path: 'gov.states.wa.tax.income.credits.working_families_tax_credit.amount[0].amount',
        default_value: 335,
        min_value: 0,
        max_value: 3000,
        step: 5,
        unit: '$',
        description:
          'Maximum credit for a filer with no qualifying children. Current: $335 (2025).',
      },
      {
        name: 'amount_1_child',
        label: 'Max amount (1 child)',
        path: 'gov.states.wa.tax.income.credits.working_families_tax_credit.amount[1].amount',
        default_value: 660,
        min_value: 0,
        max_value: 4000,
        step: 5,
        unit: '$',
        description:
          'Maximum credit with one qualifying child. Current: $660 (2025).',
      },
      {
        name: 'amount_2_children',
        label: 'Max amount (2 children)',
        path: 'gov.states.wa.tax.income.credits.working_families_tax_credit.amount[2].amount',
        default_value: 995,
        min_value: 0,
        max_value: 5000,
        step: 5,
        unit: '$',
        description:
          'Maximum credit with two qualifying children. Current: $995 (2025).',
      },
      {
        name: 'amount_3_children',
        label: 'Max amount (3+ children)',
        path: 'gov.states.wa.tax.income.credits.working_families_tax_credit.amount[3].amount',
        default_value: 1330,
        min_value: 0,
        max_value: 6000,
        step: 5,
        unit: '$',
        description:
          'Maximum credit with three or more qualifying children. Current: $1,330 (2025).',
      },
      {
        name: 'min_amount',
        label: 'Minimum amount',
        path: 'gov.states.wa.tax.income.credits.working_families_tax_credit.min_amount',
        default_value: 50,
        min_value: 0,
        max_value: 500,
        step: 5,
        unit: '$',
        description:
          'Minimum credit for an eligible filer with a nonzero benefit. Current: $50.',
      },
    ],
  },
  WI: {
    name: 'Wisconsin earned income credit',
    description:
      "Wisconsin's earned income credit is a percentage of the federal EITC that rises with the number of qualifying children. Set the match rate for each family size.",
    kind: 'match',
    requires_income_tax: true,
    params: [
      {
        name: 'match_1_child',
        label: 'Match rate (1 child)',
        path: 'gov.states.wi.tax.income.credits.earned_income.fraction[1].amount',
        default_value: 4,
        min_value: 0,
        max_value: 100,
        step: 1,
        unit: '%',
        divide_by: 100,
        description: 'Percentage of the federal EITC with one qualifying child. Current: 4%.',
      },
      {
        name: 'match_2_children',
        label: 'Match rate (2 children)',
        path: 'gov.states.wi.tax.income.credits.earned_income.fraction[2].amount',
        default_value: 11,
        min_value: 0,
        max_value: 100,
        step: 1,
        unit: '%',
        divide_by: 100,
        description: 'Percentage of the federal EITC with two qualifying children. Current: 11%.',
      },
      {
        name: 'match_3_children',
        label: 'Match rate (3+ children)',
        path: 'gov.states.wi.tax.income.credits.earned_income.fraction[3].amount',
        default_value: 34,
        min_value: 0,
        max_value: 100,
        step: 1,
        unit: '%',
        divide_by: 100,
        description: 'Percentage of the federal EITC with three or more qualifying children. Current: 34%.',
      },
    ],
  },
  OR: {
    name: 'Oregon earned income credit',
    description:
      "Oregon's earned income credit is a percentage of the federal EITC, with a higher rate for filers who have a young child (under 3). Set each rate.",
    kind: 'match',
    requires_income_tax: true,
    params: [
      {
        name: 'match_young_child',
        label: 'Match rate (with young child)',
        path: 'gov.states.or.tax.income.credits.eitc.match.has_young_child',
        default_value: 12,
        min_value: 0,
        max_value: 100,
        step: 1,
        unit: '%',
        divide_by: 100,
        description: 'Percentage of the federal EITC for filers with a child under 3. Current: 12%.',
      },
      {
        name: 'match_no_young_child',
        label: 'Match rate (no young child)',
        path: 'gov.states.or.tax.income.credits.eitc.match.no_young_child',
        default_value: 9,
        min_value: 0,
        max_value: 100,
        step: 1,
        unit: '%',
        divide_by: 100,
        description: 'Percentage of the federal EITC for filers with no child under 3. Current: 9%.',
      },
    ],
  },
};

export function eitcStructured(stateCode: string): boolean {
  return stateCode.toUpperCase() in STRUCTURED_EITC;
}

/** True only for Working Family (Tax) Credit states (MN, WA) — not for
 *  multi-rate federal-EITC matches (WI, OR), which stay labelled "EITC". */
export function eitcIsWfc(stateCode: string): boolean {
  return STRUCTURED_EITC[stateCode.toUpperCase()]?.kind === 'wfc';
}

/** PolicyEngine-US reform dict for a structured (non-match) state EITC — MN's
 *  Working Family Credit or WA's Working Families Tax Credit. Emits ONLY the
 *  parameters the user changed from current law (same no-op contract as
 *  buildStateCtcReform), so an unmodified selection produces no reform. */
export function buildStructuredEitcReform(
  stateCode: string,
  paramValues?: Record<string, number>,
): Record<string, number> {
  const entry = STRUCTURED_EITC[stateCode.toUpperCase()];
  if (!entry) return {};
  const out: Record<string, number> = {};
  for (const p of entry.params) {
    const ui = paramValues?.[p.name];
    if (ui === undefined || ui === p.default_value) continue; // unchanged
    const value = p.divide_by ? ui / p.divide_by : ui;
    for (const path of p.paths ?? [p.path!]) out[path] = value;
  }
  return out;
}

// ---- Reform options registry --------------------------------------------

export type ReformCategory =
  | 'state_ctc'
  | 'state_eitc'
  | 'state_dependent_exemption'
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
  /** Only render this parameter when the named sibling param is falsy (0). */
  depends_on_off?: string;
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
  dependent_exemption_options: ReformOption[];
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
  // MN / WA: structured Working Family (Tax) Credit, not a federal match.
  const struct = STRUCTURED_EITC[programs.state_code.toUpperCase()];
  if (struct) {
    if (struct.requires_income_tax && !programs.has_income_tax) return [];
    return [
      {
        id: `${programs.state_code.toLowerCase()}_eitc`,
        name: struct.name,
        description: struct.description,
        category: 'state_eitc',
        is_new_program: false,
        is_enhancement: true,
        is_configurable: true,
        adjustable_params: struct.params.map((p) => ({
          name: p.name,
          label: p.label,
          min_value: p.min_value,
          max_value: p.max_value,
          default_value: p.default_value,
          step: p.step,
          unit: p.unit,
          description: p.description,
          ...(p.control ? { control: p.control } : {}),
        })),
      },
    ];
  }
  if (!programs.has_income_tax) return [];
  if (!eitcConfigurable(programs.state_code)) return [];
  const { current_rate, description } = describeEitcAction(programs);
  // Nonrefundable state EITCs (e.g. SC, MO, OH, UT) can't be modelled as a
  // simple match-rate reform without PE-US changes, so surface the option
  // greyed-out (non-selectable) rather than wiring a misleading slider.
  const nonrefundable = programs.eitc?.refundable === false;
  return [
    {
      id: `${programs.state_code.toLowerCase()}_eitc`,
      name: `${programs.state_name} EITC`,
      description: nonrefundable
        ? `${programs.state_name}'s EITC is nonrefundable; modelling a reform to it requires upcoming PolicyEngine-US changes.`
        : description,
      category: 'state_eitc',
      is_new_program: programs.eitc === null,
      is_enhancement: programs.eitc !== null,
      is_configurable: !nonrefundable,
      ...(nonrefundable ? { in_development: true } : {}),
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

// ---- State dependent exemption / credit conversion -----------------------
//
// Lets users shrink, eliminate, or partially repeal a state's per-dependent
// exemption/credit (then optionally replace it with a state EITC or child
// allowance by also selecting those options). Three mechanisms, keyed in
// data/dependent-exemption-reforms.json:
//   - 'baseline': a clean scalar per-dependent parameter — set it directly
//     (a lower value partially repeals; 0 eliminates).
//   - 'contrib' (RI/DE/OR/VA): a contributed reform that separates the
//     dependent portion of a bundled personal exemption — flip its in_effect
//     flag and set its amount (0 eliminates).
//   - 'repeal' (bundled/bracketed states): the broad
//     gov.contrib.repeal_state_dependent_exemptions flag — eliminate-only.
interface DependentExemptionEntry {
  mechanism: 'baseline' | 'contrib' | 'repeal';
  amount_path?: string;
  in_effect?: string;
  amount?: string;
  repeal_flag?: string;
  current_amount?: number;
  amount_editable: boolean;
  kind: 'exemption' | 'credit' | 'deduction';
  note?: string;
}

const DEPENDENT_EXEMPTION_REFORMS = dependentExemptionReforms as unknown as Record<
  string,
  DependentExemptionEntry
>;

export function dependentExemptionEntry(
  stateCode: string,
): DependentExemptionEntry | null {
  const entry = DEPENDENT_EXEMPTION_REFORMS[stateCode.toUpperCase()];
  return entry && typeof entry === 'object' && 'mechanism' in entry
    ? entry
    : null;
}

/** PolicyEngine-US reform dict for a state's dependent exemption/credit.
 *  `eliminate` zeroes it (or flips the broad repeal flag for bundled states);
 *  otherwise an edited `amount` is applied. An untouched amount on a
 *  non-eliminated baseline/contrib lever is a no-op (nothing emitted), except
 *  contrib levers must flip their in_effect flag whenever active. */
export function buildDependentExemptionReform(
  stateCode: string,
  pv?: Record<string, number>,
): Record<string, number | boolean> {
  const entry = dependentExemptionEntry(stateCode);
  if (!entry) return {};
  const reform: Record<string, number | boolean> = {};
  const eliminate = !!pv?.eliminate;
  const editedAmount =
    entry.amount_editable && pv?.amount !== undefined ? pv.amount : undefined;

  if (entry.mechanism === 'repeal') {
    if (eliminate && entry.repeal_flag) reform[entry.repeal_flag] = true;
    return reform;
  }

  if (entry.mechanism === 'contrib') {
    // The contributed reform must be active to separate (and re-price) the
    // dependent portion. Only emit it when the user actually changes things.
    if (eliminate) {
      if (entry.in_effect) reform[entry.in_effect] = true;
      if (entry.amount) reform[entry.amount] = 0;
    } else if (editedAmount !== undefined && editedAmount !== entry.current_amount) {
      if (entry.in_effect) reform[entry.in_effect] = true;
      if (entry.amount) reform[entry.amount] = editedAmount;
    }
    return reform;
  }

  // baseline: set the scalar param directly.
  if (entry.amount_path) {
    if (eliminate) reform[entry.amount_path] = 0;
    else if (editedAmount !== undefined && editedAmount !== entry.current_amount)
      reform[entry.amount_path] = editedAmount;
  }
  return reform;
}

function buildDependentExemptionOptions(
  programs: StateProgramRecord,
): ReformOption[] {
  const entry = dependentExemptionEntry(programs.state_code);
  if (!entry) return [];
  if (!programs.has_income_tax) return [];

  const kindLabel =
    entry.kind === 'credit'
      ? 'dependent credit'
      : entry.kind === 'deduction'
        ? 'dependent deduction'
        : 'dependent exemption';
  const params: AdjustableParameter[] = [
    {
      name: 'eliminate',
      label: `Eliminate the ${kindLabel}`,
      control: 'toggle',
      min_value: 0,
      max_value: 1,
      default_value: 0,
      step: 1,
      unit: '',
      description: `Repeal ${programs.state_name}'s ${kindLabel} entirely (set it to $0).`,
    },
  ];
  if (entry.amount_editable && entry.current_amount !== undefined) {
    params.push({
      name: 'amount',
      label: 'Amount per dependent',
      min_value: 0,
      max_value: Math.max(10000, Math.ceil((entry.current_amount * 2) / 100) * 100),
      default_value: entry.current_amount,
      step: 50,
      unit: '$',
      depends_on_off: 'eliminate',
      description: `Per-dependent ${kindLabel} amount. Current: $${entry.current_amount.toLocaleString()}. Lower it to partially repeal.`,
    });
  }

  const capitalizedKind = kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1);
  return [
    {
      id: `${programs.state_code.toLowerCase()}_dependent_exemption`,
      name: `${programs.state_name} ${capitalizedKind}`,
      description: entry.amount_editable
        ? `Adjust, partially repeal, or eliminate ${programs.state_name}'s ${kindLabel}. Pair it with a state EITC or child allowance to model a swap.`
        : `Eliminate ${programs.state_name}'s ${kindLabel}. (Its per-dependent value varies by income/age/filing status, so only full repeal is offered.) Pair it with a state EITC or child allowance to model a swap.`,
      category: 'state_dependent_exemption',
      is_new_program: false,
      is_enhancement: false,
      is_configurable: true,
      adjustable_params: params,
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
          default_value: 1000,
          step: 100,
          unit: '$',
          description: 'Annual amount per child under age 1.',
        },
        {
          name: 'young_child_amount',
          label: 'Ages 1–5 (under 6)',
          min_value: 0,
          max_value: 12000,
          default_value: 1000,
          step: 100,
          unit: '$',
          description: 'Annual amount per child age 1 through 5.',
        },
        {
          name: 'older_child_amount',
          label: 'Ages 6+ (to cutoff)',
          min_value: 0,
          max_value: 12000,
          default_value: 1000,
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
    },
    {
      id: 'federal_afa',
      name: 'American Family Act',
      description:
        "Sen. Bennet's American Family Act: a fully-refundable CTC of $3,600/child (1.2× for under-6), with a baby bonus in the first month and income phase-out.",
      category: 'federal_ctc',
      is_new_program: false,
      is_enhancement: true,
    },
    {
      // ID must not end in `_eitc` (that routes to the state-EITC builder).
      id: 'federal_tax_cuts_for_workers',
      name: 'Tax Cuts for Workers Act',
      description:
        'EITC expansion for workers without qualifying children: roughly doubles the maximum credit (to ~$1,500), raises the phase-in and phase-out rates to 15.3%, and broadens age eligibility to 19+ with no upper limit.',
      category: 'federal_eitc',
      is_new_program: false,
      is_enhancement: true,
    },
    {
      id: 'federal_working_parents_tax_relief',
      name: 'Working Parents Tax Relief Act',
      description:
        "McDonald–Rivet's Working Parents Tax Relief Act: boosts the EITC for parents of young children (under 4) — a higher credit percentage per young child and a larger phase-out threshold.",
      category: 'federal_eitc',
      is_new_program: false,
      is_enhancement: true,
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
  path?: string; // single target path
  paths?: string[]; // multiple target paths set to the same value (e.g. CO's 5 filing statuses)
  default_value: number;
  min_value: number;
  max_value: number;
  step: number;
  unit: string;
  description: string;
  divide_by?: number; // UI percent -> /1 rate when set to 100
  control?: 'toggle'; // render as a checkbox (stored 0/1)
}

interface CtcRegistryEntry {
  name: string;
  description: string;
  params: CtcParam[];
  /** Surface the option greyed-out / non-selectable — wired in PE-US but the
   *  current modelling is too rough to expose as a reform (e.g. NE's Child
   *  Care Tax Credit, whose licensed-care gate PE only approximates). */
  in_development?: boolean;
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
  MA: {
    name: 'Massachusetts Child and Family Tax Credit',
    description:
      'Refundable credit per qualifying dependent (child under 13, adult 65 or older, or disabled); no cap on the number of dependents.',
    params: [
      {
        name: 'amount',
        label: 'Credit amount per dependent',
        path: 'gov.states.ma.tax.income.credits.child_and_family.amount',
        default_value: 440,
        min_value: 0,
        max_value: 5000,
        step: 10,
        unit: '$',
        description: 'Refundable credit per qualifying dependent. Current: $440.',
      },
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
  // --- Income-bracketed-amount states (amount is a per-income-tier scale).
  // We expose each tier's dollar amount; the income thresholds stay fixed.
  CO: {
    name: 'Colorado Child Tax Credit',
    description:
      'Refundable credit for children under 6, paid as a per-child amount that steps down with federal AGI (same tier amounts across filing statuses; income thresholds differ). Edit each tier amount.',
    params: [
      coTier(0, 1200, 'Tier 1 amount (lowest AGI)'),
      coTier(1, 600, 'Tier 2 amount (middle AGI)'),
      coTier(2, 200, 'Tier 3 amount (upper AGI)'),
      AGE('gov.states.co.tax.income.credits.ctc.age_threshold', 6),
    ],
  },
  NE: {
    name: 'Nebraska Child Care Tax Credit',
    // Greyed out until we can better model it: this is the Child Care Tax
    // Credit Act credit (not a traditional per-child CTC), and PE only
    // approximates its licensed-care gate (reported childcare expenses OR
    // income eligibility), so a reform here would be unreliable.
    in_development: true,
    description:
      'Refundable credit for children age 5 or under in licensed child care, stepping down with AGI ($2,000 under $75k; $1,000 to $150k).',
    params: [
      bracketAmt('gov.states.ne.tax.income.credits.ctc.refundable.amount', 0, 2000, 'Amount (AGI under $75k)'),
      bracketAmt('gov.states.ne.tax.income.credits.ctc.refundable.amount', 1, 1000, 'Amount (AGI $75k–$150k)'),
      AGE('gov.states.ne.tax.income.credits.ctc.refundable.age_threshold', 5),
      DOLLAR('threshold_1', 'Lower tier ends (AGI)', 'gov.states.ne.tax.income.credits.ctc.refundable.amount[1].threshold', 75000, 'AGI where the credit steps down to the second tier.', 300000),
      DOLLAR('threshold_2', 'Credit ends (AGI)', 'gov.states.ne.tax.income.credits.ctc.refundable.amount[2].threshold', 150000, 'AGI at/above which no credit is paid.', 500000),
    ],
  },
  NJ: {
    name: 'New Jersey Child Tax Credit',
    description:
      'Non-refundable credit for children under 6, stepping down with NJ taxable income ($1,000 down to $0). Edit each tier amount.',
    params: [
      bracketAmt('gov.states.nj.tax.income.credits.ctc.amount', 0, 1000, 'Amount (income under $30k)'),
      bracketAmt('gov.states.nj.tax.income.credits.ctc.amount', 1, 800, 'Amount ($30k–$40k)'),
      bracketAmt('gov.states.nj.tax.income.credits.ctc.amount', 2, 600, 'Amount ($40k–$50k)'),
      bracketAmt('gov.states.nj.tax.income.credits.ctc.amount', 3, 400, 'Amount ($50k–$60k)'),
      bracketAmt('gov.states.nj.tax.income.credits.ctc.amount', 4, 200, 'Amount ($60k–$80k)'),
      AGE('gov.states.nj.tax.income.credits.ctc.age_limit', 6),
    ],
  },
  NM: {
    name: 'New Mexico Child Income Tax Credit',
    description:
      'Refundable credit for all qualifying children, stepping down with federal AGI ($637 down to $26). Edit each tier amount.',
    params: [
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 0, 637, 'Amount (AGI under $25k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 1, 424, 'Amount ($25k–$50k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 2, 212, 'Amount ($50k–$75k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 3, 106, 'Amount ($75k–$100k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 4, 79, 'Amount ($100k–$200k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 5, 53, 'Amount ($200k–$350k)', 2000),
      bracketAmt('gov.states.nm.tax.income.credits.ctc.amount', 6, 26, 'Amount ($350k+)', 2000),
    ],
  },
  // --- New York: handled specially (year-aware) by buildNyCtcReform.
  NY: {
    name: 'New York Empire State Child Credit',
    description:
      'Current (2025–2027) structure pays by child age and phases out by filing status. After 2027 it reverts to the regular 33%-of-federal credit unless you extend it below.',
    params: [
      {
        name: 'extend',
        label: 'Extend the 2025–2027 credit beyond 2027',
        control: 'toggle',
        default_value: 0,
        min_value: 0,
        max_value: 1,
        step: 1,
        unit: '',
        description:
          'For analysis years 2028+, keep the current age-based credit in effect instead of reverting to the regular (33% of federal) credit. No effect for 2026–2027.',
      },
      DOLLAR('young_amount', 'Amount — ages 0–3', '', 1000, 'Credit per child under age 4.', 5000),
      DOLLAR('older_amount', 'Amount — ages 4–16', '', 500, 'Credit per child age 4–16.', 5000),
      DOLLAR('threshold_single', 'Phase-out — single', '', 75000, 'Federal AGI where phase-out begins (single).'),
      DOLLAR('threshold_joint', 'Phase-out — joint', '', 110000, 'Federal AGI where phase-out begins (joint).'),
      DOLLAR('threshold_hoh', 'Phase-out — head of household', '', 75000, 'Federal AGI where phase-out begins (HoH).'),
      DOLLAR('threshold_separate', 'Phase-out — separate', '', 55000, 'Federal AGI where phase-out begins (separate).'),
      DOLLAR('threshold_surviving_spouse', 'Phase-out — surviving spouse', '', 110000, 'Federal AGI where phase-out begins (surviving spouse).'),
      {
        name: 'rate',
        label: 'Phase-out rate',
        default_value: 16.5,
        min_value: 0,
        max_value: 100,
        step: 0.5,
        unit: '%',
        description: 'Percent of each $1,000 of AGI over the threshold that reduces the credit.',
      },
    ],
  },
};

// Colorado tier amount, applied to all five filing-status scales at once.
function coTier(idx: number, def: number, label: string): CtcParam {
  const statuses = ['single', 'joint', 'head_of_household', 'separate', 'surviving_spouse'];
  return {
    name: `tier${idx + 1}`,
    label,
    paths: statuses.map(
      (s) => `gov.states.co.tax.income.credits.ctc.amount.${s}[${idx}].amount`,
    ),
    default_value: def,
    min_value: 0,
    max_value: 3000,
    step: 50,
    unit: '$',
    description: 'Per-child credit for this income tier (all filing statuses).',
  };
}

// A single bracket-scale amount (e.g. ``...amount[2].amount``).
function bracketAmt(
  scalePath: string,
  idx: number,
  def: number,
  label: string,
  max = 3000,
): CtcParam {
  return {
    name: `tier${idx + 1}`,
    label,
    path: `${scalePath}[${idx}].amount`,
    default_value: def,
    min_value: 0,
    max_value: max,
    step: 50,
    unit: '$',
    description: 'Per-child credit for this income tier.',
  };
}

function nyAgeParams(): AdjustableParameter[] {
  return [
    { name: 'young_amount', label: 'Amount — ages 0–3', min_value: 0, max_value: 5000, default_value: 1000, step: 50, unit: '$', description: 'Credit per child under age 4.' },
    { name: 'older_amount', label: 'Amount — ages 4–16', min_value: 0, max_value: 5000, default_value: 500, step: 50, unit: '$', description: 'Credit per child age 4–16.' },
    { name: 'threshold_single', label: 'Phase-out — single', min_value: 0, max_value: 500000, default_value: 75000, step: 1000, unit: '$', description: 'Federal AGI where phase-out begins (single).' },
    { name: 'threshold_joint', label: 'Phase-out — joint', min_value: 0, max_value: 500000, default_value: 110000, step: 1000, unit: '$', description: 'Federal AGI where phase-out begins (joint).' },
    { name: 'threshold_hoh', label: 'Phase-out — head of household', min_value: 0, max_value: 500000, default_value: 75000, step: 1000, unit: '$', description: 'Federal AGI where phase-out begins (HoH).' },
    { name: 'threshold_separate', label: 'Phase-out — separate', min_value: 0, max_value: 500000, default_value: 55000, step: 1000, unit: '$', description: 'Federal AGI where phase-out begins (separate).' },
    { name: 'threshold_surviving_spouse', label: 'Phase-out — surviving spouse', min_value: 0, max_value: 500000, default_value: 110000, step: 1000, unit: '$', description: 'Federal AGI where phase-out begins (surviving spouse).' },
    { name: 'rate', label: 'Reduction per increment', min_value: 0, max_value: 500, default_value: 16.5, step: 0.5, unit: '$', description: 'Dollars of credit lost for each AGI increment over the threshold (increments are rounded up).' },
    { name: 'increment', label: 'AGI increment size', min_value: 1, max_value: 20000, default_value: 1000, step: 100, unit: '$', description: 'Income step the phase-out counts: the credit drops by the reduction amount for each increment of AGI over the threshold.' },
  ];
}

/** NY inputs depend on the analysis year: 2026-2027 shows the age-based
 *  (current-law) format; 2028+ shows the regular 33%-of-federal format by
 *  default, switching to the age-based format when "extend" is on. */
function nyCtcParams(year: number): AdjustableParameter[] {
  const age = nyAgeParams();
  if (year <= 2027) return age;
  const oldFormat: AdjustableParameter[] = [
    { name: 'percent', label: 'Credit (% of federal CTC)', min_value: 0, max_value: 100, default_value: 33, step: 1, unit: '%', description: 'Share of the federal CTC paid as the regular Empire State Child Credit.', depends_on_off: 'extend' },
    { name: 'minimum', label: 'Minimum per child', min_value: 0, max_value: 2000, default_value: 100, step: 25, unit: '$', description: 'Minimum regular credit per qualifying child below the federal phase-out.', depends_on_off: 'extend' },
  ];
  const extended = age.map((p) => ({ ...p, depends_on: 'extend' }));
  return [
    { name: 'extend', label: 'Extend the 2025–2027 credit beyond 2027', control: 'toggle', min_value: 0, max_value: 1, default_value: 0, step: 1, unit: '', description: 'Keep the age-based credit in effect this year instead of reverting to the regular (33% of federal) credit.' },
    ...oldFormat,
    ...extended,
  ];
}

/** Reform options for the selected state's current-law CTC (one card with
 *  its modifiable parameters), or [] if the state has no wired CTC. */
export function buildStateCtcOptions(
  stateCode: string,
  year = 2026,
): ReformOption[] {
  const code = stateCode.toUpperCase();
  const entry = CTC_REFORMS[code];
  if (!entry) return [];
  const adjustable_params: AdjustableParameter[] =
    code === 'NY'
      ? nyCtcParams(year)
      : entry.params.map((p) => ({
          name: p.name,
          label: p.label,
          min_value: p.min_value,
          max_value: p.max_value,
          default_value: p.default_value,
          step: p.step,
          unit: p.unit,
          description: p.description,
          ...(p.control ? { control: p.control } : {}),
        }));
  return [
    {
      id: `${stateCode.toLowerCase()}_ctc`,
      name: entry.name,
      description: entry.description,
      category: 'state_ctc',
      is_new_program: false,
      is_enhancement: true,
      is_configurable: !entry.in_development,
      ...(entry.in_development ? { in_development: true } : {}),
      adjustable_params,
    },
  ];
}

/** PolicyEngine-US reform dict for a state's CTC. Emits ONLY parameters the
 *  user changed from current law, so an unmodified selection is a no-op.
 *  NY is handled specially (year-aware) because its current structure
 *  reverts after 2027. */
export function buildStateCtcReform(
  stateCode: string,
  paramValues?: Record<string, number>,
  year = 2026,
): Record<string, number | boolean> {
  const code = stateCode.toUpperCase();
  if (code === 'NY') return buildNyCtcReform(paramValues, year);
  const entry = CTC_REFORMS[code];
  if (!entry) return {};
  const out: Record<string, number> = {};
  for (const p of entry.params) {
    const ui = paramValues?.[p.name];
    if (ui === undefined || ui === p.default_value) continue; // unchanged
    const value = p.divide_by ? ui / p.divide_by : ui;
    for (const path of p.paths ?? [p.path!]) out[path] = value;
  }
  return out;
}

/** New York Empire State Child Credit. The 2025-2027 age-based structure
 *  reverts after 2027, so for analysis years 2028+ the whole post-2024
 *  block (in_effect + amounts + phase-out) must be restored to keep it,
 *  and only if the user opts to "extend". For 2026-2027 it's already
 *  current law, so we emit only the params the user changed. */
function buildNyCtcReform(
  pv: Record<string, number> | undefined,
  year: number,
): Record<string, number | boolean> {
  const P = 'gov.states.ny.tax.income.credits.ctc.post_2024';
  const out: Record<string, number | boolean> = {};
  const reverts = year >= 2028;
  const extend = (pv?.extend ?? 0) > 0;
  const young = pv?.young_amount ?? 1000;
  const older = pv?.older_amount ?? 500;
  const tSingle = pv?.threshold_single ?? 75000;
  const tJoint = pv?.threshold_joint ?? 110000;
  const tHoh = pv?.threshold_hoh ?? 75000;
  const tSep = pv?.threshold_separate ?? 55000;
  const tSurv = pv?.threshold_surviving_spouse ?? 110000;
  const rate = pv?.rate ?? 16.5;
  const increment = pv?.increment ?? 1000;

  if (reverts) {
    // Post-2024 has reverted to $0/off. Without "extend", current law is the
    // regular 33%-of-federal credit — let the user edit that format instead.
    if (!extend) {
      const percent = pv?.percent ?? 33;
      const minimum = pv?.minimum ?? 100;
      if (percent !== 33) out['gov.states.ny.tax.income.credits.ctc.amount.percent'] = percent / 100;
      if (minimum !== 100) out['gov.states.ny.tax.income.credits.ctc.amount.minimum'] = minimum;
      return out;
    }
    // Restore the full block (all $0/false in the 2028 baseline).
    out[`${P}.in_effect`] = true;
    out[`${P}.amount[0].amount`] = young;
    out[`${P}.amount[1].amount`] = older;
    out[`${P}.phase_out.threshold.SINGLE`] = tSingle;
    out[`${P}.phase_out.threshold.JOINT`] = tJoint;
    out[`${P}.phase_out.threshold.HEAD_OF_HOUSEHOLD`] = tHoh;
    out[`${P}.phase_out.threshold.SEPARATE`] = tSep;
    out[`${P}.phase_out.threshold.SURVIVING_SPOUSE`] = tSurv;
    out[`${P}.phase_out.rate`] = rate;
    out[`${P}.phase_out.increment`] = increment;
    return out;
  }

  // 2026-2027: post-2024 is current law; emit only changed params.
  const set = (key: string, val: number, def: number) => {
    if (val !== def) out[key] = val;
  };
  set(`${P}.amount[0].amount`, young, 1000);
  set(`${P}.amount[1].amount`, older, 500);
  set(`${P}.phase_out.threshold.SINGLE`, tSingle, 75000);
  set(`${P}.phase_out.threshold.JOINT`, tJoint, 110000);
  set(`${P}.phase_out.threshold.HEAD_OF_HOUSEHOLD`, tHoh, 75000);
  set(`${P}.phase_out.threshold.SEPARATE`, tSep, 55000);
  set(`${P}.phase_out.threshold.SURVIVING_SPOUSE`, tSurv, 110000);
  set(`${P}.phase_out.rate`, rate, 16.5);
  set(`${P}.phase_out.increment`, increment, 1000);
  return out;
}

/** State codes that have a wired current-law CTC. */
export function stateHasCtc(stateCode: string): boolean {
  return CTC_REFORMS[stateCode.toUpperCase()] !== undefined;
}

export function getReformOptionsForState(
  stateCode: string,
  year = 2026,
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
      dependent_exemption_options: [],
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
    ctc_options: buildStateCtcOptions(programs.state_code, year),
    eitc_options: buildEitcOptions(programs),
    dependent_exemption_options: buildDependentExemptionOptions(programs),
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
