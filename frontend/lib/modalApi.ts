/**
 * Client for the Modal-hosted CPID backend (scripts/modal_cpid_endpoint.py).
 *
 * Spawn-and-poll, same wire protocol as refundable-credit-conversion:
 *
 *   POST /economy/start     -> { job_id }
 *   GET  /economy/status/X  -> { status: 'computing' | 'ok' | 'error', ... }
 *
 *   POST /household/start   -> { job_id }
 *   GET  /household/status  -> { status, result?: { data_points, baseline_data_points } }
 *
 * Set NEXT_PUBLIC_MODAL_CPID_URL on the Vercel project (and in
 * frontend/.env.local for dev) to the persistent URL Modal prints
 * after `modal deploy scripts/modal_cpid_endpoint.py`.
 */

import type { IncomeSweepResponse } from './household-types';

export type ReformDict = Record<
  string,
  Record<string, number | boolean | string | (number | string)[]>
>;

export interface EconomyImpactResult {
  state: string | null;
  year: number;
  fiscal: {
    federal_tax_change: number;
    state_tax_change: number;
    benefit_change: number;
    total_budgetary_impact: number;
  };
  poverty: {
    overall_baseline_rate: number;
    overall_reform_rate: number;
    child_baseline_rate: number;
    child_reform_rate: number;
    children_lifted: number;
  };
}

export function modalCpidUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MODAL_CPID_URL;
  if (!raw || raw.trim().length === 0) return null;
  return raw.replace(/\/+$/, '');
}

export function modalConfigured(): boolean {
  return modalCpidUrl() !== null;
}

interface StartResponse {
  job_id: string;
}

interface StatusResponse<T> {
  status: 'ok' | 'computing' | 'error';
  result?: T;
  message?: string;
}

const POLL_INTERVAL_MS = 4000;

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    const message =
      typeof detail === 'object' && detail && 'detail' in detail
        ? (detail as { detail: unknown }).detail
        : detail;
    throw new Error(
      `Modal endpoint ${response.status}: ${
        typeof message === 'string' ? message : JSON.stringify(message)
      }`,
    );
  }
  return (await response.json()) as T;
}

async function spawnAndPoll<T>(
  base: string,
  route: 'economy' | 'household',
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const { job_id } = await fetchJson<StartResponse>(
    `${base}/${route}/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  );

  while (true) {
    if (signal?.aborted) throw new Error('Aborted');
    const status = await fetchJson<StatusResponse<T>>(
      `${base}/${route}/status/${encodeURIComponent(job_id)}`,
      { method: 'GET', signal },
    );
    if (status.status === 'ok') {
      if (!status.result) {
        throw new Error(`Modal ${route} ok but no result attached.`);
      }
      return status.result;
    }
    if (status.status === 'error') {
      throw new Error(status.message ?? `Modal ${route} job failed.`);
    }
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, POLL_INTERVAL_MS);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new Error('Aborted'));
        },
        { once: true },
      );
    });
  }
}

/** Mint a policy_id via the PolicyEngine API so Modal can resolve the
 *  reform via Reform.from_api (which understands period-range strings
 *  and bracket indices). */
export async function createPolicy(reform: ReformDict): Promise<number> {
  const response = await fetch(
    'https://api.policyengine.org/us/policy',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: reform }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to mint policy_id (${response.status}): ${await response.text()}`,
    );
  }
  const body = (await response.json()) as {
    status: string;
    result?: { policy_id: number };
  };
  if (body.status !== 'ok' || !body.result) {
    throw new Error('PolicyEngine /policy returned non-ok status.');
  }
  return body.result.policy_id;
}

export async function runEconomyOnModal(
  policyId: number,
  year: number,
  state: string | null,
  signal?: AbortSignal,
): Promise<EconomyImpactResult> {
  const base = modalCpidUrl();
  if (!base) throw new Error('NEXT_PUBLIC_MODAL_CPID_URL is not set.');
  return spawnAndPoll<EconomyImpactResult>(
    base,
    'economy',
    { policy_id: policyId, year, state, region: 'us' },
    signal,
  );
}

export interface HouseholdSweepPayload {
  policy_id: number;
  year: number;
  state: string;
  married: boolean;
  head_age: number;
  spouse_age: number | null;
  dependent_ages: number[];
  income_range?: number[];
  spouse_employment_income?: number;
  self_employment_income?: number;
  social_security?: number;
  unemployment_compensation?: number;
  taxable_pension_income?: number;
  long_term_capital_gains?: number;
  qualified_dividend_income?: number;
  taxable_interest_income?: number;
}

export async function runHouseholdSweepOnModal(
  payload: HouseholdSweepPayload,
  signal?: AbortSignal,
): Promise<IncomeSweepResponse> {
  const base = modalCpidUrl();
  if (!base) throw new Error('NEXT_PUBLIC_MODAL_CPID_URL is not set.');
  return spawnAndPoll<IncomeSweepResponse>(
    base,
    'household',
    { ...payload },
    signal,
  );
}
