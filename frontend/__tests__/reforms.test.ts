import { describe, it, expect } from 'vitest';
import { buildReformDict } from '@/lib/reforms';

const BI = 'gov.contrib.ubi_center.basic_income.amount.person.by_age';

describe('buildReformDict', () => {
  it('returns an empty dict when nothing is selected', () => {
    expect(buildReformDict([], undefined, 2026)).toEqual({});
  });

  it('restores the 2021 expanded CTC via the ARPA structure', () => {
    const reform = buildReformDict(['federal_ctc_expanded'], undefined, 2026);
    expect(reform['gov.irs.credits.ctc.amount.arpa[0].amount']).toBe(3600);
    expect(reform['gov.irs.credits.ctc.amount.arpa[1].amount']).toBe(3000);
    expect(reform['gov.irs.credits.ctc.refundable.fully_refundable']).toBe(true);
    expect(reform['gov.irs.credits.ctc.phase_out.arpa.in_effect']).toBe(true);
  });

  it('wires a two-tier child allowance with defaults', () => {
    const reform = buildReformDict(['child_allowance'], undefined, 2026);
    expect(reform[`${BI}[0].amount`]).toBe(3600); // ages 0–5
    expect(reform[`${BI}[1].amount`]).toBe(3000); // ages 6–17
  });

  it('respects custom child-allowance amounts', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      { child_allowance: { young_child_amount: 5000, older_child_amount: 4000 } },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(5000);
    expect(reform[`${BI}[1].amount`]).toBe(4000);
  });

  it('limits the baby bonus to children under 1', () => {
    const reform = buildReformDict(
      ['baby_bonus'],
      { baby_bonus: { amount: 2500 } },
      2026,
    );
    // Narrow the young-child bracket boundary to age 1 so only age 0 is paid.
    expect(reform[`${BI}[1].threshold`]).toBe(1);
    expect(reform[`${BI}[0].amount`]).toBe(2500);
  });

  it('throws on an unknown / unwired reform option', () => {
    expect(() => buildReformDict(['snap_increase_15'], undefined, 2026)).toThrow(
      /Unknown or unwired/,
    );
  });
});
