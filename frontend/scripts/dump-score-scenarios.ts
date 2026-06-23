/**
 * Emit a representative set of reform-option SCORING scenarios for the
 * reform-scorecard harness (analysis/reform_scores/score_reforms.py).
 *
 * Unlike the coverage manifest (dump-reform-manifest.ts), which nudges params
 * by one step to test that every option *builds*, these scenarios use a
 * *meaningful* configuration so the PolicyEngine API returns a non-trivial
 * impact we can validate (cost / poverty / distribution).
 *
 * Each scenario carries:
 *   - jurisdiction: { country: 'us', state?: '<code>' } → API `region`
 *   - direction:    'expansion' (cost↑, poverty↓) | 'repeal' (revenue↑, poverty↑)
 *                   so the scorer knows the expected sign.
 *   - reform:       the flat reform-dict from buildReformDict.
 *
 * Run from frontend/: `npm run score-scenarios`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReformDict, type ReformDict } from '../lib/reforms';

const YEAR = 2026;

interface ScenarioDef {
  id: string;
  label: string;
  state?: string; // omit for federal (region = 'us')
  direction: 'expansion' | 'repeal';
  optionId: string;
  params?: Record<string, Record<string, number>>;
  year?: number;
}

const DEFS: ScenarioDef[] = [
  { id: 'federal_ctc_expanded', label: 'Restore the 2021 (ARPA) expanded CTC', direction: 'expansion', optionId: 'federal_ctc_expanded' },
  { id: 'child_allowance_3000', label: 'Child allowance, $3,000/child under 18', direction: 'expansion', optionId: 'child_allowance', params: { child_allowance: { infant_amount: 3000, young_child_amount: 3000, older_child_amount: 3000, cutoff_age: 18 } } },
  { id: 'federal_afa', label: 'American Family Act CTC', direction: 'expansion', optionId: 'federal_afa' },
  { id: 'federal_tax_cuts_for_workers', label: 'Tax Cuts for Workers (childless EITC expansion)', direction: 'expansion', optionId: 'federal_tax_cuts_for_workers' },
  { id: 'federal_working_parents_tax_relief', label: 'Working Parents Tax Relief Act', direction: 'expansion', optionId: 'federal_working_parents_tax_relief' },
  { id: 'ca_ctc_2000', label: 'California Young Child Tax Credit raised to $2,000', state: 'ca', direction: 'expansion', optionId: 'ca_ctc', params: { ca_ctc: { amount: 2000 } } },
  { id: 'ny_ctc_2000', label: 'New York Empire State Child Credit young amount $2,000', state: 'ny', direction: 'expansion', optionId: 'ny_ctc', params: { ny_ctc: { young_amount: 2000 } } },
  { id: 'ca_eitc_100', label: 'California EITC raised to 100% of federal', state: 'ca', direction: 'expansion', optionId: 'ca_eitc', params: { ca_eitc: { match_rate: 100 } } },
  { id: 'mn_eitc_additional', label: 'Minnesota WFC additional amount (2 children) +$3,000', state: 'mn', direction: 'expansion', optionId: 'mn_eitc', params: { mn_eitc: { additional_2_children: 3000 } } },
  { id: 'ny_dependent_exemption_eliminate', label: 'Eliminate the New York dependent exemption', state: 'ny', direction: 'repeal', optionId: 'ny_dependent_exemption', params: { ny_dependent_exemption: { eliminate: 1 } } },
];

const scenarios = DEFS.map((d) => {
  const year = d.year ?? YEAR;
  const reform: ReformDict = buildReformDict([d.optionId], d.params, year);
  return {
    id: d.id,
    label: d.label,
    jurisdiction: { country: 'us', ...(d.state ? { state: d.state } : {}) },
    region: d.state ?? 'us',
    direction: d.direction,
    year,
    option_id: d.optionId,
    params: d.params ?? null,
    reform,
    reform_param_count: Object.keys(reform).length,
  };
});

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'analysis', 'reform_scores');
const outFile = path.join(outDir, 'score-scenarios.json');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ year: YEAR, count: scenarios.length, scenarios }, null, 2) + '\n',
);

const empties = scenarios.filter((s) => s.reform_param_count === 0).map((s) => s.id);
console.log(
  `Wrote ${scenarios.length} scoring scenarios to ${path.relative(process.cwd(), outFile)}` +
    (empties.length ? `\nWARNING: empty (no-op) reform dicts: ${empties.join(', ')}` : ''),
);
