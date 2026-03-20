'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { calculateImpact, calculateBaseline } from '@/lib/household-api';
import type { HouseholdInput, HouseholdImpact, HouseholdResults } from '@/lib/household-types';
import { US_STATES } from '@/lib/household-types';

// Tab types
type TabKey = 'overview' | 'poverty' | 'fiscal' | 'distributional';

interface ReportConfig {
  state: string | null;
  populationType: 'household' | 'statewide';
  household: HouseholdInput | null;
  selectedReforms: string[];
  year: number;
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
        } else {
          // Statewide analysis - for now show placeholder
          // TODO: Implement statewide analysis endpoint
          setError('Statewide analysis coming soon. Please try household analysis.');
        }
      } catch (err) {
        console.error('Error running analysis:', err);
        setError('Failed to run analysis. Please try again.');
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

  if (!config || !householdResults) {
    return <ErrorState error="No results available" />;
  }

  return (
    <div className="min-h-screen bg-pe-gray-50/30">
      {/* Header */}
      <div className="bg-white border-b border-pe-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <Link href="/report" className="text-pe-gray-500 hover:text-pe-teal-600 text-sm mb-2 inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                New Report
              </Link>
              <h1 className="text-2xl font-bold text-pe-gray-900 tracking-tight">
                Report Results
              </h1>
              <p className="text-pe-gray-500 mt-1">
                {config.state ? US_STATES[config.state] : 'Analysis'} &bull; {config.selectedReforms.length} reform(s) selected
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
                className={`flex items-center gap-2 px-4 py-4 border-b-2 font-medium transition-all ${
                  activeTab === tab.key
                    ? 'border-pe-teal-500 text-pe-teal-600'
                    : 'border-transparent text-pe-gray-500 hover:text-pe-gray-700 hover:border-pe-gray-300'
                }`}
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
        {activeTab === 'overview' && (
          <OverviewTab
            config={config}
            results={householdResults}
            baseline={baselineResults}
          />
        )}
        {activeTab === 'poverty' && (
          <PovertyTab
            config={config}
            results={householdResults}
          />
        )}
        {activeTab === 'fiscal' && (
          <FiscalTab
            config={config}
            results={householdResults}
          />
        )}
        {activeTab === 'distributional' && (
          <DistributionalTab
            config={config}
            results={householdResults}
          />
        )}
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
          <div className="absolute inset-0 rounded-full border-4 border-pe-teal-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-pe-teal-500 border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Running Analysis</h2>
        <p className="text-pe-gray-500">Calculating policy impacts...</p>
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
          className="btn btn-primary"
        >
          Start New Report
        </button>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({
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
              {config.populationType === 'household'
                ? `Household analysis for ${config.state ? US_STATES[config.state] : 'selected state'}`
                : `Statewide microsimulation for ${config.state ? US_STATES[config.state] : 'selected state'}`}
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

// Poverty Tab
function PovertyTab({
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
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">In Poverty</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                baseline.in_poverty
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {baseline.in_poverty ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">In Deep Poverty</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                baseline.in_deep_poverty
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {baseline.in_deep_poverty ? 'Yes' : 'No'}
              </span>
            </div>
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
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">In Poverty</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                reform.in_poverty
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {reform.in_poverty ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
              <span className="text-pe-gray-600">In Deep Poverty</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                reform.in_deep_poverty
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {reform.in_deep_poverty ? 'Yes' : 'No'}
              </span>
            </div>
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
              poverty_status_change === 'lifted'
                ? 'bg-green-100'
                : 'bg-red-100'
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
              <h3 className={`font-semibold ${
                poverty_status_change === 'lifted'
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}>
                {poverty_status_change === 'lifted'
                  ? 'Household Lifted Out of Poverty'
                  : 'Household Fell Into Poverty'}
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

      {/* Income Details */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Income Analysis</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 bg-pe-gray-50 rounded-lg text-center">
            <p className="text-sm text-pe-gray-500 mb-1">Gross Income</p>
            <p className="text-2xl font-bold text-pe-gray-800">${baseline.gross_income.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-pe-gray-50 rounded-lg text-center">
            <p className="text-sm text-pe-gray-500 mb-1">Baseline Net Income</p>
            <p className="text-2xl font-bold text-pe-gray-800">${baseline.net_income.toLocaleString()}</p>
          </div>
          <div className="p-4 bg-pe-teal-50 rounded-lg text-center">
            <p className="text-sm text-pe-teal-600 mb-1">Reform Net Income</p>
            <p className="text-2xl font-bold text-pe-teal-700">${reform.net_income.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fiscal Tab
function FiscalTab({
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

  const taxChanges = [
    { name: 'Federal Income Tax', baseline: baseline.federal_income_tax, reform: reform.federal_income_tax },
    { name: 'State Income Tax', baseline: baseline.state_income_tax, reform: reform.state_income_tax },
    { name: 'Payroll Tax', baseline: baseline.payroll_tax, reform: reform.payroll_tax },
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

      {/* Tax Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Tax Breakdown</h3>
        <div className="space-y-3">
          {taxChanges.map((item) => {
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
                    change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-pe-gray-400'
                  }`}>
                    {change > 0 ? '+' : ''}{change !== 0 ? `$${Math.abs(change).toLocaleString()}` : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Effective Tax Rate */}
      <div className="card bg-pe-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-pe-gray-800">Effective Tax Rate</h3>
            <p className="text-sm text-pe-gray-500 mt-1">Including all taxes and benefits</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-pe-gray-500">
              {(baseline.effective_tax_rate * 100).toFixed(1)}% &rarr;
            </p>
            <p className="text-2xl font-bold text-pe-teal-600">
              {(reform.effective_tax_rate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Distributional Tab (placeholder for household - more relevant for statewide)
function DistributionalTab({
  config,
  results
}: {
  config: ReportConfig;
  results: HouseholdImpact;
}) {
  if (config.populationType === 'household') {
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

  // TODO: Implement statewide distributional display
  return null;
}

// Helper Components
function MetricCard({
  label,
  value,
  subtext,
  color = 'gray'
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-pe-gray-50 text-pe-gray-700',
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]}`}>
      <p className="text-sm opacity-75 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs opacity-60 mt-1">{subtext}</p>}
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
