import { describe, it, expect } from 'vitest';
import { buildReformDict } from '@/lib/reforms';

const BI = 'gov.contrib.ubi_center.basic_income.amount.person.by_age';
const PO = 'gov.contrib.ubi_center.basic_income.phase_out';

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

  it('wires a three-tier child allowance with defaults (cutoff 18)', () => {
    const reform = buildReformDict(['child_allowance'], undefined, 2026);
    // Brackets re-cut to 0 / 1 / 6 / cutoff.
    expect(reform[`${BI}[1].threshold`]).toBe(1);
    expect(reform[`${BI}[2].threshold`]).toBe(6);
    expect(reform[`${BI}[3].threshold`]).toBe(18);
    // Tier amounts.
    expect(reform[`${BI}[0].amount`]).toBe(3600); // under 1
    expect(reform[`${BI}[1].amount`]).toBe(3000); // ages 1–5
    expect(reform[`${BI}[2].amount`]).toBe(3000); // ages 6 to cutoff
  });

  it('respects custom per-tier amounts and the under-19 cutoff', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      {
        child_allowance: {
          infant_amount: 5000,
          young_child_amount: 4000,
          older_child_amount: 1000,
          cutoff_age: 19,
        },
      },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(5000);
    expect(reform[`${BI}[1].amount`]).toBe(4000);
    expect(reform[`${BI}[2].amount`]).toBe(1000);
    expect(reform[`${BI}[3].threshold`]).toBe(19); // children under 19
  });

  it('omits the phase-out unless explicitly enabled', () => {
    const reform = buildReformDict(['child_allowance'], undefined, 2026);
    expect(reform[`${PO}.rate`]).toBeUndefined();
    expect(reform[`${PO}.threshold.SINGLE`]).toBeUndefined();
  });

  it('applies an AGI phase-out with defaults when enabled', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      { child_allowance: { phaseout_enabled: 1 } },
      2026,
    );
    expect(reform[`${PO}.by_rate`]).toBe(true);
    expect(reform[`${PO}.rate`]).toBeCloseTo(0.05); // 5% -> /1
    expect(reform[`${PO}.threshold.SINGLE`]).toBe(100000);
    expect(reform[`${PO}.threshold.HEAD_OF_HOUSEHOLD`]).toBe(100000);
    expect(reform[`${PO}.threshold.SEPARATE`]).toBe(100000);
    expect(reform[`${PO}.threshold.JOINT`]).toBe(200000);
    expect(reform[`${PO}.threshold.SURVIVING_SPOUSE`]).toBe(200000);
  });

  it('respects custom phase-out rate and per-status thresholds', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      {
        child_allowance: {
          phaseout_enabled: 1,
          phaseout_rate: 10,
          phaseout_threshold_single: 75000,
          phaseout_threshold_joint: 150000,
        },
      },
      2026,
    );
    expect(reform[`${PO}.rate`]).toBeCloseTo(0.1);
    expect(reform[`${PO}.threshold.SINGLE`]).toBe(75000);
    expect(reform[`${PO}.threshold.JOINT`]).toBe(150000);
  });

  it('supports a flat allowance via three equal amounts', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      {
        child_allowance: {
          infant_amount: 1000,
          young_child_amount: 1000,
          older_child_amount: 1000,
        },
      },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(1000);
    expect(reform[`${BI}[1].amount`]).toBe(1000);
    expect(reform[`${BI}[2].amount`]).toBe(1000);
  });

  it('emits a changed state-CTC amount and nothing else', () => {
    const reform = buildReformDict(
      ['dc_ctc'],
      { dc_ctc: { amount: 2000 } },
      2026,
    );
    expect(reform['gov.states.dc.tax.income.credits.ctc.amount']).toBe(2000);
    // Unchanged thresholds are NOT emitted (no-op preserves baseline).
    expect(
      reform['gov.states.dc.tax.income.credits.ctc.income_threshold.SINGLE'],
    ).toBeUndefined();
  });

  it('converts a state-CTC percentage rate to a /1 value', () => {
    const reform = buildReformDict(['il_ctc'], { il_ctc: { rate: 60 } }, 2026);
    expect(reform['gov.states.il.tax.income.credits.ctc.rate']).toBeCloseTo(0.6);
  });

  it('produces an empty reform when a state CTC is selected but unchanged', () => {
    expect(buildReformDict(['vt_ctc'], undefined, 2026)).toEqual({});
    expect(
      buildReformDict(['vt_ctc'], { vt_ctc: { amount: 1000 } }, 2026),
    ).toEqual({}); // 1000 == current-law default -> no-op
  });

  it('sets all five filing-status paths for a Colorado bracket tier', () => {
    const reform = buildReformDict(['co_ctc'], { co_ctc: { tier1: 2000 } }, 2026);
    for (const s of ['single', 'joint', 'head_of_household', 'separate', 'surviving_spouse']) {
      expect(reform[`gov.states.co.tax.income.credits.ctc.amount.${s}[0].amount`]).toBe(2000);
    }
  });

  it('sets a bracket-indexed amount for New Mexico', () => {
    const reform = buildReformDict(['nm_ctc'], { nm_ctc: { tier1: 1000 } }, 2026);
    expect(reform['gov.states.nm.tax.income.credits.ctc.amount[0].amount']).toBe(1000);
  });

  it('NY 2026: emits only a changed post-2024 amount', () => {
    const reform = buildReformDict(['ny_ctc'], { ny_ctc: { young_amount: 2000 } }, 2026);
    expect(reform['gov.states.ny.tax.income.credits.ctc.post_2024.amount[0].amount']).toBe(2000);
    expect(reform['gov.states.ny.tax.income.credits.ctc.post_2024.in_effect']).toBeUndefined();
  });

  it('NY 2028 without extend is a no-op (reverts to the regular credit)', () => {
    expect(buildReformDict(['ny_ctc'], { ny_ctc: { young_amount: 2000 } }, 2028)).toEqual({});
  });

  it('NY 2028 with extend restores the full post-2024 block', () => {
    const reform = buildReformDict(['ny_ctc'], { ny_ctc: { extend: 1 } }, 2028);
    const P = 'gov.states.ny.tax.income.credits.ctc.post_2024';
    expect(reform[`${P}.in_effect`]).toBe(true);
    expect(reform[`${P}.amount[0].amount`]).toBe(1000);
    expect(reform[`${P}.amount[1].amount`]).toBe(500);
    expect(reform[`${P}.phase_out.threshold.HEAD_OF_HOUSEHOLD`]).toBe(75000);
    expect(reform[`${P}.phase_out.rate`]).toBe(16.5);
  });

  it('activates the American Family Act via its contrib flag', () => {
    const reform = buildReformDict(['federal_afa'], undefined, 2026);
    expect(reform['gov.contrib.congress.afa.in_effect']).toBe(true);
  });

  it('NY 2028 without extend edits the regular (old-format) credit', () => {
    const reform = buildReformDict(
      ['ny_ctc'],
      { ny_ctc: { percent: 50, minimum: 200 } },
      2028,
    );
    expect(reform['gov.states.ny.tax.income.credits.ctc.amount.percent']).toBeCloseTo(0.5);
    expect(reform['gov.states.ny.tax.income.credits.ctc.amount.minimum']).toBe(200);
    // The age-based post-2024 block is NOT touched when not extending.
    expect(reform['gov.states.ny.tax.income.credits.ctc.post_2024.in_effect']).toBeUndefined();
  });

  it('throws on an unknown / unwired reform option', () => {
    expect(() => buildReformDict(['snap_increase_15'], undefined, 2026)).toThrow(
      /Unknown or unwired/,
    );
  });
});
