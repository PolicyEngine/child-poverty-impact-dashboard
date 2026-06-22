/**
 * Generate the reform coverage manifest consumed by the Python compute test
 * (``tests/calculations/test_reform_computes.py``).
 *
 * Walks every selectable (state, option) via the shared helpers in
 * ``lib/reform-coverage`` and emits the exact flat reform dict the frontend
 * would POST to Modal, so the Python side can run each through pinned
 * policyengine-us and prove it computes.
 *
 * Run from the ``frontend`` directory (``npm run manifest``). tsx resolves
 * the ``@/*`` tsconfig path alias used by the data imports.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, COVERAGE_YEAR } from '../lib/reform-coverage';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '__generated__');
const outFile = path.join(outDir, 'reform-manifest.json');

const entries = buildManifest(COVERAGE_YEAR);

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify(
    { year: COVERAGE_YEAR, count: entries.length, entries },
    null,
    2,
  ) + '\n',
);

const byKind = entries.reduce<Record<string, number>>((acc, e) => {
  acc[e.kind] = (acc[e.kind] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `Wrote ${entries.length} reform entries to ${path.relative(process.cwd(), outFile)} ` +
    `(${Object.entries(byKind)
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ')})`,
);
