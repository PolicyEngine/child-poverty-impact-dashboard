import { describe, it, expect } from 'vitest';
import {
  buildReformDict,
  buildDependentExemptionSubReform,
} from '@/lib/reforms';

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

  it('wires a four-tier child allowance with defaults (cutoff 18)', () => {
    const reform = buildReformDict(['child_allowance'], undefined, 2026);
    // Brackets re-cut to 0 / 1 / 4 / 6 / cutoff.
    expect(reform[`${BI}[1].threshold`]).toBe(1);
    expect(reform[`${BI}[2].threshold`]).toBe(4);
    expect(reform[`${BI}[3].threshold`]).toBe(6);
    expect(reform[`${BI}[4].threshold`]).toBe(18);
    // Tier amounts default to $1,000 each.
    expect(reform[`${BI}[0].amount`]).toBe(1000); // under 1
    expect(reform[`${BI}[1].amount`]).toBe(1000); // ages 1–3
    expect(reform[`${BI}[2].amount`]).toBe(1000); // ages 4–5
    expect(reform[`${BI}[3].amount`]).toBe(1000); // ages 6 to cutoff
  });

  it('splits ages 1–5 into 1–3 and 4–5 tiers (the prenatal-to-3 band)', () => {
    // A prenatal-to-3 allowance: pay under-1 and ages 1–3, nothing for 4+.
    const reform = buildReformDict(
      ['child_allowance'],
      { child_allowance: { infant_amount: 3600, toddler_amount: 3600, preschool_amount: 0, older_child_amount: 0 } },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(3600); // under 1
    expect(reform[`${BI}[1].threshold`]).toBe(1);
    expect(reform[`${BI}[1].amount`]).toBe(3600); // ages 1–3
    expect(reform[`${BI}[2].threshold`]).toBe(4);
    expect(reform[`${BI}[2].amount`]).toBe(0); // ages 4–5 excluded
    expect(reform[`${BI}[3].amount`]).toBe(0); // ages 6+ excluded
  });

  it('respects custom per-tier amounts and the under-19 cutoff', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      {
        child_allowance: {
          infant_amount: 5000,
          toddler_amount: 4000,
          preschool_amount: 3000,
          older_child_amount: 1000,
          cutoff_age: 19,
        },
      },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(5000); // under 1
    expect(reform[`${BI}[1].amount`]).toBe(4000); // ages 1–3
    expect(reform[`${BI}[2].amount`]).toBe(3000); // ages 4–5
    expect(reform[`${BI}[3].amount`]).toBe(1000); // ages 6 to cutoff
    expect(reform[`${BI}[4].threshold`]).toBe(19); // children under 19
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

  it('supports a flat allowance via four equal amounts', () => {
    const reform = buildReformDict(
      ['child_allowance'],
      {
        child_allowance: {
          infant_amount: 1000,
          toddler_amount: 1000,
          preschool_amount: 1000,
          older_child_amount: 1000,
        },
      },
      2026,
    );
    expect(reform[`${BI}[0].amount`]).toBe(1000);
    expect(reform[`${BI}[1].amount`]).toBe(1000);
    expect(reform[`${BI}[2].amount`]).toBe(1000);
    expect(reform[`${BI}[3].amount`]).toBe(1000);
  });

  it('wires SNAP eligibility + generosity levers (no-op at current law)', () => {
    expect(buildReformDict(['snap_reform'], undefined, 2026)).toEqual({});
    const reform = buildReformDict(
      ['snap_reform'],
      {
        snap_reform: {
          gross_income_limit: 200,
          abolish_net_income_test: 1,
          min_benefit: 20,
          earned_income_deduction: 30,
        },
      },
      2026,
    );
    expect(reform['gov.usda.snap.income.limit.gross']).toBeCloseTo(2.0);
    expect(reform['gov.contrib.snap.abolish_net_income_test.in_effect']).toBe(true);
    expect(reform['gov.usda.snap.min_allotment.rate']).toBeCloseTo(0.2);
    expect(reform['gov.usda.snap.income.deductions.earned_income']).toBeCloseTo(0.3);
    // Unchanged levers (and an unset toggle) are not emitted.
    expect(
      buildReformDict(['snap_reform'], { snap_reform: { gross_income_limit: 130 } }, 2026),
    ).toEqual({});
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

  it('emits the Rhode Island CTC amount/age (no-op at current law)', () => {
    const reform = buildReformDict(['ri_ctc'], { ri_ctc: { amount: 500 } }, 2026);
    expect(reform['gov.states.ri.tax.income.credits.ctc.amount']).toBe(500);
    const aged = buildReformDict(['ri_ctc'], { ri_ctc: { age: 17 } }, 2026);
    expect(aged['gov.states.ri.tax.income.credits.ctc.age_limit']).toBe(17);
    // $330 / age 18 are the enacted (2027) defaults -> unchanged is a no-op.
    expect(
      buildReformDict(['ri_ctc'], { ri_ctc: { amount: 330, age: 18 } }, 2026),
    ).toEqual({});
  });

  it('sets all five filing-status paths for a Colorado bracket tier', () => {
    const reform = buildReformDict(['co_ctc'], { co_ctc: { tier1: 2000 } }, 2026);
    for (const s of ['single', 'joint', 'head_of_household', 'separate', 'surviving_spouse']) {
      expect(reform[`gov.states.co.tax.income.credits.ctc.amount.${s}[0].amount`]).toBe(2000);
    }
  });

  it('emits the Massachusetts child & family credit amount (no-op when unchanged)', () => {
    const reform = buildReformDict(['ma_ctc'], { ma_ctc: { amount: 600 } }, 2026);
    expect(reform['gov.states.ma.tax.income.credits.child_and_family.amount']).toBe(600);
    expect(buildReformDict(['ma_ctc'], { ma_ctc: { amount: 440 } }, 2026)).toEqual({});
  });

  it('emits the Massachusetts child age limit (no-op at the current limit of 13)', () => {
    const reform = buildReformDict(['ma_ctc'], { ma_ctc: { age: 14 } }, 2026);
    expect(reform['gov.states.ma.tax.income.credits.child_and_family.child_age_limit']).toBe(14);
    // The amount and the age limit are independent inputs.
    const both = buildReformDict(['ma_ctc'], { ma_ctc: { amount: 600, age: 14 } }, 2026);
    expect(both['gov.states.ma.tax.income.credits.child_and_family.amount']).toBe(600);
    expect(both['gov.states.ma.tax.income.credits.child_and_family.child_age_limit']).toBe(14);
    expect(buildReformDict(['ma_ctc'], { ma_ctc: { age: 13 } }, 2026)).toEqual({});
  });

  it('edits New Jersey CTC bracket amounts AND income thresholds independently', () => {
    const C = 'gov.states.nj.tax.income.credits.ctc.amount';
    // A tier amount (bracket index → [i].amount).
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { tier1: 1200 } }, 2026)[`${C}[0].amount`],
    ).toBe(1200);
    // The new top tier ($80k+) amount.
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { tier6: 100 } }, 2026)[`${C}[5].amount`],
    ).toBe(100);
    // An income threshold between tiers (bracket index → [i].threshold).
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { threshold2: 35000 } }, 2026)[`${C}[1].threshold`],
    ).toBe(35000);
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { threshold6: 90000 } }, 2026)[`${C}[5].threshold`],
    ).toBe(90000);
    // Amount and threshold together emit exactly those two params.
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { tier3: 700, threshold3: 45000 } }, 2026),
    ).toEqual({
      [`${C}[2].amount`]: 700,
      [`${C}[2].threshold`]: 45000,
    });
    // Unchanged values are a no-op.
    expect(
      buildReformDict(['nj_ctc'], { nj_ctc: { threshold2: 30000, tier1: 1000 } }, 2026),
    ).toEqual({});
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
    // Increment phase-out: $16.50 reduction per $1,000 AGI increment.
    expect(reform[`${P}.phase_out.rate`]).toBe(16.5);
    expect(reform[`${P}.phase_out.increment`]).toBe(1000);
  });

  it('wires Minnesota WFC phase-in rate (percent -> /1) via the structured EITC', () => {
    const reform = buildReformDict(['mn_eitc'], { mn_eitc: { phase_in_rate: 8 } }, 2026);
    expect(
      reform['gov.states.mn.tax.income.credits.cwfc.wfc.phase_in[0].rate'],
    ).toBeCloseTo(0.08);
  });

  it('sets a bracket-indexed Minnesota WFC additional amount', () => {
    const reform = buildReformDict(
      ['mn_eitc'],
      { mn_eitc: { additional_2_children: 3000 } },
      2026,
    );
    expect(
      reform['gov.states.mn.tax.income.credits.cwfc.wfc.additional.amount[2].amount'],
    ).toBe(3000);
  });

  it('is a no-op when the Minnesota WFC is selected but unchanged', () => {
    expect(buildReformDict(['mn_eitc'], undefined, 2026)).toEqual({});
    // 4% phase-in is current law -> no param emitted.
    expect(
      buildReformDict(['mn_eitc'], { mn_eitc: { phase_in_rate: 4 } }, 2026),
    ).toEqual({});
  });

  it('wires Washington WFTC per-child amounts (no income tax)', () => {
    const reform = buildReformDict(['wa_eitc'], { wa_eitc: { amount_1_child: 1000 } }, 2026);
    expect(
      reform['gov.states.wa.tax.income.credits.working_families_tax_credit.amount[1].amount'],
    ).toBe(1000);
  });

  it('wires Wisconsin EITC per-child-count match rates (percent -> /1)', () => {
    const reform = buildReformDict(
      ['wi_eitc'],
      { wi_eitc: { match_2_children: 20 } },
      2026,
    );
    expect(
      reform['gov.states.wi.tax.income.credits.earned_income.fraction[2].amount'],
    ).toBeCloseTo(0.2);
    // Unchanged brackets emit nothing.
    expect(
      reform['gov.states.wi.tax.income.credits.earned_income.fraction[1].amount'],
    ).toBeUndefined();
  });

  it('wires both Oregon EITC rates (young child / no young child)', () => {
    const reform = buildReformDict(
      ['or_eitc'],
      { or_eitc: { match_young_child: 15, match_no_young_child: 11 } },
      2026,
    );
    expect(
      reform['gov.states.or.tax.income.credits.eitc.match.has_young_child'],
    ).toBeCloseTo(0.15);
    expect(
      reform['gov.states.or.tax.income.credits.eitc.match.no_young_child'],
    ).toBeCloseTo(0.11);
  });

  it('is a no-op when WI/OR rates are left at current law', () => {
    expect(buildReformDict(['wi_eitc'], { wi_eitc: { match_3_children: 34 } }, 2026)).toEqual({});
    expect(buildReformDict(['or_eitc'], { or_eitc: { match_young_child: 12 } }, 2026)).toEqual({});
  });

  it('makes a nonrefundable EITC refundable only when the checkbox is set', () => {
    const IN_EFFECT =
      'gov.contrib.states.mo.child_poverty_impact_dashboard.eitc.in_effect';
    const MATCH = 'gov.states.mo.tax.income.credits.wftc.match';
    // Checkbox on + slider moved: flip the contrib flag AND set the match.
    const refundable = buildReformDict(
      ['mo_eitc'],
      { mo_eitc: { make_refundable: 1, match_rate: 25 } },
      2026,
    );
    expect(refundable[IN_EFFECT]).toBe(true);
    expect(refundable[MATCH]).toBeCloseTo(0.25);
    // Checkbox off: adjust the (still nonrefundable) match, no contrib flag.
    const stillNonrefundable = buildReformDict(
      ['mo_eitc'],
      { mo_eitc: { match_rate: 25 } },
      2026,
    );
    expect(stillNonrefundable[IN_EFFECT]).toBeUndefined();
    expect(stillNonrefundable[MATCH]).toBeCloseTo(0.25);
  });

  it('adjusts the SC EITC cap and leaves the match at current law', () => {
    const reform = buildReformDict(['sc_eitc'], { sc_eitc: { eitc_cap: 1000 } }, 2026);
    expect(reform['gov.states.sc.tax.income.credits.eitc.max']).toBe(1000);
    expect(reform['gov.states.sc.tax.income.credits.eitc.rate']).toBeCloseTo(1.25);
  });

  it('eliminates the SC EITC cap (raises it to $1B), overriding any amount', () => {
    const reform = buildReformDict(
      ['sc_eitc'],
      { sc_eitc: { eliminate_cap: 1, eitc_cap: 1000 } },
      2026,
    );
    expect(reform['gov.states.sc.tax.income.credits.eitc.max']).toBe(1_000_000_000);
  });

  it('does not touch the SC cap when neither cap control is used', () => {
    const reform = buildReformDict(['sc_eitc'], undefined, 2026);
    expect(reform['gov.states.sc.tax.income.credits.eitc.max']).toBeUndefined();
  });

  it('activates the American Family Act via its contrib flag', () => {
    const reform = buildReformDict(['federal_afa'], undefined, 2026);
    expect(reform['gov.contrib.congress.afa.in_effect']).toBe(true);
  });

  it('wires the Tax Cuts for Workers Act childless-EITC expansion', () => {
    const reform = buildReformDict(['federal_tax_cuts_for_workers'], undefined, 2026);
    expect(reform['gov.irs.credits.eitc.max[0].amount']).toBe(1502);
    expect(reform['gov.irs.credits.eitc.phase_in_rate[0].amount']).toBeCloseTo(0.153);
    expect(reform['gov.irs.credits.eitc.phase_out.rate[0].amount']).toBeCloseTo(0.153);
    expect(reform['gov.irs.credits.eitc.eligibility.age.min']).toBe(19);
    expect(reform['gov.irs.credits.eitc.eligibility.age.max']).toBe(200);
  });

  it('activates the Working Parents Tax Relief Act via its contrib flag', () => {
    const reform = buildReformDict(['federal_working_parents_tax_relief'], undefined, 2026);
    expect(
      reform['gov.contrib.congress.mcdonald_rivet.working_parents_tax_relief_act.in_effect'],
    ).toBe(true);
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

  // ---- Maine CTC (the "Dependent Exemption Tax Credit") -----------------
  it('emits the Maine CTC base amount, young-child multiplier, and phase-out', () => {
    const D = 'gov.states.me.tax.income.credits.dependent_exemption';
    const reform = buildReformDict(
      ['me_ctc'],
      {
        me_ctc: {
          amount: 500,
          young_child_multiplier: 3,
          phaseout_start: 50000,
        },
      },
      2026,
    );
    expect(reform[`${D}.amount`]).toBe(500);
    expect(reform[`${D}.multiplier[0].amount`]).toBe(3);
    // Phase-out start applies to all five filing statuses.
    for (const s of ['SINGLE', 'SEPARATE', 'HEAD_OF_HOUSEHOLD', 'JOINT', 'SURVIVING_SPOUSE']) {
      expect(reform[`${D}.phase_out.start.${s}`]).toBe(50000);
    }
  });

  it('is a no-op when the Maine CTC is left at current law', () => {
    expect(buildReformDict(['me_ctc'], undefined, 2026)).toEqual({});
    expect(
      buildReformDict(['me_ctc'], { me_ctc: { amount: 305, young_child_multiplier: 2 } }, 2026),
    ).toEqual({});
  });

  // ---- Dependent exemption / credit conversion --------------------------
  it('eliminates a baseline-param dependent exemption (NY → $0)', () => {
    const reform = buildReformDict(
      ['ny_dependent_exemption'],
      { ny_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(reform['gov.states.ny.tax.income.exemptions.dependent']).toBe(0);
  });

  it('partially repeals a baseline dependent exemption by lowering the amount', () => {
    const reform = buildReformDict(
      ['ny_dependent_exemption'],
      { ny_dependent_exemption: { amount: 500 } },
      2026,
    );
    expect(reform['gov.states.ny.tax.income.exemptions.dependent']).toBe(500);
  });

  it('is a no-op when a baseline dependent exemption is left at current law', () => {
    // NY current per-dependent amount is $1,000.
    expect(
      buildReformDict(
        ['ny_dependent_exemption'],
        { ny_dependent_exemption: { amount: 1000 } },
        2026,
      ),
    ).toEqual({});
    expect(buildReformDict(['ny_dependent_exemption'], undefined, 2026)).toEqual({});
  });

  it('eliminates a contrib dependent exemption (RI → flag on, amount 0)', () => {
    const reform = buildReformDict(
      ['ri_dependent_exemption'],
      { ri_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(reform['gov.contrib.states.ri.dependent_exemption.in_effect']).toBe(true);
    expect(reform['gov.contrib.states.ri.dependent_exemption.amount']).toBe(0);
  });

  it('re-prices a contrib dependent exemption (RI → flag on, new amount)', () => {
    const reform = buildReformDict(
      ['ri_dependent_exemption'],
      { ri_dependent_exemption: { amount: 2000 } },
      2026,
    );
    expect(reform['gov.contrib.states.ri.dependent_exemption.in_effect']).toBe(true);
    expect(reform['gov.contrib.states.ri.dependent_exemption.amount']).toBe(2000);
  });

  it('eliminates the South Carolina dependent exemption by zeroing its own amount (baseline)', () => {
    const reform = buildReformDict(
      ['sc_dependent_exemption'],
      { sc_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    // SC now has its own dependent-exemption param (PE-US 1.740.0), so it is
    // amount-editable; eliminate zeroes it without touching the young-child deduction.
    expect(
      reform['gov.states.sc.tax.income.deductions.dependent_exemption.amount'],
    ).toBe(0);
  });

  it('eliminates a bundled/shared dependent exemption via the broad repeal flag (UT)', () => {
    const reform = buildReformDict(
      ['ut_dependent_exemption'],
      { ut_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(
      reform['gov.contrib.repeal_state_dependent_exemptions.in_effect'],
    ).toBe(true);
  });

  it('is a no-op for a repeal-only dependent exemption when not eliminated', () => {
    expect(buildReformDict(['sc_dependent_exemption'], undefined, 2026)).toEqual({});
    // A repeal-only state ignores any amount value (it is not editable).
    expect(
      buildReformDict(['nc_dependent_exemption'], { nc_dependent_exemption: { amount: 500 } }, 2026),
    ).toEqual({});
  });

  it('applies the dependent-exemption edit only to dependents under the age cap', () => {
    // With the age cap on, the eliminate routes through the contrib reform and
    // sets the age_limit, so only dependents under the chosen age are affected.
    expect(
      buildReformDict(
        ['ri_dependent_exemption'],
        { ri_dependent_exemption: { eliminate: 1, age_limit_enabled: 1, age_limit_age: 18 } },
        2026,
      ),
    ).toEqual({
      'gov.contrib.states.ri.dependent_exemption.in_effect': true,
      'gov.contrib.states.ri.dependent_exemption.age_limit.in_effect': true,
      'gov.contrib.states.ri.dependent_exemption.age_limit.threshold': 18,
      'gov.contrib.states.ri.dependent_exemption.amount': 0,
    });
  });

  it('edits a stepped dependent exemption bracket threshold and amount', () => {
    // AL's per-dependent exemption is AGI-stepped; each tier amount AND the
    // AGI cutoffs are now editable. Changing the middle-tier cutoff and the
    // top-tier amount emits exactly those bracket params (others untouched).
    expect(
      buildReformDict(
        ['al_dependent_exemption'],
        { al_dependent_exemption: { threshold_mid: 30000, amount_high: 250 } },
        2026,
      ),
    ).toEqual({
      'gov.states.al.tax.income.exemptions.dependent[1].threshold': 30000,
      'gov.states.al.tax.income.exemptions.dependent[2].amount': 250,
    });
  });

  it('edits and eliminates AL across its three AGI brackets', () => {
    const D = 'gov.states.al.tax.income.exemptions.dependent';
    const elim = buildReformDict(
      ['al_dependent_exemption'],
      { al_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(elim[`${D}[0].amount`]).toBe(0);
    expect(elim[`${D}[1].amount`]).toBe(0);
    expect(elim[`${D}[2].amount`]).toBe(0);
    // Editing just the top (under-$50k) tier emits only that bracket.
    const edit = buildReformDict(
      ['al_dependent_exemption'],
      { al_dependent_exemption: { amount: 2000 } },
      2026,
    );
    expect(edit[`${D}[0].amount`]).toBe(2000);
    expect(edit[`${D}[1].amount`]).toBeUndefined();
  });

  it('edits the AZ dependent credit by age bracket', () => {
    const reform = buildReformDict(
      ['az_dependent_exemption'],
      { az_dependent_exemption: { amount: 200, amount_older: 50 } },
      2026,
    );
    expect(reform['gov.states.az.tax.income.credits.dependent_credit.amount[0].amount']).toBe(200);
    expect(reform['gov.states.az.tax.income.credits.dependent_credit.amount[1].amount']).toBe(50);
  });

  it('edits the scalar MN dependent exemption (no-op at current law)', () => {
    expect(
      buildReformDict(['mn_dependent_exemption'], { mn_dependent_exemption: { amount: 3000 } }, 2026)[
        'gov.states.mn.tax.income.exemptions.amount'
      ],
    ).toBe(3000);
    expect(buildReformDict(['mn_dependent_exemption'], undefined, 2026)).toEqual({});
  });

  it('UT is eliminate-only via the repeal flag (shared personal-exemption amount)', () => {
    const reform = buildReformDict(
      ['ut_dependent_exemption'],
      { ut_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(reform['gov.contrib.repeal_state_dependent_exemptions.in_effect']).toBe(true);
    // It does NOT touch the shared personal-exemption amount param.
    expect(
      reform['gov.states.ut.tax.income.credits.taxpayer.personal_exemption'],
    ).toBeUndefined();
  });

  it('eliminates both NJ dependent exemptions (regular + college)', () => {
    const reform = buildReformDict(
      ['nj_dependent_exemption'],
      { nj_dependent_exemption: { eliminate: 1 } },
      2026,
    );
    expect(reform['gov.states.nj.tax.income.exemptions.dependents.amount']).toBe(0);
    expect(
      reform['gov.states.nj.tax.income.exemptions.dependents_attending_college.amount'],
    ).toBe(0);
  });

  it('edits only the NJ college-dependent exemption when changed alone', () => {
    const reform = buildReformDict(
      ['nj_dependent_exemption'],
      { nj_dependent_exemption: { college_amount: 2000 } },
      2026,
    );
    expect(
      reform['gov.states.nj.tax.income.exemptions.dependents_attending_college.amount'],
    ).toBe(2000);
    // The regular dependent exemption is left at current law (not emitted).
    expect(
      reform['gov.states.nj.tax.income.exemptions.dependents.amount'],
    ).toBeUndefined();
  });
});

describe('buildDependentExemptionSubReform', () => {
  it('returns null when no dependent-exemption option is selected', () => {
    expect(buildDependentExemptionSubReform([], undefined, 2026)).toBeNull();
    expect(
      buildDependentExemptionSubReform(['ny_eitc', 'federal_ctc_expanded'], undefined, 2026),
    ).toBeNull();
  });

  it('captures ONLY the dependent-exemption portion of a combined reform', () => {
    // A combined reform: an NJ dependent-exemption elimination alongside a
    // state EITC change. The isolated sub-reform must contain the dependent
    // exemption params and nothing from the EITC option.
    const ids = ['nj_dependent_exemption', 'ny_eitc'];
    const params = {
      nj_dependent_exemption: { eliminate: 1 },
      ny_eitc: { match_rate: 50 },
    };
    const sub = buildDependentExemptionSubReform(ids, params, 2026);
    // Identical to building the dependent-exemption option on its own —
    // i.e. the EITC selection contributes nothing to the isolation.
    expect(sub).toEqual(
      buildReformDict(['nj_dependent_exemption'], params, 2026),
    );
    // Concretely: the dependent-exemption params are present…
    expect(sub).not.toBeNull();
    expect(sub!['gov.states.nj.tax.income.exemptions.dependents.amount']).toBe(0);
    // …and no EITC param leaked in.
    for (const key of Object.keys(sub!)) {
      expect(key).toContain('dependent');
      expect(key).not.toContain('eitc');
    }
  });

  it('returns null when the dependent-exemption edit is a no-op (current law)', () => {
    // A repeal-only state with no elimination builds to {} → treated as "no
    // dependent-exemption sub-reform" so the backend skips the extra sim.
    expect(
      buildDependentExemptionSubReform(
        ['sc_dependent_exemption', 'ny_eitc'],
        { ny_eitc: { match_rate: 50 } },
        2026,
      ),
    ).toBeNull();
  });

  it('excludes dependent CREDIT options (only the _dependent_exemption suffix)', () => {
    // de_dependent_credit is a credit, not the exemption, and must not be
    // pulled into the dependent-exemption isolation.
    expect(
      buildDependentExemptionSubReform(['de_dependent_credit'], undefined, 2026),
    ).toBeNull();
  });
});
