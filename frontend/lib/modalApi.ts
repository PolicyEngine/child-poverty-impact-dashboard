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

/** Flat reform dict the Modal /economy endpoint accepts. Values can be
 *  scalars (applied from the simulation year by default) or a
 *  ``{date: value}`` map for date-stamped overrides. Date keys must be
 *  ``YYYY-MM-DD`` — the wrapper's compile_reform rejects date-range
 *  strings like ``2026-01-01.2100-12-31``. */
export type ReformDict = Record<
  string,
  | number
  | boolean
  | string
  | Record<string, number | boolean | string>
>;

export interface EconomyDecileImpact {
  decile: number;
  average_gain: number;
  percent_gaining: number;
  percent_losing: number;
  percent_unchanged: number;
  gain_more_than_5_pct: number;
  gain_less_than_5_pct: number;
  no_change_pct: number;
  lose_less_than_5_pct: number;
  lose_more_than_5_pct: number;
  total_benefit: number;
  share_of_total_benefit: number;
}

export interface EconomyImpactResult {
  state: string | null;
  year: number;
  fiscal: {
    federal_tax_change: number;
    state_tax_change: number;
    benefit_change: number;
    total_budgetary_impact: number;
    ctc_change: number;
    eitc_change: number;
    snap_change: number;
    state_ctc_change: number;
    state_eitc_change: number;
    /** Basic-income (child allowance / baby bonus) outlay. Optional:
     *  older Modal deployments don't return it. */
    ubi_change?: number;
  };
  poverty: {
    overall_baseline_rate: number;
    overall_reform_rate: number;
    child_baseline_rate: number;
    child_reform_rate: number;
    young_child_baseline_rate: number;
    young_child_reform_rate: number;
    deep_child_baseline_rate: number;
    deep_child_reform_rate: number;
    children_lifted: number;
    young_children_lifted: number;
  };
  distributional: {
    deciles: EconomyDecileImpact[];
    average_gain_all: number;
    average_gain_bottom_50: number;
    average_gain_top_10: number;
    share_to_bottom_20_pct: number;
    share_to_bottom_50_pct: number;
    share_to_top_20_pct: number;
    share_to_top_10_pct: number;
    baseline_gini: number;
    reform_gini: number;
    gini_change: number;
    percent_gaining: number;
    percent_losing: number;
    percent_unchanged: number;
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

const POLL_INTERVAL_MS = 10000;

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

export async function runEconomyOnModal(
  reform: ReformDict | null,
  year: number,
  state: string | null,
  signal?: AbortSignal,
): Promise<EconomyImpactResult> {
  const base = modalCpidUrl();
  if (!base) throw new Error('NEXT_PUBLIC_MODAL_CPID_URL is not set.');
  return spawnAndPoll<EconomyImpactResult>(
    base,
    'economy',
    { reform, year, state, region: 'us' },
    signal,
  );
}

export interface HouseholdSweepPayload {
  reform: ReformDict | null;
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
