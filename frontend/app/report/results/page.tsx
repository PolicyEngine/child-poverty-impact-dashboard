'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateImpact, calculateBaseline } from '@/lib/household-api';
import { runAnalysisFromOptions } from '@/lib/api';
import type { HouseholdInput, HouseholdImpact, HouseholdResults } from '@/lib/household-types';
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

// Tab types
type TabKey = 'overview' | 'poverty' | 'fiscal' | 'distributional';

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
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Results for household analysis
  const [householdResults, setHouseholdResults] = useState<HouseholdImpact | null>(null);
  const [baselineResults, setBaselineResults] = useState<HouseholdResults | null>(null);

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

        if (parsedConfig.populationType === 'household' && parsedConfig.household) {
          // Run household analysis
          const [baseline, impact] = await Promise.all([
            calculateBaseline(parsedConfig.household),
            calculateImpact(parsedConfig.household, parsedConfig.selectedReforms),
          ]);
          setBaselineResults(baseline);
          setHouseholdResults(impact);
        } else if (parsedConfig.populationType === 'statewide' && parsedConfig.state) {
          // Run statewide analysis
          const results = await runAnalysisFromOptions(
            parsedConfig.state,
            parsedConfig.year,
            parsedConfig.selectedReforms,
            parsedConfig.parameterValues
          );
          setStatewideResults(results);
        } else {
          setError('Invalid report configuration. Please start a new report.');
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

  // Check if we have valid results based on population type
  const hasResults = config && (
    (config.populationType === 'household' && householdResults) ||
    (config.populationType === 'statewide' && statewideResults)
  );

  if (!hasResults) {
    return <ErrorState error="No results available" />;
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
            {TABS.map((tab) => (
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
        {config!.populationType === 'household' && householdResults ? (
          // Household Results
          <>
            {activeTab === 'overview' && (
              <HouseholdOverviewTab
                config={config!}
                results={householdResults}
                baseline={baselineResults}
              />
            )}
            {activeTab === 'poverty' && (
              <HouseholdPovertyTab
                config={config!}
                results={householdResults}
              />
            )}
            {activeTab === 'fiscal' && (
              <HouseholdFiscalTab
                config={config!}
                results={householdResults}
              />
            )}
            {activeTab === 'distributional' && (
              <HouseholdDistributionalTab config={config!} />
            )}
          </>
        ) : statewideResults ? (
          // Statewide Results
          <>
            {activeTab === 'overview' && (
              <StatewideOverviewTab
                config={config!}
                results={statewideResults}
              />
            )}
            {activeTab === 'poverty' && (
              <StatewidePovertyTab
                config={config!}
                results={statewideResults}
              />
            )}
            {activeTab === 'fiscal' && (
              <StatewideFiscalTab
                config={config!}
                results={statewideResults}
              />
            )}
            {activeTab === 'distributional' && (
              <StatewideDistributionalTab
                config={config!}
                results={statewideResults}
              />
            )}
          </>
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

function HouseholdOverviewTab({
  config,
  results,
  baseline
}: {
  config: ReportConfig;
  results: HouseholdImpact;
  baseline: HouseholdResults | null;
}) {
  const { baseline: baselineHH, reform, net_income_change, percent_income_change, poverty_status_change } = results;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="card bg-gradient-to-br from-pe-teal-50 to-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-pe-teal-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-pe-gray-800">Analysis Complete</h2>
            <p className="text-pe-gray-600 mt-1">
              Household analysis for {config.state ? US_STATES[config.state] : 'selected state'}
            </p>
          </div>
        </div>
      </div>

      {/* Headline Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Net Income Change"
          value={`${net_income_change >= 0 ? '+' : ''}$${Math.abs(net_income_change).toLocaleString()}`}
          subtext="Annual"
          color={net_income_change >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="Percent Change"
          value={`${percent_income_change >= 0 ? '+' : ''}${percent_income_change.toFixed(1)}%`}
          subtext="Household income"
          color={percent_income_change >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          label="CTC Change"
          value={`${results.ctc_change >= 0 ? '+' : ''}$${Math.abs(results.ctc_change).toLocaleString()}`}
          subtext="Child Tax Credit"
          color="blue"
        />
        <MetricCard
          label="Poverty Status"
          value={poverty_status_change === 'lifted' ? 'Lifted' : poverty_status_change === 'fell_into' ? 'Fell Into' : 'Unchanged'}
          subtext={poverty_status_change === 'lifted' ? 'Out of poverty' : poverty_status_change === 'fell_into' ? 'Into poverty' : 'No change'}
          color={poverty_status_change === 'lifted' ? 'green' : poverty_status_change === 'fell_into' ? 'red' : 'gray'}
        />
      </div>

      {/* Comparison Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Baseline vs Reform Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pe-gray-100">
                <th className="text-left py-3 px-4 text-pe-gray-500 font-medium">Metric</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Baseline</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Reform</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Net Income" baseline={baselineHH.net_income} reform={reform.net_income} format="currency" />
              <ComparisonRow label="Federal CTC" baseline={baselineHH.federal_ctc} reform={reform.federal_ctc} format="currency" />
              <ComparisonRow label="Federal EITC" baseline={baselineHH.federal_eitc} reform={reform.federal_eitc} format="currency" />
              <ComparisonRow label="State CTC" baseline={baselineHH.state_ctc} reform={reform.state_ctc} format="currency" />
              <ComparisonRow label="State EITC" baseline={baselineHH.state_eitc} reform={reform.state_eitc} format="currency" />
              <ComparisonRow label="SNAP Benefits" baseline={baselineHH.snap_benefits} reform={reform.snap_benefits} format="currency" />
              <ComparisonRow label="Total Benefits" baseline={baselineHH.total_benefits} reform={reform.total_benefits} format="currency" />
              <ComparisonRow label="Federal Tax" baseline={baselineHH.federal_income_tax} reform={reform.federal_income_tax} format="currency" invertColor />
              <ComparisonRow label="Effective Tax Rate" baseline={baselineHH.effective_tax_rate * 100} reform={reform.effective_tax_rate * 100} format="percent" invertColor />
            </tbody>
          </table>
        </div>
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
// STATEWIDE ANALYSIS COMPONENTS
// ============================================================================

function StatewideOverviewTab({
  config,
  results
}: {
  config: ReportConfig;
  results: AnalysisResponse;
}) {
  const { poverty_impact, fiscal_cost, distributional_impact } = results;

  // Budget chart data
  const budgetData = [
    {
      name: 'Net Cost',
      value: fiscal_cost.total_cost_billions,
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="card" style={{ borderLeft: `4px solid ${COLORS.primary}` }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.primary}20` }}>
            <svg className="w-6 h-6" style={{ color: COLORS.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-pe-gray-800">Statewide Analysis Complete</h2>
            <p className="text-pe-gray-600 mt-1">
              {results.reform_name} • {config.state ? US_STATES[config.state] : 'State'} • {config.year}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">State Revenue Impact</p>
          <p className="text-2xl font-bold" style={{ color: fiscal_cost.state_cost_billions > 0 ? COLORS.negative : COLORS.positive }}>
            {fiscal_cost.state_cost_billions > 0 ? '-' : '+'}{formatBillions(Math.abs(fiscal_cost.state_cost_billions))}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Annual state cost</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Child Poverty Change</p>
          <p className="text-2xl font-bold" style={{ color: poverty_impact.child_poverty_percent_change < 0 ? COLORS.positive : COLORS.negative }}>
            {formatPercentWithSign(poverty_impact.child_poverty_percent_change)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Relative reduction</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.positive}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Children Lifted</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
            {poverty_impact.children_lifted_out_of_poverty.toLocaleString()}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Out of poverty</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Households Gaining</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
            {formatPercent(distributional_impact.percent_gaining)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Of all households</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Key Statistics</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: COLORS.primary }}>Poverty Reduction</h4>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">Child poverty rate change</span>
              <span className="font-medium" style={{ color: COLORS.positive }}>
                {poverty_impact.child_poverty_change_pp.toFixed(2)}pp
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">Young child poverty change</span>
              <span className="font-medium" style={{ color: COLORS.positive }}>
                {poverty_impact.young_child_poverty_change_pp.toFixed(2)}pp
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-pe-gray-600">Deep poverty change</span>
              <span className="font-medium" style={{ color: COLORS.positive }}>
                {poverty_impact.deep_poverty_change_pp.toFixed(2)}pp
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: COLORS.primary }}>State Fiscal Impact</h4>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">State revenue impact</span>
              <span className="font-medium" style={{ color: fiscal_cost.state_cost_billions > 0 ? COLORS.negative : COLORS.positive }}>
                {fiscal_cost.state_cost_billions > 0 ? '-' : '+'}{formatBillions(Math.abs(fiscal_cost.state_cost_billions))}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">State CTC cost</span>
              <span className="font-medium">{formatBillions(fiscal_cost.state_ctc_cost_billions)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-pe-gray-600">Cost per child lifted</span>
              <span className="font-medium">{formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: COLORS.primary }}>Distribution</h4>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">Average gain (all)</span>
              <span className="font-medium" style={{ color: COLORS.positive }}>
                {formatCurrencyWithSign(distributional_impact.average_gain_all)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-pe-gray-100">
              <span className="text-pe-gray-600">Bottom 50% gain</span>
              <span className="font-medium" style={{ color: COLORS.positive }}>
                {formatCurrencyWithSign(distributional_impact.average_gain_bottom_50)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-pe-gray-600">Gini coefficient change</span>
              <span className="font-medium" style={{ color: distributional_impact.gini_change < 0 ? COLORS.positive : COLORS.negative }}>
                {distributional_impact.gini_change < 0 ? '' : '+'}{distributional_impact.gini_change.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatewidePovertyTab({
  config,
  results
}: {
  config: ReportConfig;
  results: AnalysisResponse;
}) {
  const { poverty_impact } = results;

  // Chart data for poverty rates comparison
  const povertyRateData = [
    {
      name: 'Child (0-17)',
      baseline: poverty_impact.baseline_child_poverty_rate * 100,
      reform: poverty_impact.reform_child_poverty_rate * 100,
    },
    {
      name: 'Young Child (0-5)',
      baseline: poverty_impact.baseline_young_child_poverty_rate * 100,
      reform: poverty_impact.reform_young_child_poverty_rate * 100,
    },
    {
      name: 'Deep Poverty',
      baseline: poverty_impact.baseline_deep_child_poverty_rate * 100,
      reform: poverty_impact.reform_deep_child_poverty_rate * 100,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Children Lifted - Hero Section */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card p-8 text-center" style={{ background: `linear-gradient(135deg, ${COLORS.primary}10, ${COLORS.primary}05)`, borderColor: COLORS.primary }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${COLORS.primary}20` }}>
            <svg className="w-8 h-8" style={{ color: COLORS.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <p className="text-4xl font-bold mb-2" style={{ color: COLORS.primary }}>
            {poverty_impact.children_lifted_out_of_poverty.toLocaleString()}
          </p>
          <p className="text-lg font-medium text-pe-gray-700">Children lifted out of poverty</p>
          <p className="text-sm text-pe-gray-500 mt-1">Ages 0-17</p>
        </div>

        <div className="card p-8 text-center" style={{ background: `linear-gradient(135deg, ${COLORS.primaryDark}10, ${COLORS.primaryDark}05)`, borderColor: COLORS.primaryDark }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${COLORS.primaryDark}20` }}>
            <svg className="w-8 h-8" style={{ color: COLORS.primaryDark }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-4xl font-bold mb-2" style={{ color: COLORS.primaryDark }}>
            {poverty_impact.young_children_lifted_out_of_poverty.toLocaleString()}
          </p>
          <p className="text-lg font-medium text-pe-gray-700">Young children lifted out of poverty</p>
          <p className="text-sm text-pe-gray-500 mt-1">Ages 0-5</p>
        </div>
      </div>

      {/* Poverty Rate Comparison Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">Poverty Rate Changes</h3>
        <p className="text-sm text-pe-gray-500 mb-6">Baseline vs. Reform poverty rates by age group</p>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={povertyRateData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                domain={[0, 'auto']}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#6B7280', fontSize: 12 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span style={{ color: '#4B5563' }}>{value}</span>}
              />
              <Bar dataKey="baseline" name="Baseline" fill={COLORS.baseline} radius={[0, 4, 4, 0]} />
              <Bar dataKey="reform" name="Reform" fill={COLORS.reform} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Detailed Poverty Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2" style={{ borderColor: COLORS.primary }}>
                <th className="text-left py-3 px-4 text-pe-gray-500 font-medium">Metric</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Baseline</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Reform</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Change (pp)</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">% Change</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-pe-gray-100 hover:bg-pe-gray-50">
                <td className="py-4 px-4 text-pe-gray-700 font-medium">Child Poverty Rate (0-17)</td>
                <td className="py-4 px-4 text-right text-pe-gray-600">{(poverty_impact.baseline_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-semibold" style={{ color: COLORS.primary }}>{(poverty_impact.reform_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-medium" style={{ color: COLORS.positive }}>{poverty_impact.child_poverty_change_pp.toFixed(2)}</td>
                <td className="py-4 px-4 text-right font-medium" style={{ color: COLORS.positive }}>{poverty_impact.child_poverty_percent_change.toFixed(1)}%</td>
              </tr>
              <tr className="border-b border-pe-gray-100 hover:bg-pe-gray-50">
                <td className="py-4 px-4 text-pe-gray-700 font-medium">Young Child Poverty (0-5)</td>
                <td className="py-4 px-4 text-right text-pe-gray-600">{(poverty_impact.baseline_young_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-semibold" style={{ color: COLORS.primary }}>{(poverty_impact.reform_young_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-medium" style={{ color: COLORS.positive }}>{poverty_impact.young_child_poverty_change_pp.toFixed(2)}</td>
                <td className="py-4 px-4 text-right font-medium" style={{ color: COLORS.positive }}>{poverty_impact.young_child_poverty_percent_change.toFixed(1)}%</td>
              </tr>
              <tr className="hover:bg-pe-gray-50">
                <td className="py-4 px-4 text-pe-gray-700 font-medium">Deep Child Poverty</td>
                <td className="py-4 px-4 text-right text-pe-gray-600">{(poverty_impact.baseline_deep_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-semibold" style={{ color: COLORS.primary }}>{(poverty_impact.reform_deep_child_poverty_rate * 100).toFixed(2)}%</td>
                <td className="py-4 px-4 text-right font-medium" style={{ color: COLORS.positive }}>{poverty_impact.deep_poverty_change_pp.toFixed(2)}</td>
                <td className="py-4 px-4 text-right text-pe-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatewideFiscalTab({
  config,
  results
}: {
  config: ReportConfig;
  results: AnalysisResponse;
}) {
  const { fiscal_cost } = results;

  // Focus on state-level costs only
  const stateCostBreakdown = [
    { name: 'State CTC', value: fiscal_cost.state_ctc_cost_billions },
    { name: 'State EITC', value: fiscal_cost.eitc_cost_billions * 0.3 }, // Approximate state share
    { name: 'Other State Programs', value: fiscal_cost.state_cost_billions - fiscal_cost.state_ctc_cost_billions },
  ].filter(item => Math.abs(item.value) > 0.001);

  // Chart data for state cost breakdown
  const chartData = stateCostBreakdown.map(item => ({
    name: item.name,
    value: item.value,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Card - State Revenue Impact */}
      <div className="card p-6" style={{ borderLeft: `4px solid ${COLORS.primary}` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-pe-gray-500 mb-1">State Revenue Impact</p>
            <p className="text-4xl font-bold" style={{ color: fiscal_cost.state_cost_billions > 0 ? COLORS.negative : COLORS.positive }}>
              {fiscal_cost.state_cost_billions > 0 ? '-' : '+'}{formatBillions(Math.abs(fiscal_cost.state_cost_billions))}
            </p>
            <p className="text-sm text-pe-gray-500 mt-1">per year</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-pe-gray-500">Cost per child lifted</p>
            <p className="text-2xl font-semibold" style={{ color: COLORS.primary }}>
              {formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty)}
            </p>
          </div>
        </div>
      </div>

      {/* State Cost Breakdown Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">State Cost Breakdown</h3>
          <p className="text-sm text-pe-gray-500 mb-6">Annual state revenue impact by program</p>

          <div style={{ height: `${Math.max(200, chartData.length * 60)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatBillions(v)}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  width={130}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: number) => [formatBillions(value), 'State Cost']}
                />
                <ReferenceLine x={0} stroke="#9CA3AF" />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.value >= 0 ? COLORS.negative : COLORS.positive}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* State Cost Metrics */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">State CTC Cost</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.negative }}>
            {formatBillions(fiscal_cost.state_ctc_cost_billions)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Annual</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Cost Per Child Lifted</p>
          <p className="text-2xl font-bold text-pe-gray-800">
            {formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Out of poverty</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.primary}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Cost Per Child (All)</p>
          <p className="text-2xl font-bold text-pe-gray-800">
            {formatCurrency(fiscal_cost.cost_per_child)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Average across all children</p>
        </div>
      </div>

      {/* State Revenue Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">State Revenue Summary</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-4 border-b border-pe-gray-100">
            <div>
              <p className="text-pe-gray-700 font-medium">Total State Revenue Impact</p>
              <p className="text-sm text-pe-gray-500">Annual cost to state budget</p>
            </div>
            <p className="text-3xl font-bold" style={{ color: fiscal_cost.state_cost_billions > 0 ? COLORS.negative : COLORS.positive }}>
              {fiscal_cost.state_cost_billions > 0 ? '-' : '+'}{formatBillions(Math.abs(fiscal_cost.state_cost_billions))}
            </p>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-pe-gray-100">
            <div>
              <p className="text-pe-gray-700 font-medium">State CTC Program</p>
              <p className="text-sm text-pe-gray-500">State Child Tax Credit costs</p>
            </div>
            <p className="text-xl font-semibold" style={{ color: COLORS.negative }}>
              {formatBillions(fiscal_cost.state_ctc_cost_billions)}
            </p>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-pe-gray-700 font-medium">Cost Effectiveness</p>
              <p className="text-sm text-pe-gray-500">State cost per child lifted from poverty</p>
            </div>
            <p className="text-xl font-semibold" style={{ color: COLORS.primary }}>
              {formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatewideDistributionalTab({
  config,
  results
}: {
  config: ReportConfig;
  results: AnalysisResponse;
}) {
  const { distributional_impact } = results;

  // Prepare decile chart data
  const decileChartData = distributional_impact.decile_impacts.map((decile) => ({
    name: `${decile.decile}`,
    value: decile.average_gain,
    percentGaining: decile.percent_gaining,
  }));

  // Calculate max absolute value for symmetric axis
  const maxAbsValue = Math.max(
    ...distributional_impact.decile_impacts.map(d => Math.abs(d.average_gain)),
    100
  );

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.positive}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Households Gaining</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
            {formatPercent(distributional_impact.percent_gaining)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Of all households</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.positive}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Average Gain (All)</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
            {formatCurrencyWithSign(distributional_impact.average_gain_all)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Per household</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${COLORS.positive}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Bottom 50% Gain</p>
          <p className="text-2xl font-bold" style={{ color: COLORS.positive }}>
            {formatCurrencyWithSign(distributional_impact.average_gain_bottom_50)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">Average gain</p>
        </div>

        <div className="card p-5" style={{ borderTop: `3px solid ${distributional_impact.gini_change < 0 ? COLORS.positive : COLORS.negative}` }}>
          <p className="text-sm text-pe-gray-500 mb-1">Gini Coefficient Change</p>
          <p className="text-2xl font-bold" style={{ color: distributional_impact.gini_change < 0 ? COLORS.positive : COLORS.negative }}>
            {distributional_impact.gini_change < 0 ? '' : '+'}{distributional_impact.gini_change.toFixed(4)}
          </p>
          <p className="text-xs text-pe-gray-400 mt-1">{distributional_impact.gini_change < 0 ? 'More equal' : 'Less equal'}</p>
        </div>
      </div>

      {/* Decile Impact Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">Impact by Income Decile</h3>
        <p className="text-sm text-pe-gray-500 mb-6">Average annual income change by household income decile</p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={decileChartData}
              margin={{ top: 20, right: 30, left: 60, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#6B7280', fontSize: 12 }}
                label={{ value: 'Income Decile', position: 'bottom', offset: 0, fill: '#6B7280', fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatCurrencyWithSign(v)}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                domain={[-maxAbsValue * 0.1, maxAbsValue * 1.1]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'value') return [formatCurrencyWithSign(value), 'Average change'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Decile ${label}`}
              />
              <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {decileChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.value >= 0 ? COLORS.positive : COLORS.negative}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-pe-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.positive }}></div>
            <span className="text-sm text-pe-gray-600">Gain</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.negative }}></div>
            <span className="text-sm text-pe-gray-600">Loss</span>
          </div>
        </div>
      </div>

      {/* Distribution Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Share of Benefits</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-pe-gray-600">Bottom 20%</span>
                <span className="font-semibold" style={{ color: COLORS.primary }}>
                  {distributional_impact.share_to_bottom_20_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-pe-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: COLORS.primary,
                    width: `${Math.min(100, distributional_impact.share_to_bottom_20_pct)}%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-pe-gray-600">Bottom 50%</span>
                <span className="font-semibold" style={{ color: COLORS.primary }}>
                  {distributional_impact.share_to_bottom_50_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-pe-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: COLORS.primary,
                    width: `${Math.min(100, distributional_impact.share_to_bottom_50_pct)}%`
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-pe-gray-600">Top 20%</span>
                <span className="font-semibold text-pe-gray-600">
                  {distributional_impact.share_to_top_20_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-pe-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pe-gray-400 rounded-full"
                  style={{ width: `${Math.min(100, distributional_impact.share_to_top_20_pct)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-pe-gray-600">Top 10%</span>
                <span className="font-semibold text-pe-gray-600">
                  {distributional_impact.share_to_top_10_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-pe-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pe-gray-400 rounded-full"
                  style={{ width: `${Math.min(100, distributional_impact.share_to_top_10_pct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Inequality Impact</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-pe-gray-100">
              <div>
                <p className="text-pe-gray-600">Baseline Gini</p>
                <p className="text-xs text-pe-gray-400">Before reform</p>
              </div>
              <p className="text-2xl font-bold text-pe-gray-800">
                {distributional_impact.baseline_gini.toFixed(4)}
              </p>
            </div>
            <div className="flex items-center justify-between py-4 border-b border-pe-gray-100">
              <div>
                <p className="text-pe-gray-600">Reform Gini</p>
                <p className="text-xs text-pe-gray-400">After reform</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: COLORS.primary }}>
                {distributional_impact.reform_gini.toFixed(4)}
              </p>
            </div>
            <div className="flex items-center justify-between py-4">
              <div>
                <p className="text-pe-gray-600 font-medium">Net Change</p>
                <p className="text-xs text-pe-gray-400">
                  {distributional_impact.gini_change < 0 ? 'Inequality reduced' : 'Inequality increased'}
                </p>
              </div>
              <p className="text-2xl font-bold" style={{ color: distributional_impact.gini_change < 0 ? COLORS.positive : COLORS.negative }}>
                {distributional_impact.gini_change < 0 ? '' : '+'}{distributional_impact.gini_change.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decile Details Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Detailed Decile Impacts</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2" style={{ borderColor: COLORS.primary }}>
                <th className="text-left py-3 px-4 text-pe-gray-500 font-medium">Decile</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">Average Change</th>
                <th className="text-right py-3 px-4 text-pe-gray-500 font-medium">% Gaining</th>
              </tr>
            </thead>
            <tbody>
              {distributional_impact.decile_impacts.map((decile, index) => (
                <tr key={decile.decile} className={`border-b border-pe-gray-100 hover:bg-pe-gray-50 ${index === 0 ? 'bg-pe-gray-25' : ''}`}>
                  <td className="py-3 px-4 text-pe-gray-700 font-medium">
                    Decile {decile.decile}
                    {decile.decile === 1 && <span className="text-xs text-pe-gray-400 ml-2">(Lowest income)</span>}
                    {decile.decile === 10 && <span className="text-xs text-pe-gray-400 ml-2">(Highest income)</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold" style={{ color: decile.average_gain >= 0 ? COLORS.positive : COLORS.negative }}>
                    {formatCurrencyWithSign(decile.average_gain)}
                  </td>
                  <td className="py-3 px-4 text-right text-pe-gray-600">
                    {decile.percent_gaining.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
