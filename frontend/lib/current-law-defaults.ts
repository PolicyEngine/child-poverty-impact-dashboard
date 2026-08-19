/**
 * Year-aware current-law defaults, generated from the pinned
 * policyengine-us (``scripts/generate_current_law_defaults.py`` →
 * ``data/current-law-defaults.json``; regenerate after every pin bump).
 *
 * The 2026-08-19 default-anchor audit found ~30 editor defaults stale for
 * 2026 and more for 2027/2028 (uprated parameters vs static TS constants),
 * plus multi-path params (one slider writing several filing-status/joint
 * schedules) collapsing statutory structure to a single value. These
 * helpers fix both:
 *
 * - ``currentLawDefault``: the display + no-op default for (option, param)
 *   at the analysis year, falling back to the hardcoded registry value
 *   when the generated map has no entry (contrib proposal levers, params
 *   the anchors dump can't see).
 * - ``emitAnchoredParams``: the shared "emit only what changed" loop used
 *   by the CTC / structured-EITC / UT-GA-ID builders. Single-path params
 *   emit the user's absolute value; multi-path params emit each path's
 *   OWN statutory value shifted by the user's delta (offset-preserving:
 *   CO's joint thresholds stay single+$10k, ME's per-status phase-out
 *   starts keep their spread) instead of collapsing every path to one
 *   number.
 *
 * ``tests/calculations/test_default_anchors.py`` fails whenever the
 * generated file drifts from the pinned engine, so staleness can't return
 * silently.
 */

import rawDefaults from '@/data/current-law-defaults.json';

interface ClawEntry {
  ui_default: Record<string, number>;
  paths: Record<string, Record<string, number>>;
}

const MAP = rawDefaults as unknown as Record<string, ClawEntry>;

/** Year-aware UI default for (option, param); ``fallback`` when unmapped. */
export function currentLawDefault(
  optionId: string,
  param: string,
  year: number,
  fallback: number,
): number {
  return MAP[`${optionId}.${param}`]?.ui_default?.[String(year)] ?? fallback;
}

/** Engine value of one emitted path at the analysis year, or null. */
export function currentLawPathValue(
  optionId: string,
  param: string,
  path: string,
  year: number,
): number | null {
  return MAP[`${optionId}.${param}`]?.paths?.[path]?.[String(year)] ?? null;
}

/** Minimal param shape shared by the CTC / structured-EITC registries. */
export interface AnchoredParam {
  name: string;
  default_value: number;
  divide_by?: number;
  path?: string;
  paths?: string[];
}

/** Shared "emit only what changed" loop, anchored to the analysis year.
 *
 *  For each param: nothing is emitted when the user left it at the
 *  year-aware default. When edited, a single-path param emits the user's
 *  absolute (transformed) value; a multi-path param emits each path's own
 *  statutory value shifted by the user's delta, so one slider can't
 *  flatten a filing-status schedule.
 */
export function emitAnchoredParams(
  optionId: string,
  params: readonly AnchoredParam[],
  paramValues: Record<string, number> | undefined,
  year: number,
  skip?: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of params) {
    if (skip?.has(p.name)) continue;
    const ui = paramValues?.[p.name];
    const dflt = currentLawDefault(optionId, p.name, year, p.default_value);
    if (ui === undefined || ui === dflt) continue; // unchanged
    const k = p.divide_by ?? 1;
    const paths = p.paths ?? [p.path!];
    if (paths.length === 1) {
      out[paths[0]] = ui / k;
      continue;
    }
    // The first path is the one the UI value denominates (the label's
    // filing status / schedule): it gets the user's exact value. Sibling
    // paths keep their statutory spread by shifting the same delta.
    const delta = (ui - dflt) / k;
    out[paths[0]] = ui / k;
    for (const path of paths.slice(1)) {
      const law = currentLawPathValue(optionId, p.name, path, year);
      out[path] = law !== null ? law + delta : ui / k;
    }
  }
  return out;
}
