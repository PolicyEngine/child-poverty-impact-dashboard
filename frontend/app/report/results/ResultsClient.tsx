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
import { SHARE_PARAM, decodeReportConfig, encodeReportConfig, shareUrl } from '@/lib/share-link';
import { US_STATES } from '@/lib/household-types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
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
// household step was filled in); compare is shown when 2+ states were
// selected; the rest are statewide and always run.
type TabKey =
  | 'household'
  | 'compare'
  | 'overview'
  | 'poverty'
  | 'fiscal'
  | 'distributional';

interface ReportConfig {
  /** Multi-state wizards persist a list; legacy reports (and any old
   *  sessionStorage values still around) used a singular field. We accept
   *  both and canonicalise to states[]. */
  states?: string[];
  state?: string | null;
  populationType: 'household' | 'statewide';
  household: HouseholdInput | null;
  selectedReforms: string[];
  /** Human-readable labels for the selected reforms (with their configured
   *  parameter values), built by the wizard so the results header can show
   *  the actual reform instead of just a count. */
  reformLabels?: string[];
  year: number;
  parameterValues?: Record<string, Record<string, number>>;
}

/** One-line description of the household example (e.g. "Single, Age 23,
 *  Child 1 Age 5, Child 2 Age 8, Employment income $40,000"). The first
 *  word of each comma-separated segment is capitalized. */
/** Copies the deep link for the current report to the clipboard. The URL
 *  already carries the encoded config; this is the explicit affordance. */
function ShareButton({ config }: { config: ReportConfig | null }) {
  const [copied, setCopied] = useState(false);
  if (!config) return null;
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(shareUrl(config));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be unavailable (permissions, http); the URL bar
          // still carries the same link.
        }
      }}
    >
      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {copied ? 'Link copied!' : 'Share'}
    </button>
  );
}

function householdSummary(h: HouseholdInput): string {
  const parts: string[] = [];
  const filing = h.filing_status?.startsWith('married') ? 'married' : 'single';
  const ages = (h.adults ?? []).map((a) => a.age);
  parts.push(filing);
  if (ages.length) parts.push(`age ${ages.join(' & ')}`);
  (h.children ?? []).forEach((c, i) => parts.push(`child ${i + 1} Age ${c.age}`));
  parts.push(`employment income $${(h.income?.employment_income ?? 0).toLocaleString()}`);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
}

function normaliseStates(c: ReportConfig): string[] {
  if (c.states && c.states.length > 0) return c.states;
  if (c.state) return [c.state];
  return [];
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

const COMPARE_TAB: TabConfig = {
  key: 'compare',
  label: 'Compare',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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

  // Config lives in sessionStorage and is only readable in the browser.
  // Load it in a layout effect so the tab shell paints on the very next
  // commit, with no hydration mismatch against the SSR'd HTML.
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configReady, setConfigReady] = useState(false);

  const states = config ? normaliseStates(config) : [];
  const isCompareMode = states.length >= 2;
  const primaryState: string | null = states.length >= 1 ? states[0] : null;

  const showHouseholdTab =
    !!config &&
    !isCompareMode &&
    config.populationType === 'household' &&
    !!config.household;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Per-leg results, loading, and errors. Each tab owns its own state so a
  // slow or failed leg doesn't block the rest of the page.
  const [householdResults, setHouseholdResults] = useState<HouseholdImpact | null>(null);
  const [baselineResults, setBaselineResults] = useState<HouseholdResults | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);

  const [incomeSweep, setIncomeSweep] = useState<IncomeSweepResponse | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepError, setSweepError] = useState<string | null>(null);

  // Single-state mode: this holds the only state's microsimulation result.
  // Multi-state mode: it holds the *primary* state's result so the existing
  // Overview/Poverty/Fiscal/Distributional tabs keep working (they show
  // the first selected state's deep dive). The Compare tab consumes
  // comparisonResults to render the cross-state view.
  const [statewideResults, setStatewideResults] = useState<AnalysisResponse | null>(null);
  const [statewideError, setStatewideError] = useState<string | null>(null);

  const [comparisonResults, setComparisonResults] = useState<Record<string, AnalysisResponse>>({});
  const [comparisonErrors, setComparisonErrors] = useState<Record<string, string>>({});

  // Read config on the client: the URL deep link (?c=…) wins so shared
  // links work in a fresh browser; sessionStorage is the same-tab fallback
  // for older flows. Whichever source supplies it, the URL ends up carrying
  // the encoded config so the address bar is always shareable.
  useEffect(() => {
    const adopt = (parsed: ReportConfig): boolean => {
      const parsedStates = normaliseStates(parsed);
      if (parsedStates.length === 0) return false;
      setConfig(parsed);
      if (parsedStates.length >= 2) {
        setActiveTab('compare');
      } else if (parsed.populationType === 'household' && parsed.household) {
        setActiveTab('household');
      }
      return true;
    };

    const encoded = new URLSearchParams(window.location.search).get(SHARE_PARAM);
    if (encoded) {
      const fromUrl = decodeReportConfig<ReportConfig>(encoded);
      if (fromUrl && adopt(fromUrl)) {
        // Same-tab navigation elsewhere (e.g. "New Report") keeps working
        // off sessionStorage, so mirror the shared config into it.
        sessionStorage.setItem('reportConfig', JSON.stringify(fromUrl));
        setConfigReady(true);
        return;
      }
      // A malformed link falls through to sessionStorage before erroring.
    }

    const stored = sessionStorage.getItem('reportConfig');
    if (!stored) {
      setConfigError(
        encoded
          ? 'This share link could not be read. Please ask for a fresh link.'
          : 'No report configuration found. Please start a new report.',
      );
      setConfigReady(true);
      return;
    }
    try {
      const parsed: ReportConfig = JSON.parse(stored);
      if (adopt(parsed)) {
        // Direct navigation without ?c=: put the encoded config in the URL
        // so copying the address bar shares this exact report.
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}?${SHARE_PARAM}=${encodeReportConfig(parsed)}`,
        );
      } else {
        setConfigError('Invalid report configuration. Please start a new report.');
      }
    } catch {
      setConfigError('Could not read report configuration. Please start a new report.');
    } finally {
      setConfigReady(true);
    }
  }, []);

  // Kick off the async legs once we have config. Each leg writes to its own
  // state so the tab shell stays interactive while they fly.
  useEffect(() => {
    if (!config) return;

    const extractMessage = (err: unknown): string => {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      return e?.response?.data?.detail || e?.message || 'Unknown error';
    };

    // Fire one Modal job per state in parallel. Single-state reports
    // effectively run a one-element loop, which keeps the code path the
    // same for both modes. The primary state's result also populates
    // statewideResults so the existing single-state tabs keep working.
    states.forEach((stateCode, index) => {
      runAnalysisFromOptions(
        stateCode,
        config.year,
        config.selectedReforms,
        config.parameterValues,
      )
        .then((results) => {
          setComparisonResults((m) => ({ ...m, [stateCode]: results }));
          if (index === 0) setStatewideResults(results);
        })
        .catch((err: unknown) => {
          console.error(`Analysis failed for ${stateCode}:`, err);
          const message = extractMessage(err);
          setComparisonErrors((m) => ({ ...m, [stateCode]: message }));
          if (index === 0) setStatewideError(message);
        });
    });

    // Household analysis only runs in single-state mode — a household has
    // one state of residence, so multi-state comparison skips it.
    if (
      !isCompareMode &&
      config.populationType === 'household' &&
      config.household
    ) {
      Promise.all([
        calculateBaseline(config.household),
        calculateImpact(
          config.household,
          config.selectedReforms,
          config.parameterValues,
        ),
      ])
        .then(([baseline, impact]) => {
          setBaselineResults(baseline);
          setHouseholdResults(impact);
        })
        .catch((err: unknown) => {
          console.error('Household analysis failed:', err);
          setHouseholdError(extractMessage(err));
        });

      setSweepLoading(true);
      setSweepError(null);
      runIncomeSweep(
        config.household,
        config.selectedReforms,
        0,
        400_000,
        500,
        config.parameterValues,
      )
        .then((sweep) => setIncomeSweep(sweep))
        .catch((err: unknown) => {
          console.warn('Income sweep failed:', err);
          setSweepError(extractMessage(err));
        })
        .finally(() => setSweepLoading(false));
    }
  }, [config]);

  // configReady distinguishes "haven't hit useEffect yet" from "loaded and
  // confirmed missing". Before configReady, render the tab shell so SSR
  // and the first client commit produce the same HTML.
  if (configReady && configError) {
    return <ErrorState error={configError} />;
  }
  if (configReady && !config) {
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
                {!config
                  ? 'Loading report…'
                  : isCompareMode
                  ? `${states.length} states • Comparison • ${config.selectedReforms.length} reform(s)`
                  : `${primaryState ? US_STATES[primaryState] : 'Analysis'} • ${config.populationType === 'statewide' ? 'Statewide' : 'Household'}`}
              </p>
              {config && (
                <div className="mt-3 space-y-2">
                  {config.reformLabels && config.reformLabels.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-pe-gray-500">
                        Reform:
                      </span>
                      {config.reformLabels.map((label, i) => (
                        <span
                          key={i}
                          className="text-xs bg-pe-teal-50 text-pe-teal-700 border border-pe-teal-200 px-2.5 py-1 rounded-full"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : config.selectedReforms.length === 0 ? (
                    <span className="text-xs text-pe-gray-500">
                      No reform selected — baseline only
                    </span>
                  ) : null}
                  {config.populationType === 'household' && config.household && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-pe-gray-500">
                        Household:
                      </span>
                      <span className="text-xs bg-pe-teal-50 text-pe-teal-700 border border-pe-teal-200 px-2.5 py-1 rounded-full">
                        {householdSummary(config.household)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
            <ShareButton config={config} />
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
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-pe-gray-100 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1">
            {(isCompareMode
              ? [COMPARE_TAB, ...TABS]
              : showHouseholdTab
              ? [HOUSEHOLD_TAB, ...TABS]
              : TABS
            ).map((tab) => (
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
        {activeTab === 'compare' && isCompareMode ? (
          <CompareTab
            states={states}
            results={comparisonResults}
            errors={comparisonErrors}
            year={config!.year}
            reformCount={config!.selectedReforms.length}
          />
        ) : activeTab === 'household' && showHouseholdTab ? (
          householdResults ? (
            <HouseholdOverviewTab
              config={config!}
              results={householdResults}
              baseline={baselineResults}
              incomeSweep={incomeSweep}
              sweepLoading={sweepLoading}
              sweepError={sweepError}
            />
          ) : householdError ? (
            <TabError message={householdError} />
          ) : (
            <TabSkeleton
              title="Computing household impact"
              hint="Calling PolicyEngine for baseline and reform — usually under 30 seconds."
            />
          )
        ) : activeTab === 'overview' ? (
          statewideResults ? (
            <StatewideOverview
              results={statewideResults}
              state={primaryState}
              year={config!.year}
            />
          ) : statewideError ? (
            <TabError message={statewideError} />
          ) : (
            <TabSkeleton
              title="Computing statewide impact"
              hint="Running the microsimulation on Modal — this can take a few minutes."
            />
          )
        ) : activeTab === 'poverty' ? (
          statewideResults ? (
            <StatewidePoverty
              results={statewideResults}
              state={primaryState}
              year={config!.year}
            />
          ) : statewideError ? (
            <TabError message={statewideError} />
          ) : (
            <TabSkeleton
              title="Computing poverty impact"
              hint="Running the microsimulation on Modal — this can take a few minutes."
            />
          )
        ) : activeTab === 'fiscal' ? (
          statewideResults ? (
            <StatewideFiscal
              results={statewideResults}
              state={primaryState}
              year={config!.year}
            />
          ) : statewideError ? (
            <TabError message={statewideError} />
          ) : (
            <TabSkeleton
              title="Computing fiscal impact"
              hint="Running the microsimulation on Modal — this can take a few minutes."
            />
          )
        ) : activeTab === 'distributional' ? (
          statewideResults ? (
            <StatewideDistributional
              results={statewideResults}
              state={primaryState}
              year={config!.year}
            />
          ) : statewideError ? (
            <TabError message={statewideError} />
          ) : (
            <TabSkeleton
              title="Computing distributional impact"
              hint="Running the microsimulation on Modal — this can take a few minutes."
            />
          )
        ) : null}
      </div>
    </div>
  );
}

// Inline skeleton shown inside a tab while its data is still computing.
// Keeps the tab shell and other tabs interactive instead of blocking the
// whole page on a single Modal call.
function TabSkeleton({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div
            className="absolute inset-0 rounded-full border-4"
            style={{ borderColor: `${COLORS.primary}30` }}
          />
          <div
            className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: COLORS.primary, borderTopColor: 'transparent' }}
          />
        </div>
        <div>
          <p className="font-semibold text-pe-gray-800">{title}</p>
          <p className="text-sm text-pe-gray-500">{hint}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-28 animate-pulse bg-pe-gray-50" />
        ))}
      </div>
      <div className="card h-80 animate-pulse bg-pe-gray-50" />
    </div>
  );
}

// Per-tab error — replaces the page-level error state so one failing leg
// (statewide or household) doesn't take down the rest of the report.
function TabError({ message }: { message: string }) {
  return (
    <div className="card border-red-200 bg-red-50">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="text-red-800 font-semibold text-sm">Analysis failed for this tab</h3>
          <p className="text-red-600 text-sm mt-0.5 break-words">{message}</p>
        </div>
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

// Benefit provisions surfaced as change cards on the household overview. The
// isolated dependent-exemption change is rendered separately after this list,
// since it is derived from a dedicated sub-reform rather than a per-field delta.
const PROVISION_FIELDS: {
  key: 'federal_ctc' | 'federal_eitc' | 'state_ctc' | 'state_eitc' | 'snap_benefits';
  label: string;
}[] = [
  { key: 'federal_ctc', label: 'Federal CTC' },
  { key: 'federal_eitc', label: 'Federal EITC' },
  { key: 'state_ctc', label: 'State CTC + Child Allowance' },
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
  /** Isolated dependent-exemption portion of the state income-tax change
   *  (baseline state tax − dependent-only state tax). Positive when the
   *  exemption is raised, negative when shrunk/eliminated, keeping the sign
   *  convention of the benefit rows above. */
  dependent_exemption_change: number;
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
          <span>State CTC + Child Allowance</span>
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
        <div className="flex justify-between gap-3">
          <span>Dependent exemption</span>
          <span>{fmt(p.dependent_exemption_change)}</span>
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
        state_ctc_change:
          (r.state_ctc + (r.child_allowance ?? 0)) -
          (b.state_ctc + (b.child_allowance ?? 0)),
        state_eitc_change: r.state_eitc - b.state_eitc,
        snap_change: r.snap_benefits - b.snap_benefits,
        // Already an isolated baseline−reform delta from the backend; use the
        // reform point's value directly rather than differencing the series.
        dependent_exemption_change: r.dependent_exemption_change ?? 0,
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

      {/* Per-provision change cards, plus dependent-exemption and net-income cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVISION_FIELDS.map(({ key, label }) => {
          // State CTC card also includes the child allowance (basic income).
          const reformVal =
            (reform[key] as number) +
            (key === 'state_ctc' ? reform.child_allowance ?? 0 : 0);
          const baseVal =
            (baselineHH[key] as number) +
            (key === 'state_ctc' ? baselineHH.child_allowance ?? 0 : 0);
          return (
            <ChangeCard key={key} label={label} change={reformVal - baseVal} />
          );
        })}
        <ChangeCard
          label="Dependent exemption"
          change={reform.dependent_exemption_change ?? 0}
        />
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
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
              <Tooltip content={<NetIncomeChangeTooltip />} />
              <Line
                type="monotone"
                dataKey="dependent_exemption_change"
                stroke={COLORS.baseline}
                strokeWidth={2}
                dot={false}
                name="Dependent exemption change"
              />
              <Line
                type="monotone"
                dataKey="net_income_change"
                stroke={COLORS.primary}
                strokeWidth={2.5}
                dot={false}
                name="Net income change"
              />
            </LineChart>
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
    {
      name: 'State CTC + Child Allowance',
      baseline: baseline.state_ctc + (baseline.child_allowance ?? 0),
      reform: reform.state_ctc + (reform.child_allowance ?? 0),
    },
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

// ============================================================================
// COMPARE TAB - Cross-state comparison rendered when 2+ states are selected
// ============================================================================

type CompareSortKey = 'poverty_pp' | 'poverty_pct' | 'cost' | 'effectiveness';

interface CompareRow {
  state: string;
  povertyChangePp: number;
  povertyPercentChange: number;
  baselineRate: number;
  reformRate: number;
  childrenLifted: number;
  costBillions: number;
  costPerChild: number;
  costPerChildLifted: number;
}

function CompareTab({
  states,
  results,
  errors,
  year,
  reformCount,
}: {
  states: string[];
  results: Record<string, AnalysisResponse>;
  errors: Record<string, string>;
  year: number;
  reformCount: number;
}) {
  const [sortBy, setSortBy] = useState<CompareSortKey>('poverty_pp');

  const rows: CompareRow[] = states
    .filter((s) => results[s])
    .map((s) => {
      const r = results[s];
      const pov = r.poverty_impact;
      const fisc = r.fiscal_cost;
      return {
        state: s,
        povertyChangePp: pov.child_poverty_change_pp,
        povertyPercentChange: pov.child_poverty_percent_change,
        baselineRate: pov.baseline_child_poverty_rate,
        reformRate: pov.reform_child_poverty_rate,
        childrenLifted: pov.children_lifted_out_of_poverty,
        costBillions: fisc.total_cost_billions,
        costPerChild: fisc.cost_per_child,
        costPerChildLifted: fisc.cost_per_child_lifted_from_poverty,
      };
    });

  // Lower (more negative) poverty change is better; lower cost is "cheaper"
  // but the natural ranking the page user wants is by impact, so poverty
  // sorts ascending (most negative = biggest reduction first) and cost
  // descending (most expensive first). Effectiveness shows cost-per-child-
  // lifted ascending (cheapest reduction first).
  const sortedRows = [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'poverty_pp':
        return a.povertyChangePp - b.povertyChangePp;
      case 'poverty_pct':
        return a.povertyPercentChange - b.povertyPercentChange;
      case 'cost':
        return b.costBillions - a.costBillions;
      case 'effectiveness':
        return (
          (a.costPerChildLifted || Number.POSITIVE_INFINITY) -
          (b.costPerChildLifted || Number.POSITIVE_INFINITY)
        );
    }
  });

  const pending = states.filter((s) => !results[s] && !errors[s]);
  const failed = states.filter((s) => errors[s]);
  const completedCount = rows.length;

  const sortLabels: Record<CompareSortKey, string> = {
    poverty_pp: 'Child poverty change (pp)',
    poverty_pct: 'Child poverty change (%)',
    cost: 'Total cost',
    effectiveness: 'Cost per child lifted',
  };

  // Bar chart domain: symmetric around zero so positive/negative bars are
  // visually comparable. Skip the chart entirely until at least one state
  // is back so we don't render with an empty axis.
  const chartData = sortedRows.map((r) => ({
    state: r.state,
    value: r.povertyChangePp,
  }));
  const maxAbs = Math.max(
    1e-6,
    ...chartData.map((d) => Math.abs(d.value)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: COLORS.primary }}>
          State comparison
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {reformCount} reform(s) • {year} • {states.length} states selected
          {pending.length > 0 ? ` • ${pending.length} still computing` : ''}
        </p>
      </div>

      {/* Status: still-loading + failed states */}
      {(pending.length > 0 || failed.length > 0) && (
        <div className="card bg-pe-gray-50/60 space-y-2">
          {pending.length > 0 && (
            <p className="text-sm text-pe-gray-600">
              Still computing: {pending.join(', ')}
            </p>
          )}
          {failed.length > 0 && (
            <div className="text-sm text-red-700">
              <p className="font-medium">Failed:</p>
              <ul className="ml-5 list-disc">
                {failed.map((s) => (
                  <li key={s}>
                    <span className="font-mono">{s}</span> — {errors[s]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {completedCount === 0 ? (
        <TabSkeleton
          title="Computing comparison"
          hint={`Running ${states.length} parallel microsimulations on Modal — usually a few minutes each.`}
        />
      ) : (
        <>
          {/* Headline chart: child poverty change (pp) per state */}
          <div className="card">
            <h3 className="text-lg font-semibold text-pe-gray-800">
              Child poverty change (percentage points) by state
            </h3>
            <p className="text-sm text-pe-gray-500 mb-4">
              Negative bars = poverty reduced; positive bars = poverty
              increased. Sorted by current ranking below.
            </p>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 28 + 60)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  domain={[-maxAbs, maxAbs]}
                  tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
                  stroke="#6B7280"
                />
                <YAxis dataKey="state" type="category" stroke="#6B7280" width={48} />
                <ReferenceLine x={0} stroke="#9CA3AF" />
                <Tooltip
                  formatter={(v: number) => [
                    `${v >= 0 ? '+' : ''}${v.toFixed(3)} pp`,
                    'Child poverty change',
                  ]}
                  cursor={{ fill: 'rgba(49,151,149,0.06)' }}
                />
                <Bar dataKey="value">
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.value < 0 ? COLORS.primary : COLORS.negative}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-lg font-semibold text-pe-gray-800">
                Per-state results
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-pe-gray-500">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CompareSortKey)}
                  className="border border-pe-gray-200 rounded px-2 py-1 text-sm text-pe-gray-700 bg-white"
                >
                  {(Object.entries(sortLabels) as [CompareSortKey, string][]).map(
                    ([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-pe-gray-500 border-b border-pe-gray-100">
                    <th className="py-2 pr-4 font-medium">State</th>
                    <th className="py-2 pr-4 font-medium text-right">Baseline child poverty</th>
                    <th className="py-2 pr-4 font-medium text-right">Reform child poverty</th>
                    <th className="py-2 pr-4 font-medium text-right">Change (pp)</th>
                    <th className="py-2 pr-4 font-medium text-right">Children lifted</th>
                    <th className="py-2 pr-4 font-medium text-right">Total cost</th>
                    <th className="py-2 pr-4 font-medium text-right">Cost / child lifted</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.state} className="border-b border-pe-gray-50">
                      <td className="py-2 pr-4 font-semibold text-pe-gray-800">
                        {US_STATES[r.state] ?? r.state}
                      </td>
                      <td className="py-2 pr-4 text-right text-pe-gray-600">
                        {(r.baselineRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4 text-right text-pe-gray-600">
                        {(r.reformRate * 100).toFixed(1)}%
                      </td>
                      <td
                        className="py-2 pr-4 text-right font-medium"
                        style={{
                          color:
                            r.povertyChangePp < 0
                              ? COLORS.primary
                              : r.povertyChangePp > 0
                              ? '#B91C1C'
                              : '#6B7280',
                        }}
                      >
                        {r.povertyChangePp >= 0 ? '+' : ''}
                        {r.povertyChangePp.toFixed(3)}
                      </td>
                      <td className="py-2 pr-4 text-right text-pe-gray-700">
                        {Math.round(r.childrenLifted).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-pe-gray-700">
                        {formatBillions(r.costBillions)}
                      </td>
                      <td className="py-2 pr-4 text-right text-pe-gray-700">
                        {r.costPerChildLifted > 0 && Number.isFinite(r.costPerChildLifted)
                          ? `$${Math.round(r.costPerChildLifted).toLocaleString()}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-pe-gray-400 mt-3">
              The Overview / Poverty / Budgetary / Distributional tabs show
              the deep dive for {sortedRows[0] ? US_STATES[sortedRows[0].state] : '—'} (first selected
              state).
            </p>
          </div>
        </>
      )}
    </div>
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
