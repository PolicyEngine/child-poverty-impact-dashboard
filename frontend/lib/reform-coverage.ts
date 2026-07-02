/**
 * Shared enumeration of every selectable reform option, used by both the
 * vitest coverage sweep (``__tests__/reform-coverage.test.ts``) and the
 * manifest exporter (``scripts/dump-reform-manifest.ts``) so the two can't
 * drift.
 *
 * The dashboard's promise is that whatever a user selects in a state, they
 * reach the impact page with a real result. These helpers walk every
 * ``(state, option)`` the UI exposes, build the reform dict the frontend
 * would send to Modal, and let the consumers assert it builds (TS) and
 * computes against pinned policyengine-us (Python, via the manifest).
 *
 * ``in_development`` options are intentionally skipped: the selector greys
 * them out and never lets them reach ``buildReformDict``.
 */

import {
  allStateCodes,
  getReformOptionsForState,
  type ReformOption,
  type StateReformOptions,
} from './state-programs';
import { buildReformDict, type ReformDict } from './reforms';

/** The dashboard's default analysis year. Keep in sync with the report
 *  wizard's default and the Modal endpoint. */
export const COVERAGE_YEAR = 2026;

export type ParamValues = Record<string, Record<string, number>>;

/** The six option categories a state exposes, in selector order. */
export function optionsByCategory(opts: StateReformOptions): ReformOption[][] {
  return [
    opts.ctc_options,
    opts.eitc_options,
    opts.dependent_exemption_options,
    opts.grocery_credit_options,
    opts.snap_options,
    opts.child_allowance_options,
    opts.federal_options,
  ];
}

/** Every option a user could actually select for a state (skips greyed-out
 *  ``in_development`` placeholders). */
export function selectableOptions(opts: StateReformOptions): ReformOption[] {
  return optionsByCategory(opts)
    .flat()
    .filter((o) => !o.in_development);
}

/** Reproduce the selector's initial parameter state for an option: every
 *  adjustable param at its ``default_value``. Returns ``{}`` for options
 *  with no adjustable params (the builders then use their own fallbacks). */
export function defaultParamValues(option: ReformOption): ParamValues {
  const params = option.adjustable_params ?? [];
  if (params.length === 0) return {};
  return {
    [option.id]: Object.fromEntries(
      params.map((p) => [p.name, p.default_value]),
    ),
  };
}

/** A non-default value for every adjustable param, to exercise the
 *  "user moved a slider / flipped a toggle" path: toggles flip, numbers
 *  step toward the nearer bound. */
export function editedParamValues(option: ReformOption): ParamValues {
  const params = option.adjustable_params ?? [];
  if (params.length === 0) return {};
  return {
    [option.id]: Object.fromEntries(
      params.map((p) => {
        let v: number;
        if (p.control === 'toggle') {
          v = p.default_value ? 0 : 1;
        } else if (p.default_value < p.max_value) {
          v = Math.min(p.max_value, p.default_value + p.step);
        } else {
          v = Math.max(p.min_value, p.default_value - p.step);
        }
        return [p.name, v];
      }),
    ),
  };
}

/** Pick one selectable option from each category, then resolve mutual
 *  exclusivity (drop a later pick that conflicts with one already kept, in
 *  either direction). Models a user who turns on something everywhere at
 *  once — the realistic "lots selected" case. */
export function comboOptionsForState(opts: StateReformOptions): ReformOption[] {
  const oneEach: ReformOption[] = [];
  for (const category of optionsByCategory(opts)) {
    const pick = category.find((o) => !o.in_development);
    if (pick) oneEach.push(pick);
  }
  const kept: ReformOption[] = [];
  for (const o of oneEach) {
    const conflict = kept.some(
      (k) =>
        (k.exclusive_with ?? []).includes(o.id) ||
        (o.exclusive_with ?? []).includes(k.id),
    );
    if (!conflict) kept.push(o);
  }
  return kept;
}

/** Merge several options' default param values into one ParamValues map. */
export function mergedDefaultParamValues(
  options: ReformOption[],
): ParamValues {
  const out: ParamValues = {};
  for (const o of options) Object.assign(out, defaultParamValues(o));
  return out;
}

export type ManifestKind = 'single' | 'single-edited' | 'combo';

export interface ManifestEntry {
  state: string;
  kind: ManifestKind;
  ids: string[];
  year: number;
  reform: ReformDict;
}

/** Build the full coverage manifest: every option singly (at default and,
 *  if configurable, at an edited value) plus the per-state all-categories
 *  combo. Deduplicated by ``(state, ids, reform)`` — one entry per
 *  ``(state, option)`` — so national reforms (SNAP, the child allowance,
 *  federal switches) whose dict is identical across states are still scored
 *  in every state. That gives the cost sweep "each reform in every state";
 *  the exhaustive compute test re-dedupes by reform dict so per-PR CI stays
 *  flat (an identical dict computes identically regardless of state tag). */
export function buildManifest(year: number = COVERAGE_YEAR): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (const state of allStateCodes()) {
    const opts = getReformOptionsForState(state, year);

    for (const option of selectableOptions(opts)) {
      entries.push({
        state,
        kind: 'single',
        ids: [option.id],
        year,
        reform: buildReformDict([option.id], defaultParamValues(option), year),
      });
      if ((option.adjustable_params?.length ?? 0) > 0) {
        entries.push({
          state,
          kind: 'single-edited',
          ids: [option.id],
          year,
          reform: buildReformDict(
            [option.id],
            editedParamValues(option),
            year,
          ),
        });
      }
    }

    const combo = comboOptionsForState(opts);
    if (combo.length > 1) {
      const ids = combo.map((o) => o.id);
      entries.push({
        state,
        kind: 'combo',
        ids,
        year,
        reform: buildReformDict(ids, mergedDefaultParamValues(combo), year),
      });
    }
  }

  const seen = new Set<string>();
  const deduped: ManifestEntry[] = [];
  for (const e of entries) {
    const key = JSON.stringify([e.state, e.ids, e.reform]);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return deduped;
}
