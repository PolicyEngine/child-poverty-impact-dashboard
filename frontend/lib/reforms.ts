/**
 * Single source of truth for translating the dashboard's reform-option IDs
 * into PolicyEngine-US reform dicts.
 *
 * Both the statewide economy path (lib/api.ts) and the household path
 * (lib/household-api.ts) call ``buildReformDict`` here so the two can't
 * drift — previously each had its own inline copy and they disagreed (the
 * household path set CTC phase-out thresholds the economy path didn't, and
 * neither actually set the 2021 expanded-CTC amounts the option promised).
 *
 * Values are emitted as scalars; Modal's wrapper defaults the effective
 * date to ``{year}-01-01``. Bracketed parameter paths (e.g.
 * ``...by_age[0].amount``) are passed through verbatim — policyengine-core's
 * ``Reform.from_dict`` resolves the ``[i]`` syntax.
 */

import { buildStateEitcReform, buildStateCtcReform } from './state-programs';

export type ReformDictValue =
  | number
  | boolean
  | Record<string, number | boolean>;
export type ReformDict = Record<string, ReformDictValue>;

type ParameterValues = Record<string, Record<string, number>>;

// Child-allowance defaults (annual $ per child). The ubi_center
// basic-income amounts are annual (period: year). Three age tiers plus an
// adjustable top cutoff; set all three equal for a flat allowance.
export const CHILD_ALLOWANCE_DEFAULT_INFANT = 1000; // under 1
export const CHILD_ALLOWANCE_DEFAULT_YOUNG = 1000; //  ages 1–5
export const CHILD_ALLOWANCE_DEFAULT_OLDER = 1000; //  ages 6 to cutoff
export const CHILD_ALLOWANCE_DEFAULT_CUTOFF = 18; //   under 18 vs under 19

// Optional AGI-based phase-out (turns the allowance into an income-tested
// CTC). Rate is a percent in the UI; thresholds are AGI dollars by filing
// status. Defaults: 5% above $100k single/HoH/separate, $200k joint/
// surviving-spouse.
export const CHILD_ALLOWANCE_DEFAULT_PHASEOUT_RATE = 5; // percent
export const CHILD_ALLOWANCE_DEFAULT_THRESHOLD_SINGLE = 100000;
export const CHILD_ALLOWANCE_DEFAULT_THRESHOLD_JOINT = 200000;

// ubi_center basic income paths. BI is the age-bracketed amount schedule
// (baseline brackets [0]≥0, [1]≥6, [2]≥18, [3]≥25, [4]≥65, all $0); the
// child allowance re-cuts the lower brackets to 0 / 1 / 6 / cutoff for
// three child tiers. PO is the (sibling) phase-out node.
const BI = 'gov.contrib.ubi_center.basic_income.amount.person.by_age';
const PO = 'gov.contrib.ubi_center.basic_income.phase_out';

// CTC ARPA amount schedule: bracket [0] = under 6, [1] = 6–17.
const BI_CTC_ARPA = 'gov.irs.credits.ctc.amount.arpa';

/** Apply a single reform option to the accumulating reform dict.
 *  Throws on an unrecognised / unwired ID so a placeholder option can
 *  never silently produce a zero-impact "result". */
function applyReformOption(
  reform: ReformDict,
  id: string,
  parameterValues: ParameterValues | undefined,
  year: number,
): void {
  // State EITC — IDs look like ``ca_eitc`` / ``dc_eitc``.
  if (id.endsWith('_eitc')) {
    const state = id.slice(0, 2).toUpperCase();
    const ratePct = parameterValues?.[id]?.match_rate ?? 30;
    Object.assign(reform, buildStateEitcReform(state, ratePct / 100, year));
    return;
  }

  // State CTC — IDs look like ``ca_ctc`` / ``dc_ctc`` (federal_ctc_expanded
  // does not end in ``_ctc``, so no collision). Emits only changed params.
  if (id.endsWith('_ctc')) {
    const state = id.slice(0, 2).toUpperCase();
    Object.assign(
      reform,
      buildStateCtcReform(state, parameterValues?.[id], year),
    );
    return;
  }

  switch (id) {
    case 'federal_ctc_expanded': {
      // Restore the 2021 (ARPA) expanded CTC: $3,600 for under-6, $3,000
      // for 6–17, fully refundable, with the ARPA phase-out structure
      // ($75k single / $112.5k HoH / $150k joint on the expanded portion).
      reform[`${BI_CTC_ARPA}[0].amount`] = 3600;
      reform[`${BI_CTC_ARPA}[1].amount`] = 3000;
      reform['gov.irs.credits.ctc.refundable.fully_refundable'] = true;
      reform['gov.irs.credits.ctc.phase_out.arpa.in_effect'] = true;
      return;
    }
    case 'federal_afa': {
      // American Family Act (Bennet). Activating the contrib flag applies
      // the AFA CTC structure (base $3,600, 1.2x under-6, baby bonus,
      // phase-out) — verified to take effect via parameter override alone.
      reform['gov.contrib.congress.afa.in_effect'] = true;
      return;
    }
    case 'child_allowance': {
      // Three-tier unconditional child allowance via ubi_center basic
      // income: under 1, ages 1–5, and ages 6 up to an adjustable cutoff
      // (under 18 or under 19). Re-cut the bracket boundaries to 0/1/6/
      // cutoff, then set each tier's amount. All three tiers compose, so a
      // flat allowance is just three equal amounts.
      const pv = parameterValues?.['child_allowance'];
      const infant = pv?.infant_amount ?? CHILD_ALLOWANCE_DEFAULT_INFANT;
      const young = pv?.young_child_amount ?? CHILD_ALLOWANCE_DEFAULT_YOUNG;
      const older = pv?.older_child_amount ?? CHILD_ALLOWANCE_DEFAULT_OLDER;
      const cutoff = pv?.cutoff_age ?? CHILD_ALLOWANCE_DEFAULT_CUTOFF;
      reform[`${BI}[1].threshold`] = 1; // ages 1–5 band starts at 1
      reform[`${BI}[2].threshold`] = 6; // ages 6+ band starts at 6
      reform[`${BI}[3].threshold`] = cutoff; // adults (=$0) start at cutoff
      reform[`${BI}[0].amount`] = infant; // under 1
      reform[`${BI}[1].amount`] = young; // ages 1–5
      reform[`${BI}[2].amount`] = older; // ages 6 to cutoff

      // Optional AGI phase-out — turns the flat allowance into an
      // income-tested credit. Off by default (rate stays 0). When on, the
      // allowance phases out at `rate` per $1 of AGI above the filing-
      // status threshold. taxable stays false (its default) so the
      // phase-out applies.
      if (pv?.phaseout_enabled) {
        const ratePct = pv?.phaseout_rate ?? CHILD_ALLOWANCE_DEFAULT_PHASEOUT_RATE;
        const single =
          pv?.phaseout_threshold_single ??
          CHILD_ALLOWANCE_DEFAULT_THRESHOLD_SINGLE;
        const hoh =
          pv?.phaseout_threshold_hoh ??
          CHILD_ALLOWANCE_DEFAULT_THRESHOLD_SINGLE;
        const separate =
          pv?.phaseout_threshold_separate ??
          CHILD_ALLOWANCE_DEFAULT_THRESHOLD_SINGLE;
        const joint =
          pv?.phaseout_threshold_joint ??
          CHILD_ALLOWANCE_DEFAULT_THRESHOLD_JOINT;
        const survivingSpouse =
          pv?.phaseout_threshold_surviving_spouse ??
          CHILD_ALLOWANCE_DEFAULT_THRESHOLD_JOINT;
        reform[`${PO}.by_rate`] = true;
        reform[`${PO}.rate`] = ratePct / 100; // percent → /1
        reform[`${PO}.threshold.SINGLE`] = single;
        reform[`${PO}.threshold.HEAD_OF_HOUSEHOLD`] = hoh;
        reform[`${PO}.threshold.SEPARATE`] = separate;
        reform[`${PO}.threshold.JOINT`] = joint;
        reform[`${PO}.threshold.SURVIVING_SPOUSE`] = survivingSpouse;
      }
      return;
    }
    default:
      throw new Error(`Unknown or unwired reform option: ${id}`);
  }
}

/** Build the combined PolicyEngine-US reform dict for a set of selected
 *  option IDs. Returns ``{}`` when nothing is selected (callers treat an
 *  empty dict as "baseline / no reform"). */
export function buildReformDict(
  reformOptionIds: string[],
  parameterValues: ParameterValues | undefined,
  year: number,
): ReformDict {
  const reform: ReformDict = {};
  for (const id of reformOptionIds) {
    applyReformOption(reform, id, parameterValues, year);
  }
  return reform;
}
