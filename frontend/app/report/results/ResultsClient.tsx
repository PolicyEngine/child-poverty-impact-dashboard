'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateImpact, calculateBaseline, runIncomeSweep } from '@/lib/household-api';
import { runAnalysisFromOptions } from '@/lib/api';
import type {
  HouseholdInput,
  HouseholdImpact,
  HouseholdResults,
  IncomeSweepResponse,
} from '@/lib/household-types';
import type { AnalysisResponse } from '@/lib/types';
import { US_STATES } from '@/lib/household-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import {
  StatewideOverview,
  StatewidePoverty,
  StatewideFiscal,
  StatewideDistributional,
} from '@/components/StatewideTabs';

// PolicyEngine color scheme (from keep-your-pay-act)
const COLORS = {
  primary: '#319795',       // primary-500 (teal)
  primaryDark: '#285E61',   // primary-700
  primaryLight: '#31979599', // primary-500 @ 60%
  positive: '#319795',      // primary-500
  negative: '#4B5563',      // gray-600
  gainMore5: '#285E61',     // primary-700
  gainLess5: '#31979599',   // primary-500 @ 60%
  noChange: '#E2E8F0',      // gray-200
  loseLess5: '#9CA3AF',     // gray-400
  loseMore5: '#4B5563',     // gray-600
  baseline: '#6B7280',      // gray-500
  reform: '#319795',        // primary-500
};

// Formatting helper functions (PolicyEngine style)
const formatCurrency = (value: number): string => {
  return `$${Math.abs(value).toLocaleString()}`;
};

const formatCurrencyWithSign = (value: number): string => {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(value).toLocaleString()}`;
};

const formatBillions = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return `$${(value / 1000).toFixed(2)}T`;
  } else if (absValue >= 1) {
    return `$${value.toFixed(2)}B`;
  } else if (absValue >= 0.001) {
    return `$${(value * 1000).toFixed(0)}M`;
  }
  return `$${value.toFixed(2)}B`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

const formatPercentWithSign = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// Tab types — household is conditional (only when the wizard's
// household step was filled in); the rest are statewide and always run.
type TabKey = 'household' | 'overview' | 'poverty' | 'fiscal' | 'distributional';

interface ReportConfig {
  state: string | null;
  populationType: 'household' | 'statewide';
  household: HouseholdInput | null;
  selectedReforms: string[];
  year: number;
  parameterValues?: Record<string, Record<string, number>>;
}

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const HOUSEHOLD_TAB: TabConfig = {
  key: 'household',
  label: 'Household',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
};

const TABS: TabConfig[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'poverty',
    label: 'Poverty Impact',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'fiscal',
    label: 'Budgetary',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'distributional',
    label: 'Distributional',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function ReportResultsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('household');
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Results for household analysis
  const [householdResults, setHouseholdResults] = useState<HouseholdImpact | null>(null);
  const [baselineResults, setBaselineResults] = useState<HouseholdResults | null>(null);
  const [incomeSweep, setIncomeSweep] = useState<IncomeSweepResponse | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);

  // Results for statewide analysis
  const [statewideResults, setStatewideResults] = useState<AnalysisResponse | null>(null);

  // Load config from sessionStorage and run analysis
  useEffect(() => {
    const loadAndAnalyze = async () => {
      try {
        const storedConfig = sessionStorage.getItem('reportConfig');
        if (!storedConfig) {
          setError('No report configuration found. Please start a new report.');
          setIsLoading(false);
          return;
        }

        const parsedConfig: ReportConfig = JSON.parse(storedConfig);
        setConfig(parsedConfig);

        if (!parsedConfig.state) {
          setError('Invalid report configuration. Please start a new report.');
          return;
        }

        // Statewide analysis always runs — that's the default impact
        // view. The household analysis is opt-in via the wizard's
        // household step (populationType === 'household').
        const statewidePromise = runAnalysisFromOptions(
          parsedConfig.state,
          parsedConfig.year,
          parsedConfig.selectedReforms,
          parsedConfig.parameterValues,
        )
          .then((results) => setStatewideResults(results))
          .catch((err: unknown) => {
            console.error('Statewide analysis failed:', err);
            throw err;
          });

        if (parsedConfig.populationType === 'household' && parsedConfig.household) {
          const householdPromise = Promise.all([
            calculateBaseline(parsedConfig.household),
            calculateImpact(parsedConfig.household, parsedConfig.selectedReforms),
          ]).then(([baseline, impact]) => {
            setBaselineResults(baseline);
            setHouseholdResults(impact);
          });

          // Background income sweep ($0–$400k @ $10k steps) so the
          // overview cards land immediately while the chart fills in.
          setSweepLoading(true);
          setSweepError(null);
          runIncomeSweep(
            parsedConfig.household,
            parsedConfig.selectedReforms,
            0,
            400_000,
            10_000,
          )
            .then((sweep) => setIncomeSweep(sweep))
            .catch((err: unknown) => {
              const message =
                (err as { response?: { data?: { detail?: string } }; message?: string })
                  ?.response?.data?.detail ??
                (err as { message?: string })?.message ??
                'Income sweep failed';
              console.warn('Income sweep failed:', err);
              setSweepError(String(message));
            })
            .finally(() => setSweepLoading(false));

          await Promise.all([statewidePromise, householdPromise]);
        } else {
          await statewidePromise;
        }
      } catch (err: any) {
        console.error('Error running analysis:', err);
        const errorMessage = err?.response?.data?.detail || err?.message || 'Unknown error';
        setError(`Failed to run analysis: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadAndAnalyze();
  }, []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  // Statewide always runs; household is optional. Treat the page as
  // having results once the always-on statewide leg has returned.
  const hasResults = config && statewideResults;
  const showHouseholdTab =
    !!config &&
    config.populationType === 'household' &&
    !!config.household;

  if (!hasResults) {
    return <ErrorState error="No results available" />;
  }

  // Default-active tab: 'household' when available, otherwise drop to
  // 'overview'. Without this the initial state of 'household' would
  // render nothing on skipped-household runs.
  if (!showHouseholdTab && activeTab === 'household') {
    setActiveTab('overview');
  }

  return (
    <div className="min-h-screen bg-pe-gray-50/30">
      {/* Header */}
      <div className="bg-white border-b border-pe-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/report"
                className="text-pe-gray-500 text-sm mb-2 inline-flex items-center gap-1 transition-colors"
                style={{ ['--hover-color' as string]: COLORS.primary }}
                onMouseEnter={(e) => e.currentTarget.style.color = COLORS.primary}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                New Report
              </Link>
              <h1 className="text-2xl font-bold text-pe-gray-900 tracking-tight">
                Report Results
              </h1>
              <p className="text-pe-gray-500 mt-1">
                {config!.state ? US_STATES[config!.state] : 'Analysis'} &bull; {config!.populationType === 'statewide' ? 'Statewide' : 'Household'} &bull; {config!.selectedReforms.length} reform(s)
              </p>
            </div>
            <button
              onClick={() => router.push('/report')}
              className="btn btn-ghost"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Start Over
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-pe-gray-100 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1">
            {(showHouseholdTab ? [HOUSEHOLD_TAB, ...TABS] : TABS).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-4 border-b-2 font-medium transition-all"
                style={{
                  borderColor: activeTab === tab.key ? COLORS.primary : 'transparent',
                  color: activeTab === tab.key ? COLORS.primary : '#6B7280',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.key) {
                    e.currentTarget.style.color = '#6B7280';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'household' && showHouseholdTab && householdResults ? (
          <HouseholdOverviewTab
            config={config!}
            results={householdResults}
            baseline={baselineResults}
            incomeSweep={incomeSweep}
            sweepLoading={sweepLoading}
            sweepError={sweepError}
          />
        ) : activeTab === 'overview' && statewideResults ? (
          <StatewideOverview
            results={statewideResults}
            state={config!.state}
            year={config!.year}
          />
        ) : activeTab === 'poverty' && statewideResults ? (
          <StatewidePoverty
            results={statewideResults}
            state={config!.state}
            year={config!.year}
          />
        ) : activeTab === 'fiscal' && statewideResults ? (
          <StatewideFiscal
            results={statewideResults}
            state={config!.state}
            year={config!.year}
          />
        ) : activeTab === 'distributional' && statewideResults ? (
          <StatewideDistributional
            results={statewideResults}
            state={config!.state}
            year={config!.year}
          />
        ) : null}
      </div>
    </div>
  );
}

// Loading State Component
function LoadingState() {
  return (
    <div className="min-h-screen bg-pe-gray-50/30 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full border-4"
            style={{ borderColor: `${COLORS.primary}30` }}
          ></div>
          <div
            className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: COLORS.primary, borderTopColor: 'transparent' }}
          ></div>
        </div>
        <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Running Analysis</h2>
        <p className="text-pe-gray-500">Calculating policy impacts via PolicyEngine...</p>
        <p className="text-sm text-pe-gray-400 mt-2">This may take 1-2 minutes for statewide analysis</p>
      </div>
    </div>
  );
}

// Error State Component
function ErrorState({ error }: { error: string }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-pe-gray-50/30 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Something went wrong</h2>
        <p className="text-pe-gray-500 mb-6">{error}</p>
        <button
          onClick={() => router.push('/report')}
          className="px-6 py-3 rounded-lg font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: COLORS.primary }}
        >
          Start New Report
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HOUSEHOLD ANALYSIS COMPONENTS
// ============================================================================

// Provisions surfaced as change cards on the household overview. Federal/state
// income tax are intentionally omitted per design — only programs that move
// with reforms appear here.
const PROVISION_FIELDS: {
  key: 'federal_ctc' | 'federal_eitc' | 'state_ctc' | 'state_eitc' | 'snap_benefits';
  label: string;
}[] = [
  { key: 'federal_ctc', label: 'Federal CTC' },
  { key: 'federal_eitc', label: 'Federal EITC' },
  { key: 'state_ctc', label: 'State CTC' },
  { key: 'state_eitc', label: 'State EITC' },
  { key: 'snap_benefits', label: 'SNAP' },
];

function ChangeCard({
  label,
  change,
  highlight = false,
}: {
  label: string;
  change: number;
  highlight?: boolean;
}) {
  const beneficial = change > 0;
  const harmful = change < 0;
  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  const formatted = `${sign}$${Math.abs(Math.round(change)).toLocaleString()}`;
  return (
    <div
      className={`rounded-lg border p-5 ${
        beneficial
          ? 'bg-green-50 border-green-200'
          : harmful
          ? 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-200'
      } ${highlight ? 'sm:col-span-2 lg:col-span-1 ring-1 ring-pe-teal-200' : ''}`}
    >
      <p className="text-sm text-pe-gray-600 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          beneficial ? 'text-green-700' : harmful ? 'text-red-700' : 'text-pe-gray-500'
        }`}
      >
        {formatted}
        <span className="text-sm font-medium text-pe-gray-500 ml-1">/year</span>
      </p>
    </div>
  );
}

interface ChartPoint {
  income: number;
  net_income_change: number;
  federal_ctc_change: number;
  federal_eitc_change: number;
  state_ctc_change: number;
  state_eitc_change: number;
  snap_change: number;
}

function NetIncomeChangeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const fmt = (v: number) => {
    if (v === 0) return '$0';
    const sign = v > 0 ? '+' : '-';
    return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
  };
  return (
    <div className="bg-white border border-pe-gray-200 rounded-md shadow-lg px-3 py-2 text-xs min-w-[220px]">
      <p className="font-semibold text-pe-gray-800 mb-1">
        Employment income: ${Math.round(p.income).toLocaleString()}
      </p>
      <div className="space-y-0.5 text-pe-gray-600">
        <div className="flex justify-between gap-3">
          <span>Federal CTC</span>
          <span>{fmt(p.federal_ctc_change)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Federal EITC</span>
          <span>{fmt(p.federal_eitc_change)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>State CTC</span>
          <span>{fmt(p.state_ctc_change)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>State EITC</span>
          <span>{fmt(p.state_eitc_change)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>SNAP</span>
          <span>{fmt(p.snap_change)}</span>
        </div>
      </div>
      <div className="border-t border-pe-gray-200 mt-1 pt-1 flex justify-between gap-3 font-semibold text-pe-gray-800">
        <span>Net income change</span>
        <span>{fmt(p.net_income_change)}</span>
      </div>
    </div>
  );
}

function HouseholdOverviewTab({
  config,
  results,
  baseline: _baseline,
  incomeSweep,
  sweepLoading,
  sweepError,
}: {
  config: ReportConfig;
  results: HouseholdImpact;
  baseline: HouseholdResults | null;
  incomeSweep: IncomeSweepResponse | null;
  sweepLoading: boolean;
  sweepError: string | null;
}) {
  const { baseline: baselineHH, reform, net_income_change } = results;

  const chartData: ChartPoint[] = (() => {
    if (!incomeSweep?.baseline_data_points) return [];
    const reformPoints = incomeSweep.data_points;
    const basePoints = incomeSweep.baseline_data_points;
    const length = Math.min(reformPoints.length, basePoints.length);
    const out: ChartPoint[] = [];
    for (let i = 0; i < length; i++) {
      const r = reformPoints[i];
      const b = basePoints[i];
      out.push({
        income: r.income,
        net_income_change: r.net_income - b.net_income,
        federal_ctc_change: r.federal_ctc - b.federal_ctc,
        federal_eitc_change: r.federal_eitc - b.federal_eitc,
        state_ctc_change: r.state_ctc - b.state_ctc,
        state_eitc_change: r.state_eitc - b.state_eitc,
        snap_change: r.snap_benefits - b.snap_benefits,
      });
    }
    return out;
  })();

  return (
    <div className="space-y-6">
      {/* Summary intro */}
      <div className="card bg-gradient-to-br from-pe-teal-50 to-white">
        <h2 className="text-lg font-semibold text-pe-gray-800">
          Household impact{' '}
          {config.state ? `in ${US_STATES[config.state]}` : ''}{' '}
          ({config.year})
        </h2>
        <p className="text-pe-gray-600 mt-1 text-sm">
          Change in each affected provision and total net income compared to
          current law.
        </p>
      </div>

      {/* Per-provision change cards (federal/state income tax intentionally excluded) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVISION_FIELDS.map(({ key, label }) => (
          <ChangeCard
            key={key}
            label={label}
            change={(reform[key] as number) - (baselineHH[key] as number)}
          />
        ))}
        <ChangeCard
          label="Net income"
          change={net_income_change}
          highlight
        />
      </div>

      {/* Net income change chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800">
          Change in net income by employment income
        </h3>
        <p className="text-sm text-pe-gray-500 mb-4">
          Reform vs. current law across $0–$400k of employment income. Hover
          for the per-provision breakdown.
        </p>
        {sweepLoading ? (
          <div className="flex items-center justify-center py-16 text-pe-gray-500 text-sm">
            Computing impact across the income range…
          </div>
        ) : sweepError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold mb-1">
              Chart unavailable for this reform
            </p>
            <p className="font-mono text-xs whitespace-pre-wrap">{sweepError}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-pe-gray-500 text-sm">
            No chart data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="income"
                type="number"
                domain={[0, 400_000]}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                }
                stroke="#6B7280"
                ticks={[0, 50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 350_000, 400_000]}
              />
              <YAxis
                tickFormatter={(v: number) => formatCurrencyWithSign(v)}
                stroke="#6B7280"
                width={80}
              />
              <ReferenceLine y={0} stroke="#9CA3AF" />
              <Tooltip content={<NetIncomeChangeTooltip />} cursor={{ fill: 'rgba(49,151,149,0.08)' }} />
              <Bar dataKey="net_income_change" fill={COLORS.primary} maxBarSize={6} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function HouseholdPovertyTab({
  config,
  results
}: {
  config: ReportConfig;
  results: HouseholdImpact;
}) {
  const { baseline, reform, poverty_status_change } = results;

  return (
    <div className="space-y-6">
      {/* Poverty Status Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Baseline Poverty Status</h3>
          <div className="space-y-4">
            <StatusRow label="In Poverty" value={baseline.in_poverty} />
            <StatusRow label="In Deep Poverty" value={baseline.in_deep_poverty} />
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">Poverty Gap</span>
              <span className="font-semibold text-pe-gray-800">
                ${baseline.poverty_gap.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Reform Poverty Status</h3>
          <div className="space-y-4">
            <StatusRow label="In Poverty" value={reform.in_poverty} />
            <StatusRow label="In Deep Poverty" value={reform.in_deep_poverty} />
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">Poverty Gap</span>
              <span className="font-semibold text-pe-gray-800">
                ${reform.poverty_gap.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Change Banner */}
      {poverty_status_change !== 'unchanged' && (
        <div className={`card ${
          poverty_status_change === 'lifted'
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              poverty_status_change === 'lifted' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {poverty_status_change === 'lifted' ? (
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
            </div>
            <div>
              <h3 className={`font-semibold ${poverty_status_change === 'lifted' ? 'text-green-800' : 'text-red-800'}`}>
                {poverty_status_change === 'lifted' ? 'Household Lifted Out of Poverty' : 'Household Fell Into Poverty'}
              </h3>
              <p className={poverty_status_change === 'lifted' ? 'text-green-700' : 'text-red-700'}>
                {poverty_status_change === 'lifted'
                  ? 'The reform policies would lift this household above the poverty line.'
                  : 'The reform policies would push this household below the poverty line.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HouseholdFiscalTab({
  config,
  results
}: {
  config: ReportConfig;
  results: HouseholdImpact;
}) {
  const { baseline, reform, ctc_change, eitc_change } = results;

  const benefitChanges = [
    { name: 'Federal CTC', baseline: baseline.federal_ctc, reform: reform.federal_ctc },
    { name: 'State CTC', baseline: baseline.state_ctc, reform: reform.state_ctc },
    { name: 'Federal EITC', baseline: baseline.federal_eitc, reform: reform.federal_eitc },
    { name: 'State EITC', baseline: baseline.state_eitc, reform: reform.state_eitc },
    { name: 'SNAP Benefits', baseline: baseline.snap_benefits, reform: reform.snap_benefits },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <MetricCard
          label="CTC Change"
          value={`${ctc_change >= 0 ? '+' : ''}$${Math.abs(ctc_change).toLocaleString()}`}
          subtext="Federal + State"
          color={ctc_change >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="EITC Change"
          value={`${eitc_change >= 0 ? '+' : ''}$${Math.abs(eitc_change).toLocaleString()}`}
          subtext="Federal + State"
          color={eitc_change >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Total Benefits Change"
          value={`${(reform.total_benefits - baseline.total_benefits) >= 0 ? '+' : ''}$${Math.abs(reform.total_benefits - baseline.total_benefits).toLocaleString()}`}
          subtext="All programs"
          color={(reform.total_benefits - baseline.total_benefits) >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Benefits Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Benefits Breakdown</h3>
        <div className="space-y-3">
          {benefitChanges.map((item) => {
            const change = item.reform - item.baseline;
            return (
              <div key={item.name} className="flex items-center justify-between py-3 border-b border-pe-gray-100 last:border-0">
                <span className="text-pe-gray-600">{item.name}</span>
                <div className="flex items-center gap-6">
                  <span className="text-pe-gray-500 text-sm w-24 text-right">
                    ${item.baseline.toLocaleString()}
                  </span>
                  <span className="text-pe-gray-400">&rarr;</span>
                  <span className="font-medium text-pe-gray-800 w-24 text-right">
                    ${item.reform.toLocaleString()}
                  </span>
                  <span className={`w-24 text-right font-semibold ${
                    change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-pe-gray-400'
                  }`}>
                    {change > 0 ? '+' : ''}{change !== 0 ? `$${Math.abs(change).toLocaleString()}` : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HouseholdDistributionalTab({ config }: { config: ReportConfig }) {
  return (
    <div className="card bg-pe-gray-50">
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-pe-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-pe-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">
          Distributional Analysis
        </h3>
        <p className="text-pe-gray-500 max-w-md mx-auto">
          Distributional analysis shows how policy impacts vary across income groups.
          This analysis is available for statewide population simulations.
        </p>
        <Link href="/report" className="btn btn-primary mt-6">
          Run Statewide Analysis
        </Link>
      </div>
    </div>
  );
}


// ============================================================================
// SHARED HELPER COMPONENTS
// ============================================================================

function MetricCard({
  label,
  value,
  subtext,
  color = 'gray'
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray' | 'teal';
}) {
  // PolicyEngine color-matched backgrounds and text
  const colorStyles: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: `${COLORS.positive}10`, text: COLORS.positive, border: COLORS.positive },
    teal: { bg: `${COLORS.primary}10`, text: COLORS.primary, border: COLORS.primary },
    red: { bg: `${COLORS.negative}10`, text: COLORS.negative, border: COLORS.negative },
    blue: { bg: '#EBF8FF', text: '#2B6CB0', border: '#3182CE' },
    amber: { bg: '#FFFBEB', text: '#B45309', border: '#D97706' },
    purple: { bg: '#F5F3FF', text: '#6D28D9', border: '#7C3AED' },
    gray: { bg: '#F9FAFB', text: '#4B5563', border: '#9CA3AF' },
  };

  const style = colorStyles[color] || colorStyles.gray;

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        backgroundColor: style.bg,
        borderTop: `3px solid ${style.border}`,
      }}
    >
      <p className="text-sm text-pe-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: style.text }}>{value}</p>
      {subtext && <p className="text-xs text-pe-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}

function ComparisonRow({
  label,
  baseline,
  reform,
  format = 'currency',
  invertColor = false
}: {
  label: string;
  baseline: number;
  reform: number;
  format?: 'currency' | 'percent' | 'number';
  invertColor?: boolean;
}) {
  const change = reform - baseline;
  const isPositive = invertColor ? change < 0 : change > 0;
  const isNegative = invertColor ? change > 0 : change < 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `$${val.toLocaleString()}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const formatChange = (val: number) => {
    const prefix = val >= 0 ? '+' : '';
    switch (format) {
      case 'currency':
        return `${prefix}$${Math.abs(val).toLocaleString()}`;
      case 'percent':
        return `${prefix}${val.toFixed(1)}pp`;
      default:
        return `${prefix}${val.toLocaleString()}`;
    }
  };

  return (
    <tr className="border-b border-pe-gray-50 hover:bg-pe-gray-25">
      <td className="py-3 px-4 text-pe-gray-600">{label}</td>
      <td className="py-3 px-4 text-right text-pe-gray-500">{formatValue(baseline)}</td>
      <td className="py-3 px-4 text-right font-medium text-pe-gray-800">{formatValue(reform)}</td>
      <td className={`py-3 px-4 text-right font-semibold ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-pe-gray-400'
      }`}>
        {change !== 0 ? formatChange(change) : '-'}
      </td>
    </tr>
  );
}

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
      <span className="text-pe-gray-600">{label}</span>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        value ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}>
        {value ? 'Yes' : 'No'}
      </span>
    </div>
  );
}
