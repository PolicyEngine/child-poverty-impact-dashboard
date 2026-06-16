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

import { buildStateEitcReform } from './state-programs';

export type ReformDictValue =
  | number
  | boolean
  | Record<string, number | boolean>;
export type ReformDict = Record<string, ReformDictValue>;

type ParameterValues = Record<string, Record<string, number>>;

// Child-allowance / baby-bonus defaults (annual $ per child). The
// ubi_center basic-income amounts are annual (period: year), matching the
// 2021 expanded-CTC tiers of $3,600 / $3,000.
export const CHILD_ALLOWANCE_DEFAULT_YOUNG = 3600;
export const CHILD_ALLOWANCE_DEFAULT_OLDER = 3000;
export const BABY_BONUS_DEFAULT = 2000;

// ubi_center basic income, age-bracketed schedule. Bracket [0] covers
// ages 0–5, [1] covers 6–17, [2] 18–24, [3] 25–64, [4] 65+. We only ever
// touch the two child brackets.
const BI = 'gov.contrib.ubi_center.basic_income.amount.person.by_age';

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
    case 'child_allowance': {
      // Two-tier unconditional child allowance via ubi_center basic income.
      const young =
        parameterValues?.['child_allowance']?.young_child_amount ??
        CHILD_ALLOWANCE_DEFAULT_YOUNG;
      const older =
        parameterValues?.['child_allowance']?.older_child_amount ??
        CHILD_ALLOWANCE_DEFAULT_OLDER;
      reform[`${BI}[0].amount`] = young; // ages 0–5
      reform[`${BI}[1].amount`] = older; // ages 6–17
      return;
    }
    case 'baby_bonus': {
      // Same mechanism, but only children under 1. Narrow the young-child
      // bracket boundary from age 6 down to age 1 so bracket [0] covers
      // only age 0; the [1] (now age 1–17) amount stays at its $0 default.
      const amount =
        parameterValues?.['baby_bonus']?.amount ?? BABY_BONUS_DEFAULT;
      reform[`${BI}[1].threshold`] = 1;
      reform[`${BI}[0].amount`] = amount;
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
