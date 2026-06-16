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

  it('throws on an unknown / unwired reform option', () => {
    expect(() => buildReformDict(['snap_increase_15'], undefined, 2026)).toThrow(
      /Unknown or unwired/,
    );
  });
});
