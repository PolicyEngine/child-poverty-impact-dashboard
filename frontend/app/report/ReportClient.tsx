'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HouseholdForm from '@/components/HouseholdForm';
import ReformOptionsSelector from '@/components/ReformOptionsSelector';
import type {
  HouseholdInput,
  StateReformOptions,
  StatePrograms,
} from '@/lib/household-types';
import type { ParameterValues } from '@/components/ReformOptionsSelector';
import { US_STATES } from '@/lib/household-types';
import {
  getStatePrograms,
  getReformOptions,
} from '@/lib/household-api';

// RCC-style flow: pick a state + year, pick a reform, then optionally
// specify a household example (or skip and go straight to the statewide
// impacts). The Review step from the old flow is gone — the wizard now
// hands off to the results page as soon as the user clicks Run.
type Step = 'state' | 'reform' | 'household';
type PopulationType = 'household' | 'statewide';

interface ReportConfig {
  /** One or more states. A single state behaves like the original wizard;
   *  two or more flips the results page into compare mode. */
  states: string[];
  /** When the user skips the household step, populationType is 'statewide'
   *  and household stays null. The results page uses that to hide the
   *  Household tab. Household analysis is only available in single-state
   *  mode since a household has one state of residence. */
  populationType: PopulationType;
  household: HouseholdInput | null;
  selectedReforms: string[];
  parameterValues: ParameterValues;
  year: number | null;
}

// Available years for analysis. Limited to 2026–2028 for now: the per-state
// datasets are calibrated for these years, and the modelled reforms (e.g. the
// 2027 RI CTC, the NY credit reversion at 2028) are all covered. Extend to
// 2029–2030 once those years are calibrated.
const AVAILABLE_YEARS = [2026, 2027, 2028];

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  {
    key: 'state',
    label: 'Location',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'reform',
    label: 'Reform',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    key: 'household',
    label: 'Household (optional)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function ReportBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('state');
  const [config, setConfig] = useState<ReportConfig>({
    states: [],
    populationType: 'household',
    household: null,
    selectedReforms: [],
    parameterValues: {},
    year: null,
  });

  // Convenience: when one state is selected, treat it as "the" state for
  // single-state UI elements (household step, reform options).
  const primaryState: string | null =
    config.states.length === 1 ? config.states[0] : null;
  const isMultiState = config.states.length >= 2;

  // State data
  const [statePrograms, setStatePrograms] = useState<StatePrograms | null>(null);
  const [reformOptions, setReformOptions] = useState<StateReformOptions | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  // Running state
  const [isRunning, setIsRunning] = useState(false);

  // Animation
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch state data when the primary state changes. In multi-state mode
  // we still pull options for the first selected state — the reform editor
  // is configured to hide state-specific reforms then, so only federal
  // options end up rendered.
  useEffect(() => {
    const lookupState = primaryState ?? config.states[0];
    if (!lookupState) return;

    const fetchStateData = async () => {
      setLoadingState(true);
      try {
        const [programs, options] = await Promise.all([
          getStatePrograms(lookupState),
          getReformOptions(lookupState, config.year ?? 2026),
        ]);
        setStatePrograms(programs);
        setReformOptions(options);
      } catch (err) {
        console.error('Error fetching state data:', err);
      } finally {
        setLoadingState(false);
      }
    };

    fetchStateData();
  }, [primaryState, config.states, config.year]);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const handleReformChange = (selectedReforms: string[]) => {
    setConfig(c => ({ ...c, selectedReforms }));
  };

  const handleParameterChange = (optionId: string, paramName: string, value: number) => {
    setConfig(c => ({
      ...c,
      parameterValues: {
        ...c.parameterValues,
        [optionId]: {
          ...(c.parameterValues[optionId] || {}),
          [paramName]: value,
        },
      },
    }));
  };

  /** Persist the config and hand off to the results page. The optional
   *  `householdOverride` argument lets the household step pass the
   *  freshly-submitted household form without waiting for setConfig's
   *  setState to flush. */
  const handleRunReport = async (overrides?: {
    skipHousehold?: boolean;
    household?: HouseholdInput;
  }) => {
    setIsRunning(true);
    const skipHousehold = overrides?.skipHousehold ?? false;
    const householdOverride = overrides?.household ?? null;
    const populationType: PopulationType = skipHousehold
      ? 'statewide'
      : 'household';
    const household = skipHousehold ? null : householdOverride ?? config.household;

    // Human-readable labels for the selected reforms (name + the parameter
    // values the user set), so the results header shows the actual reform.
    const allOptions = reformOptions
      ? [
          ...reformOptions.ctc_options,
          ...reformOptions.eitc_options,
          ...reformOptions.snap_options,
          ...reformOptions.child_allowance_options,
          ...reformOptions.federal_options,
        ]
      : [];
    // $ goes in front of the amount ($600, not 600$); other units suffix (50%).
    const fmtValue = (val: number, unit: string) =>
      unit === '$' ? `$${val.toLocaleString()}` : `${val}${unit}`;
    const reformLabels = config.selectedReforms.map((id) => {
      const opt = allOptions.find((o) => o.id === id);
      const name = opt?.name ?? id;
      const pv = config.parameterValues?.[id];
      const params = (opt?.adjustable_params ?? [])
        .filter((p) => pv?.[p.name] !== undefined && p.control !== 'toggle')
        .map((p) => {
          const cur = pv![p.name];
          // Show the change from current law when the user moved it
          // (e.g. "Match rate 40% → 50%"), otherwise just the value.
          const value =
            cur !== p.default_value
              ? `${fmtValue(p.default_value, p.unit)} → ${fmtValue(cur, p.unit)}`
              : fmtValue(cur, p.unit);
          return `${p.label} ${value}`;
        });
      return params.length ? `${name} — ${params.join(', ')}` : name;
    });

    const payload = {
      ...config,
      populationType,
      household,
      reformLabels,
    };
    sessionStorage.setItem('reportConfig', JSON.stringify(payload));
    router.push('/report/results');
  };

  const canProceedToHousehold = config.selectedReforms.length > 0;

  return (
    <div className="min-h-screen bg-pe-gray-50/30">
      {/* Header */}
      <div className="bg-white border-b border-pe-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Link href="/" className="text-pe-gray-500 hover:text-pe-teal-600 text-sm mb-2 inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
            <h1 className="text-2xl font-bold text-pe-gray-900 tracking-tight">
              Build Report
            </h1>
            <p className="text-pe-gray-500 mt-1">
              Configure your analysis step by step
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b border-pe-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            {STEPS.map((s, index) => {
              const isActive = s.key === step;
              const isCompleted = index < currentStepIndex;
              const isClickable = index <= currentStepIndex;

              return (
                <button
                  key={s.key}
                  onClick={() => isClickable && setStep(s.key)}
                  disabled={!isClickable}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-pe-teal-50 text-pe-teal-700'
                      : isCompleted
                        ? 'text-pe-teal-600 hover:bg-pe-teal-50 cursor-pointer'
                        : 'text-pe-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-pe-teal-500 text-white'
                      : isCompleted
                        ? 'bg-pe-teal-100 text-pe-teal-600'
                        : 'bg-pe-gray-100 text-pe-gray-400'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <span className="font-medium hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Step 1: State & Year Selection */}
          {step === 'state' && (
            <div className="space-y-6">
              {/* State Selection */}
              <div className="card">
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-pe-gray-800">Select state</h2>
                  <p className="text-pe-gray-500 mt-1">
                    Pick the state for this report.
                  </p>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-4">
                  {Object.entries(US_STATES).map(([code, name]) => {
                    const selected = config.states[0] === code;
                    const select = () =>
                      setConfig((c) => ({ ...c, states: [code] }));
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={select}
                        title={name}
                        aria-pressed={selected}
                        className={`flex items-center justify-center p-2 rounded-lg border cursor-pointer transition-all hover:border-pe-teal-300 hover:bg-pe-teal-50 ${
                          selected
                            ? 'border-pe-teal-500 bg-pe-teal-50 text-pe-teal-700'
                            : 'border-pe-gray-200 text-pe-gray-700'
                        }`}
                      >
                        <span className="font-semibold text-sm">{code}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-pe-gray-500 mt-3">
                  {config.states.length === 0
                    ? 'No state selected.'
                    : `${US_STATES[config.states[0]]} — single-state report.`}
                </p>
              </div>

              {/* Year Selection */}
              <div className="card">
                <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Select Analysis Year</h2>
                <p className="text-pe-gray-500 mb-6">
                  Choose the tax year for the policy analysis.
                </p>

                <div className="flex flex-wrap gap-3">
                  {AVAILABLE_YEARS.map((year) => (
                    <button
                      key={year}
                      onClick={() => setConfig(c => ({ ...c, year }))}
                      className={`px-6 py-3 rounded-lg border text-center transition-all hover:border-pe-teal-300 hover:bg-pe-teal-50 ${
                        config.year === year
                          ? 'border-pe-teal-500 bg-pe-teal-50 text-pe-teal-700'
                          : 'border-pe-gray-200 text-pe-gray-700'
                      }`}
                    >
                      <span className="font-semibold">{year}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Continue Button */}
              {(() => {
                const missing: string[] = [];
                if (config.states.length === 0) missing.push('state');
                if (!config.year) missing.push('year');
                const canContinue = missing.length === 0;
                const missingLabel =
                  missing.length === 2
                    ? 'Select at least one state and a year to continue.'
                    : missing.includes('state')
                    ? 'Select at least one state to continue.'
                    : missing.includes('year')
                    ? 'Select a year to continue.'
                    : '';

                return (
                  <div className="flex justify-end items-center gap-4">
                    {!canContinue && (
                      <p
                        role="status"
                        className="text-sm text-pe-gray-500"
                      >
                        {missingLabel}
                      </p>
                    )}
                    <button
                      onClick={() => canContinue && setStep('reform')}
                      disabled={!canContinue}
                      aria-disabled={!canContinue}
                      title={canContinue ? undefined : missingLabel}
                      className="btn btn-primary"
                    >
                      Continue
                      <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 2: Reform Selection */}
          {step === 'reform' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">
                  Select reform options
                </h2>
                <p className="text-pe-gray-500 mb-6">
                  Choose one or more policy reforms to analyze.
                </p>

                <ReformOptionsSelector
                  stateCode={config.states[0] || 'CA'}
                  statePrograms={statePrograms || undefined}
                  reformOptions={reformOptions || undefined}
                  selectedOptions={config.selectedReforms}
                  onSelectionChange={handleReformChange}
                  parameterValues={config.parameterValues}
                  onParameterChange={handleParameterChange}
                  isLoading={loadingState}
                />

                <div className="flex justify-between items-center mt-8 pt-6 border-t border-pe-gray-100">
                  <button onClick={() => setStep('state')} className="btn btn-ghost">
                    Back
                  </button>
                  <button
                    onClick={() =>
                      isMultiState
                        ? handleRunReport({ skipHousehold: true })
                        : setStep('household')
                    }
                    disabled={!canProceedToHousehold || isRunning}
                    className="btn btn-primary"
                  >
                    {isMultiState ? 'Run comparison' : 'Continue'}
                    <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Optional household example */}
          {step === 'household' && (
            <div className="space-y-6">
              <div className="card bg-pe-teal-50 border-pe-teal-200">
                <h2 className="text-xl font-semibold text-pe-teal-800">
                  Add a household example (optional)
                </h2>
                <p className="text-sm text-pe-teal-700 mt-1">
                  Specify a household to also see how the reform affects that
                  family's net income, CTC, EITC, and SNAP. Skip to go
                  straight to the statewide impacts — the microsimulation
                  always runs.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleRunReport({ skipHousehold: true })}
                    disabled={isRunning}
                    className="btn btn-secondary"
                  >
                    Skip and run statewide only
                  </button>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">
                  Household details
                </h3>
                <HouseholdForm
                  initialValues={
                    config.household
                      ? {
                          ...config.household,
                          state: primaryState || 'CA',
                          year: config.year ?? config.household.year,
                        }
                      : ({
                          state: primaryState || 'CA',
                          year: config.year ?? 2026,
                        } as HouseholdInput)
                  }
                  onSubmit={(household) => {
                    setConfig((c) => ({ ...c, household }));
                    handleRunReport({ skipHousehold: false, household });
                  }}
                  isLoading={isRunning}
                  submitLabel="Run analysis"
                />
              </div>

              <div>
                <button onClick={() => setStep('reform')} className="btn btn-ghost">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
