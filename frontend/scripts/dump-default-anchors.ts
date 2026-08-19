/**
 * Generate the default-anchor manifest consumed by the current-law audit
 * (``tests/calculations/test_default_anchors.py``).
 *
 * The dashboard's "no-op contract" (an untouched slider emits nothing) means
 * a stale ``default_value`` doesn't corrupt untouched runs — but it DOES lie
 * to the user about current law and mis-anchors every edit (the NJ CTC
 * pre-increase tiers, RI's $5,200-vs-$5,250 exemption). This dump recovers,
 * for every adjustable numeric param, the engine-facing value the default
 * corresponds to, so the Python side can compare it against the pinned
 * policyengine-us at 2026/2027/2028.
 *
 * Method: ``buildReformDict`` emits only changed values, and the param→path
 * transform is linear (identity, /100 for percents, bracket writes). So for
 * each param we build twice — default+step and default+2·step — and
 * extrapolate back: ``transform(default) = 2·v1 − v2`` per emitted path.
 * Params that can't take two upward steps use two downward steps instead
 * (``transform(default) = 2·v1 − v2`` with v at −step/−2·step mirrored).
 * Toggles are skipped (no current-law anchor). Paths that appear only when a
 * toggle flips are exercised with all the option's OTHER params at defaults,
 * so extra emitted paths (contrib in_effect switches) are dropped as
 * non-numeric or non-linear artifacts when extrapolation disagrees between
 * probes.
 *
 * Run from ``frontend``: ``npm run anchors``.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allStateCodes,
  getReformOptionsForState,
} from '../lib/state-programs';
import { selectableOptions, COVERAGE_YEAR } from '../lib/reform-coverage';
import { buildReformDict } from '../lib/reforms';

interface AnchorRow {
  state: string;
  option_id: string;
  param: string;
  label: string;
  year: number;
  /** UI-facing default (what the selector displays as current law). */
  default_ui: number;
  step: number;
  /** Engine-facing value the default corresponds to, per extrapolation. */
  path: string;
  default_engine: number;
}

/** The report wizard offers 2026–2028 (see app/report/ReportClient.tsx), so
 *  defaults must anchor to current law in each of those years. */
const AUDIT_YEARS = [COVERAGE_YEAR, 2027, 2028];

const rows: AnchorRow[] = [];
const skipped: { option_id: string; param: string; reason: string }[] = [];

for (const year of AUDIT_YEARS) {
  for (const state of allStateCodes()) {
    const opts = getReformOptionsForState(state, year);
    for (const option of selectableOptions(opts)) {
      const params = option.adjustable_params ?? [];
      for (const p of params) {
        if (p.control === 'toggle') continue;

        // Two probe points along the param's axis, keeping every other param
        // at its default so only this param's paths are emitted.
        const canUp = p.default_value + 2 * p.step <= p.max_value;
        const canDown = p.default_value - 2 * p.step >= p.min_value;
        if (!canUp && !canDown) {
          if (year === COVERAGE_YEAR) {
            skipped.push({
              option_id: option.id,
              param: p.name,
              reason: 'range too narrow for two probe steps',
            });
          }
          continue;
        }
        const dir = canUp ? 1 : -1;
        const probe = (k: number) => {
          const values = {
            [option.id]: Object.fromEntries(
              params.map((q) => [
                q.name,
                q.name === p.name
                  ? p.default_value + dir * k * p.step
                  : q.default_value,
              ]),
            ),
          };
          return buildReformDict([option.id], values, year);
        };
        const r1 = probe(1);
        const r2 = probe(2);

        for (const [paramPath, v1raw] of Object.entries(r1)) {
          const v2raw = r2[paramPath];
          if (typeof v1raw !== 'number' || typeof v2raw !== 'number') continue;
          // Constant across both probes → an on-switch or side-effect path
          // (e.g. contrib in_effect), not this param's value channel.
          if (v1raw === v2raw) continue;
          rows.push({
            state,
            option_id: option.id,
            param: p.name,
            label: p.label,
            year,
            default_ui: p.default_value,
            step: p.step,
            path: paramPath,
            default_engine: 2 * v1raw - v2raw,
          });
        }
      }
    }
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '__generated__');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'default-anchors.json');
writeFileSync(
  outFile,
  JSON.stringify(
    { years: AUDIT_YEARS, count: rows.length, rows, skipped },
    null,
    2,
  ) + '\n',
);
console.log(
  `Wrote ${rows.length} default anchors (${skipped.length} skipped) to ` +
    path.relative(process.cwd(), outFile),
);
