/**
 * Thin adapter that talks to api.policyengine.org directly, used as a
 * production fallback when neither the local FastAPI backend nor a
 * deployed Modal endpoint is reachable.
 *
 * Only the surface area the dashboard actually consumes is implemented:
 *   - household baseline + reform at a single employment income,
 *   - household sweep across an income range,
 *   - statewide economy impact (via /us/economy with state-filtered region).
 *
 * The Modal endpoint in scripts/modal_cpid_endpoint.py covers the same
 * surface with better performance; this exists so a fresh Vercel deploy
 * is usable even before someone runs `modal deploy`.
 */

import type {
  HouseholdInput,
  HouseholdResults,
  HouseholdImpact,
  IncomeSweepResponse,
} from './household-types';
import { buildStateEitcReform } from './state-programs';
import type { AnalysisResponse } from './types';

const PE_API_URL = 'https://api.policyengine.org';
const BASELINE_POLICY_ID = 2;

type ReformDict = Record<
  string,
  Record<string, number | boolean | string | (number | string)[]>
>;

interface PECalculateResponse {
  result: {
    people: Record<string, Record<string, Record<string, number>>>;
    tax_units: Record<string, Record<string, Record<string, number>>>;
    households: Record<string, Record<string, Record<string, number>>>;
    spm_units?: Record<string, Record<string, Record<string, number>>>;
  };
}

async function peCalculate(
  body: Record<string, unknown>,
): Promise<PECalculateResponse> {
  const response = await fetch(`${PE_API_URL}/us/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`PolicyEngine API ${response.status}: ${detail.slice(0, 400)}`);
  }
  return response.json();
}

function reformFromOptions(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>,
): ReformDict {
  const year = household.year;
  const reform: ReformDict = {};

  for (const id of reformOptionIds) {
    if (id.endsWith('_eitc')) {
      const state = id.slice(0, 2).toUpperCase();
      const rateRaw =
        parameterValues?.[id]?.match_rate ??
        // Fall back to a "do something visible" default if the wizard
        // didn't carry through a parameter value.
        30;
      const rate = rateRaw / 100;
      Object.assign(reform, buildStateEitcReform(state, rate, year));
    }
    if (id === 'federal_ctc_expanded') {
      const yearKey = `${year}-01-01.2100-12-31`;
      reform['gov.irs.credits.ctc.refundable.fully_refundable'] = {
        [yearKey]: true,
      };
      reform['gov.irs.credits.ctc.phase_out.threshold.SINGLE'] = {
        [yearKey]: 75_000,
      };
      reform['gov.irs.credits.ctc.phase_out.threshold.JOINT'] = {
        [yearKey]: 150_000,
      };
    }
    if (id === 'federal_eitc_expansion') {
      const yearKey = `${year}-01-01.2100-12-31`;
      reform['gov.contrib.policyengine.us.eitc.match_rate'] = {
        [yearKey]: 1.5,
      };
    }
  }

  return reform;
}

/**
 * Build the PolicyEngine situation dict from our HouseholdInput.
 * Mirrors the situation shape used by api.policyengine.org/us/calculate.
 */
function buildSituation(
  household: HouseholdInput,
  employmentIncomeOverride?: number,
): Record<string, unknown> {
  const year = household.year;
  const adults = household.adults ?? [];
  const children = household.children ?? [];

  const people: Record<string, Record<string, Record<string, number>>> = {};
  const taxUnitMembers: string[] = [];
  const householdMembers: string[] = [];
  const spmMembers: string[] = [];

  const headIncome =
    employmentIncomeOverride ?? household.income.employment_income ?? 0;
  people['head'] = {
    age: { [year]: adults[0]?.age ?? 30 },
    employment_income: { [year]: headIncome },
  };
  for (const key of [
    'self_employment_income',
    'social_security_income',
    'unemployment_income',
    'pension_income',
    'capital_gains',
    'dividend_income',
    'taxable_interest_income',
    'taxable_retirement_distributions',
  ] as const) {
    const v = household.income[key];
    if (typeof v === 'number' && v > 0) {
      // Map our names → PE-US variable names where they differ.
      const peVar =
        key === 'social_security_income'
          ? 'social_security'
          : key === 'unemployment_income'
            ? 'unemployment_compensation'
            : key === 'pension_income'
              ? 'taxable_pension_income'
              : key === 'capital_gains'
                ? 'long_term_capital_gains'
                : key === 'dividend_income'
                  ? 'qualified_dividend_income'
                  : key === 'taxable_retirement_distributions'
                    ? 'taxable_pension_income'
                    : key;
      people['head'][peVar] = { [year]: v };
    }
  }
  taxUnitMembers.push('head');
  householdMembers.push('head');
  spmMembers.push('head');

  if (adults.length > 1) {
    people['spouse'] = {
      age: { [year]: adults[1].age ?? 30 },
      employment_income: {
        [year]: household.income.spouse_employment_income ?? 0,
      },
    };
    taxUnitMembers.push('spouse');
    householdMembers.push('spouse');
    spmMembers.push('spouse');
  }

  children.forEach((child, i) => {
    const id = `child_${i}`;
    people[id] = { age: { [year]: child.age ?? 5 } };
    taxUnitMembers.push(id);
    householdMembers.push(id);
    spmMembers.push(id);
  });

  return {
    people,
    tax_units: {
      tax_unit: {
        members: taxUnitMembers,
        // `ctc` is the federal Child Tax Credit in PE-US;
        // `eitc` is the federal EITC. There is no `federal_ctc` variable.
        eitc: { [year]: null },
        ctc: { [year]: null },
      },
    },
    households: {
      household: {
        members: householdMembers,
        state_name: { [year]: household.state },
        household_net_income: { [year]: null },
        household_benefits: { [year]: null },
      },
    },
    spm_units: {
      spm_unit: {
        members: spmMembers,
        snap: { [year]: null },
        spm_unit_is_in_spm_poverty: { [year]: null },
      },
    },
  };
}

function extractResults(
  body: PECalculateResponse,
  household: HouseholdInput,
): HouseholdResults {
  const year = household.year;
  const taxUnit = body.result.tax_units?.tax_unit ?? {};
  const householdResult = body.result.households?.household ?? {};
  const spm = body.result.spm_units?.spm_unit ?? {};

  const ctc = Number(taxUnit['ctc']?.[year] ?? 0);
  const eitc = Number(taxUnit['eitc']?.[year] ?? 0);
  const snap = Number(spm['snap']?.[year] ?? 0);
  const netIncome = Number(householdResult['household_net_income']?.[year] ?? 0);
  const benefits = Number(householdResult['household_benefits']?.[year] ?? 0);
  const inPoverty = Number(spm['spm_unit_is_in_spm_poverty']?.[year] ?? 0) > 0.5;
  const grossIncome =
    (household.income.employment_income || 0) +
    (household.income.spouse_employment_income || 0) +
    (household.income.self_employment_income || 0) +
    (household.income.social_security_income || 0) +
    (household.income.unemployment_income || 0);

  return {
    year,
    state: household.state,
    gross_income: grossIncome,
    adjusted_gross_income: grossIncome,
    federal_income_tax: 0,
    state_income_tax: 0,
    payroll_tax: 0,
    net_income: netIncome,
    federal_ctc: ctc,
    federal_eitc: eitc,
    state_ctc: 0,
    state_eitc: 0,
    snap_benefits: snap,
    total_benefits: benefits,
    in_poverty: inPoverty,
    in_deep_poverty: false,
    poverty_gap: 0,
    effective_tax_rate: 0,
    total_child_benefits: ctc + eitc,
  };
}

export async function calculateBaselineViaApi(
  household: HouseholdInput,
): Promise<HouseholdResults> {
  const situation = buildSituation(household);
  const response = await peCalculate({ household: situation });
  return extractResults(response, household);
}

export async function calculateImpactViaApi(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues?: Record<string, Record<string, number>>,
): Promise<HouseholdImpact> {
  const situation = buildSituation(household);
  const reform = reformFromOptions(
    household,
    reformOptionIds,
    parameterValues,
  );

  const [baselineResponse, reformResponse] = await Promise.all([
    peCalculate({ household: situation }),
    peCalculate({ household: situation, policy: reform }),
  ]);

  const baseline = extractResults(baselineResponse, household);
  const reformResults = extractResults(reformResponse, household);
  const netChange = reformResults.net_income - baseline.net_income;

  return {
    baseline,
    reform: reformResults,
    net_income_change: netChange,
    percent_income_change:
      baseline.net_income > 0
        ? (netChange / baseline.net_income) * 100
        : 0,
    ctc_change: reformResults.federal_ctc - baseline.federal_ctc,
    eitc_change: reformResults.federal_eitc - baseline.federal_eitc,
    poverty_status_change:
      baseline.in_poverty && !reformResults.in_poverty
        ? 'lifted'
        : !baseline.in_poverty && reformResults.in_poverty
          ? 'fell_into'
          : 'unchanged',
  };
}

export async function runIncomeSweepViaApi(
  household: HouseholdInput,
  reformOptionIds: string[],
  parameterValues: Record<string, Record<string, number>>,
  minIncome: number,
  maxIncome: number,
  step: number,
): Promise<IncomeSweepResponse> {
  const incomes: number[] = [];
  for (let inc = minIncome; inc <= maxIncome; inc += step) {
    incomes.push(inc);
  }
  const reform = reformFromOptions(
    household,
    reformOptionIds,
    parameterValues,
  );

  const points = await Promise.all(
    incomes.map(async (income) => {
      const situation = buildSituation(household, income);
      const [baseline, reformResp] = await Promise.all([
        peCalculate({ household: situation }),
        Object.keys(reform).length > 0
          ? peCalculate({ household: situation, policy: reform })
          : Promise.resolve(undefined as unknown as PECalculateResponse),
      ]);
      const baseHh = extractResults(baseline, {
        ...household,
        income: { ...household.income, employment_income: income },
      });
      const reformHh = reformResp
        ? extractResults(reformResp, {
            ...household,
            income: { ...household.income, employment_income: income },
          })
        : baseHh;
      return { income, baseline: baseHh, reform: reformHh };
    }),
  );

  return {
    state: household.state,
    year: household.year,
    data_points: points.map((p) => ({
      income: p.income,
      net_income: p.reform.net_income,
      federal_ctc: p.reform.federal_ctc,
      state_ctc: p.reform.state_ctc,
      federal_eitc: p.reform.federal_eitc,
      state_eitc: p.reform.state_eitc,
      snap_benefits: p.reform.snap_benefits,
      total_benefits: p.reform.total_benefits,
      effective_tax_rate: p.reform.effective_tax_rate,
      in_poverty: p.reform.in_poverty,
    })),
    baseline_data_points: points.map((p) => ({
      income: p.income,
      net_income: p.baseline.net_income,
      federal_ctc: p.baseline.federal_ctc,
      state_ctc: p.baseline.state_ctc,
      federal_eitc: p.baseline.federal_eitc,
      state_eitc: p.baseline.state_eitc,
      snap_benefits: p.baseline.snap_benefits,
      total_benefits: p.baseline.total_benefits,
      effective_tax_rate: p.baseline.effective_tax_rate,
      in_poverty: p.baseline.in_poverty,
    })),
  };
}

/**
 * Statewide impact via api.policyengine.org/us/economy. Returns the same
 * AnalysisResponse shape the legacy FastAPI route did, with the fields we
 * actually display populated and the rest stubbed at zero.
 */
export async function runStatewideViaApi(
  state: string,
  year: number,
  reformOptionIds: string[],
  parameterValues: Record<string, Record<string, number>>,
  household: HouseholdInput,
): Promise<AnalysisResponse> {
  const reform = reformFromOptions(household, reformOptionIds, parameterValues);

  // Mint a policy_id via /us/policy.
  const policyResponse = await fetch(`${PE_API_URL}/us/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: reform }),
  });
  if (!policyResponse.ok) {
    throw new Error(
      `PolicyEngine /policy ${policyResponse.status}: ${await policyResponse.text()}`,
    );
  }
  const policyBody = (await policyResponse.json()) as {
    status: string;
    result?: { policy_id: number };
  };
  if (!policyBody.result) {
    throw new Error('PolicyEngine /policy returned no policy_id.');
  }
  const policyId = policyBody.result.policy_id;

  const region = `state/${state.toLowerCase()}`;
  const url = `${PE_API_URL}/us/economy/${policyId}/over/${BASELINE_POLICY_ID}?region=${region}&time_period=${year}`;

  // Spawn-and-poll loop, same shape /us/economy uses on policyengine.org.
  while (true) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`PolicyEngine /economy ${resp.status}: ${await resp.text()}`);
    }
    const body = (await resp.json()) as {
      status: 'ok' | 'computing' | 'error';
      result?: Record<string, unknown>;
      message?: string;
    };
    if (body.status === 'ok' && body.result) {
      const r = body.result as Record<string, unknown>;
      return r as unknown as AnalysisResponse;
    }
    if (body.status === 'error') {
      throw new Error(body.message ?? 'PolicyEngine /economy failed.');
    }
    await new Promise((res) => setTimeout(res, 4000));
  }
}
