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

import {
  buildStateEitcReform,
  buildStateCtcReform,
  eitcStructured,
  buildStructuredEitcReform,
  buildDependentExemptionReform,
} from './state-programs';

export type ReformDictValue =
  | number
  | boolean
  | Record<string, number | boolean>;
export type ReformDict = Record<string, ReformDictValue>;

type ParameterValues = Record<string, Record<string, number>>;

// Child-allowance defaults (annual $ per child). The ubi_center
// basic-income amounts are annual (period: year). Four age tiers plus an
// adjustable top cutoff; set all four equal for a flat allowance.
export const CHILD_ALLOWANCE_DEFAULT_INFANT = 1000; //   under 1
export const CHILD_ALLOWANCE_DEFAULT_TODDLER = 1000; //  ages 1–3
export const CHILD_ALLOWANCE_DEFAULT_PRESCHOOL = 1000; // ages 4–5
export const CHILD_ALLOWANCE_DEFAULT_OLDER = 1000; //    ages 6 to cutoff
export const CHILD_ALLOWANCE_DEFAULT_CUTOFF = 18; //     under 18 vs under 19

// Optional AGI-based phase-out (turns the allowance into an income-tested
// CTC). Rate is a percent in the UI; thresholds are AGI dollars by filing
// status. Defaults: 5% above $100k single/HoH/separate, $200k joint/
// surviving-spouse.
export const CHILD_ALLOWANCE_DEFAULT_PHASEOUT_RATE = 5; // percent
export const CHILD_ALLOWANCE_DEFAULT_THRESHOLD_SINGLE = 100000;
export const CHILD_ALLOWANCE_DEFAULT_THRESHOLD_JOINT = 200000;

// ubi_center basic income paths. BI is the age-bracketed amount schedule
// (baseline brackets [0]≥0, [1]≥6, [2]≥18, [3]≥25, [4]≥65, all $0); the
// child allowance re-cuts the lower brackets to 0 / 1 / 4 / 6 / cutoff for
// four child tiers. PO is the (sibling) phase-out node.
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
  // State EITC — IDs look like ``ca_eitc`` / ``dc_eitc``. MN and WA run a
  // structured Working Family (Tax) Credit rather than a federal-percentage
  // match, so they go through their own multi-parameter builder.
  if (id.endsWith('_eitc')) {
    const state = id.slice(0, 2).toUpperCase();
    if (eitcStructured(state)) {
      Object.assign(
        reform,
        buildStructuredEitcReform(state, parameterValues?.[id]),
      );
      return;
    }
    // Nonrefundable states (SC, MO, OH, UT) carry extra levers: a
    // `make_refundable` checkbox that flips the contributed reform, and (SC)
    // an adjustable / removable EITC cap. Refundable states just use the
    // match-rate slider. Any param the user left untouched is absent here, so
    // the builder falls back to the no-op current-law value.
    const pv = parameterValues?.[id];
    const matchRate =
      pv?.match_rate !== undefined ? pv.match_rate / 100 : undefined;
    Object.assign(
      reform,
      buildStateEitcReform(state, {
        matchRate,
        makeRefundable: !!pv?.make_refundable,
        eitcCap: pv?.eitc_cap,
        eliminateCap: !!pv?.eliminate_cap,
      }),
    );
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

  // State dependent exemption / credit — IDs look like
  // ``ny_dependent_exemption``. Adjust the per-dependent amount, partially
  // repeal, or eliminate it (full repeal flips the contributed reform or the
  // broad repeal flag depending on the state's mechanism).
  if (id.endsWith('_dependent_exemption')) {
    const state = id.slice(0, 2).toUpperCase();
    Object.assign(
      reform,
      buildDependentExemptionReform(state, parameterValues?.[id]),
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
    case 'federal_tax_cuts_for_workers': {
      // Tax Cuts for Workers Act EITC expansion (from the Keep Your Pay Act).
      // Expands the childless-worker EITC — the [0] (no-children) bracket:
      // higher max credit, 15.3% phase-in/out rates, and broader age
      // eligibility (19+, no upper limit). 2026 enacted-proposal values.
      reform['gov.irs.credits.eitc.eligibility.age.max'] = 200;
      reform['gov.irs.credits.eitc.eligibility.age.min'] = 19;
      reform['gov.irs.credits.eitc.eligibility.age.min_student'] = 24;
      reform['gov.irs.credits.eitc.max[0].amount'] = 1502;
      reform['gov.irs.credits.eitc.phase_in_rate[0].amount'] = 0.153;
      reform['gov.irs.credits.eitc.phase_out.rate[0].amount'] = 0.153;
      reform['gov.irs.credits.eitc.phase_out.start[0].amount'] = 11610;
      return;
    }
    case 'federal_working_parents_tax_relief': {
      // Working Parents Tax Relief Act (McDonald-Rivet). Activates the PE-US
      // contrib reform — a young-child (under 4) EITC boost: higher credit
      // percentage per young child and phase-out adjustments.
      reform[
        'gov.contrib.congress.mcdonald_rivet.working_parents_tax_relief_act.in_effect'
      ] = true;
      return;
    }
    case 'child_allowance': {
      // Four-tier unconditional child allowance via ubi_center basic income:
      // under 1, ages 1–3, ages 4–5, and ages 6 up to an adjustable cutoff
      // (under 18 or under 19). Re-cut the bracket boundaries to 0/1/4/6/
      // cutoff, then set each tier's amount. All tiers compose, so a flat
      // allowance is just four equal amounts. (Under 1 + ages 1–3 = the
      // prenatal-to-3 band.)
      const pv = parameterValues?.['child_allowance'];
      const infant = pv?.infant_amount ?? CHILD_ALLOWANCE_DEFAULT_INFANT;
      const toddler = pv?.toddler_amount ?? CHILD_ALLOWANCE_DEFAULT_TODDLER;
      const preschool = pv?.preschool_amount ?? CHILD_ALLOWANCE_DEFAULT_PRESCHOOL;
      const older = pv?.older_child_amount ?? CHILD_ALLOWANCE_DEFAULT_OLDER;
      const cutoff = pv?.cutoff_age ?? CHILD_ALLOWANCE_DEFAULT_CUTOFF;
      reform[`${BI}[1].threshold`] = 1; // ages 1–3 band starts at 1
      reform[`${BI}[2].threshold`] = 4; // ages 4–5 band starts at 4
      reform[`${BI}[3].threshold`] = 6; // ages 6 to cutoff band starts at 6
      reform[`${BI}[4].threshold`] = cutoff; // adults (=$0) start at cutoff
      reform[`${BI}[0].amount`] = infant; // under 1
      reform[`${BI}[1].amount`] = toddler; // ages 1–3
      reform[`${BI}[2].amount`] = preschool; // ages 4–5
      reform[`${BI}[3].amount`] = older; // ages 6 to cutoff

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
    case 'snap_reform': {
      // SNAP eligibility + generosity levers, mapped to real PolicyEngine-US
      // parameters. Emit only values the user changed from current law so an
      // untouched selection is a no-op. Percent sliders → /1 fractions.
      const pv = parameterValues?.['snap_reform'];
      const gross = pv?.gross_income_limit ?? 130;
      if (gross !== 130) reform['gov.usda.snap.income.limit.gross'] = gross / 100;
      if (pv?.abolish_net_income_test) {
        reform['gov.contrib.snap.abolish_net_income_test.in_effect'] = true;
      }
      const minBenefit = pv?.min_benefit ?? 8;
      if (minBenefit !== 8) reform['gov.usda.snap.min_allotment.rate'] = minBenefit / 100;
      const earnedDeduction = pv?.earned_income_deduction ?? 20;
      if (earnedDeduction !== 20) {
        reform['gov.usda.snap.income.deductions.earned_income'] = earnedDeduction / 100;
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

/** Option IDs for the per-dependent exemption reforms all end in this suffix
 *  (e.g. ``ri_dependent_exemption``). The dependent *credit* reforms (e.g.
 *  ``de_dependent_credit``) are deliberately excluded — the breakdown row is
 *  specifically the dependent exemption. */
const DEPENDENT_EXEMPTION_ID_SUFFIX = '_dependent_exemption';

/** Build the isolated dependent-exemption-only sub-reform from a set of
 *  selected option IDs, used so the backend can attribute the dependent
 *  exemption's portion of the state income-tax change on its own. Returns
 *  ``null`` when no dependent-exemption option is selected (or it builds to an
 *  empty dict, e.g. an edit that matches current law). */
export function buildDependentExemptionSubReform(
  reformOptionIds: string[],
  parameterValues: ParameterValues | undefined,
  year: number,
): ReformDict | null {
  const depIds = reformOptionIds.filter((id) =>
    id.endsWith(DEPENDENT_EXEMPTION_ID_SUFFIX),
  );
  if (depIds.length === 0) return null;
  const dep = buildReformDict(depIds, parameterValues, year);
  return Object.keys(dep).length > 0 ? dep : null;
}
