/** Dump every state's wizard display — the Current Programs summary and
 *  every reform option card with its labels, defaults, and descriptions —
 *  into one markdown doc for the state-by-state pre-launch review.
 *
 *  Run: npm run state-options   (writes docs/state-options-audit.md)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  allStateCodes,
  getStateProgramsSummary,
  getReformOptionsForState,
  eitcStructured,
  eitcIsAdjustmentFactor,
} from '../lib/state-programs';

const YEAR = 2026;
const lines: string[] = [
  '# State-by-state wizard display audit',
  '',
  `Generated from the option registries at analysis year ${YEAR}. Each`,
  'section shows exactly what the wizard presents for that state: the',
  'Current Programs summary line(s), then every option card with its',
  'adjustable parameters (label, current-law default, range, unit) and',
  'descriptions. Review order: summary accuracy first, then card names,',
  'then parameter defaults vs the actual statute.',
  '',
];

const pct = (v: number | undefined) =>
  v == null ? '?' : `${(v * 100).toFixed(0)}%`;

for (const code of allStateCodes().sort()) {
  const s = getStateProgramsSummary(code);
  const o = getReformOptionsForState(code, YEAR);
  if (!s || !o) continue;
  lines.push(`## ${s.state_name} (${code})`, '');
  lines.push(`**Income tax:** ${s.has_income_tax ? 'yes' : 'no'}`);

  // Current Programs panel, as displayed.
  const ctcLine = s.has_state_ctc
    ? `${s.ctc_name} - $${s.ctc_max_amount}`
    : `None${s.ctc_note ? ` (note: ${s.ctc_note})` : ''}`;
  const eitcLine = s.has_state_eitc
    ? `${s.eitc_name}${
        eitcIsAdjustmentFactor(code)
          ? ` - own schedule, ${pct(s.eitc_match_rate)} adjustment factor`
          : eitcStructured(code)
          ? ' (structured; name only)'
          : ` - ${pct(s.eitc_match_rate)} match`
      }`
    : 'None';
  lines.push(`**Current Programs panel:**`);
  lines.push(`- State CTC: ${ctcLine}`);
  lines.push(`- State EITC: ${eitcLine}`);
  lines.push(`- CDCC: ${s.has_cdcc ? 'yes' : 'no'} | Dependent exemption: ${s.has_dependent_exemption ? 'yes' : 'no'}`);
  lines.push('');

  const groups: Array<[string, typeof o.ctc_options]> = [
    ['State CTC options', o.ctc_options],
    ['State EITC options', o.eitc_options],
    ['Dependent exemption options', o.dependent_exemption_options],
    ['Grocery credit options', o.grocery_credit_options ?? []],
  ];
  for (const [title, opts] of groups) {
    if (!opts?.length) continue;
    lines.push(`**${title}:**`);
    for (const opt of opts) {
      const flags = [
        (opt as { creates_program?: boolean }).creates_program ? 'CREATES PROGRAM' : '',
        (opt as { in_development?: boolean }).in_development ? 'IN DEVELOPMENT (greyed)' : '',
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`- **${opt.name}**${flags ? ` [${flags}]` : ''}`);
      if (opt.description) lines.push(`  - _${opt.description}_`);
      for (const p of opt.adjustable_params ?? []) {
        const dep = (p as { depends_on?: string }).depends_on;
        lines.push(
          `  - ${p.label} (${p.name}): default ${p.default_value}${p.unit || ''}, range ${p.min_value}-${p.max_value}${p.unit || ''}${dep ? `, shown when ${dep}` : ''}`,
        );
        if (p.description) lines.push(`    - _${p.description}_`);
      }
    }
    lines.push('');
  }
}

const out = path.join(__dirname, '..', '..', 'docs', 'state-options-audit.md');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`wrote ${out} (${lines.length} lines, ${allStateCodes().length} states)`);
