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

type Step = 'state' | 'population' | 'reform' | 'review';
type PopulationType = 'household' | 'statewide';

interface ReportConfig {
  state: string | null;
  populationType: PopulationType;
  household: HouseholdInput | null;
  selectedReforms: string[];
  parameterValues: ParameterValues;
  year: number;
}

// Available years for analysis
const AVAILABLE_YEARS = [2023, 2024, 2025, 2026, 2027, 2028];

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
    key: 'population',
    label: 'Population',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
    key: 'review',
    label: 'Review',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function ReportBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('state');
  const [config, setConfig] = useState<ReportConfig>({
    state: null,
    populationType: 'household',
    household: null,
    selectedReforms: [],
    parameterValues: {},
    year: 2025,
  });

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

  // Fetch state data when state changes
  useEffect(() => {
    if (!config.state) return;

    const fetchStateData = async () => {
      setLoadingState(true);
      try {
        const [programs, options] = await Promise.all([
          getStatePrograms(config.state!),
          getReformOptions(config.state!),
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
  }, [config.state]);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const handlePopulationSelect = (type: PopulationType, household?: HouseholdInput) => {
    setConfig(c => ({ ...c, populationType: type, household: household || null }));
    setStep('reform');
  };

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

  const handleRunReport = async () => {
    setIsRunning(true);
    // Store config in sessionStorage for results page
    sessionStorage.setItem('reportConfig', JSON.stringify(config));
    // Navigate to results
    router.push('/report/results');
  };

  const canProceedToReview = config.selectedReforms.length > 0;

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
                <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Select a State</h2>
                <p className="text-pe-gray-500 mb-6">
                  Choose the state to analyze reform impacts for.
                </p>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {Object.entries(US_STATES).map(([code, name]) => (
                    <button
                      key={code}
                      onClick={() => setConfig(c => ({ ...c, state: code }))}
                      title={name}
                      className={`p-3 rounded-lg border text-center transition-all hover:border-pe-teal-300 hover:bg-pe-teal-50 ${
                        config.state === code
                          ? 'border-pe-teal-500 bg-pe-teal-50 text-pe-teal-700'
                          : 'border-pe-gray-200 text-pe-gray-700'
                      }`}
                    >
                      <span className="font-semibold text-sm">{code}</span>
                    </button>
                  ))}
                </div>
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
              <div className="flex justify-end">
                <button
                  onClick={() => config.state && setStep('population')}
                  disabled={!config.state}
                  className="btn btn-primary"
                >
                  Continue
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Population Selection */}
          {step === 'population' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Select Population Type</h2>
                <p className="text-pe-gray-500 mb-6">
                  Choose whether to analyze an individual household or the entire state population.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfig(c => ({ ...c, populationType: 'household' }))}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      config.populationType === 'household'
                        ? 'border-pe-teal-500 bg-pe-teal-50'
                        : 'border-pe-gray-200 hover:border-pe-teal-300'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-pe-teal-100 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">Individual Household</h3>
                    <p className="text-sm text-pe-gray-500">
                      Enter specific household details to see personalized impact calculations.
                    </p>
                  </button>

                  <button
                    onClick={() => setConfig(c => ({ ...c, populationType: 'statewide' }))}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      config.populationType === 'statewide'
                        ? 'border-pe-teal-500 bg-pe-teal-50'
                        : 'border-pe-gray-200 hover:border-pe-teal-300'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-pe-teal-100 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">Statewide Population</h3>
                    <p className="text-sm text-pe-gray-500">
                      Run microsimulation to estimate aggregate impacts across the entire state.
                    </p>
                  </button>
                </div>
              </div>

              {config.populationType === 'household' && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-pe-gray-800 mb-4">Household Details</h3>
                  <HouseholdForm
                    initialValues={config.household ? { ...config.household, state: config.state || 'CA' } : { state: config.state || 'CA' } as HouseholdInput}
                    onSubmit={(household) => handlePopulationSelect('household', household)}
                    isLoading={false}
                    submitLabel="Continue to Reform Selection"
                  />
                </div>
              )}

              {config.populationType === 'statewide' && (
                <div className="card bg-pe-teal-50 border-pe-teal-200">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-pe-teal-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-pe-teal-800">
                        Statewide Analysis for {config.state ? US_STATES[config.state] : 'Selected State'} ({config.year})
                      </h4>
                      <p className="text-sm text-pe-teal-700 mt-1">
                        This will run a microsimulation using the Enhanced CPS dataset to estimate
                        poverty reduction, fiscal costs, and distributional impacts for tax year {config.year}.
                      </p>
                      <button
                        onClick={() => handlePopulationSelect('statewide')}
                        className="btn btn-primary mt-4"
                      >
                        Continue to Reform Selection
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Reform Selection */}
          {step === 'reform' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-pe-gray-800 mb-2">Select Reform Options</h2>
              <p className="text-pe-gray-500 mb-6">
                Choose one or more policy reforms to analyze. Reforms can be combined.
              </p>

              <ReformOptionsSelector
                stateCode={config.state || 'CA'}
                statePrograms={statePrograms || undefined}
                reformOptions={reformOptions || undefined}
                selectedOptions={config.selectedReforms}
                onSelectionChange={handleReformChange}
                parameterValues={config.parameterValues}
                onParameterChange={handleParameterChange}
                isLoading={loadingState}
              />

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-pe-gray-100">
                <button
                  onClick={() => setStep('population')}
                  className="btn btn-ghost"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => setStep('review')}
                  disabled={!canProceedToReview}
                  className="btn btn-primary"
                >
                  Continue to Review
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-xl font-semibold text-pe-gray-800 mb-6">Review Your Report</h2>

                <div className="space-y-4">
                  {/* State & Year */}
                  <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pe-teal-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-pe-gray-500">Location & Year</p>
                        <p className="font-semibold text-pe-gray-800">
                          {config.state ? US_STATES[config.state] : 'Not selected'}, {config.year}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setStep('state')} className="text-pe-teal-600 text-sm hover:underline">
                      Edit
                    </button>
                  </div>

                  {/* Population */}
                  <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pe-teal-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-pe-gray-500">Population</p>
                        <p className="font-semibold text-pe-gray-800">
                          {config.populationType === 'household'
                            ? `Household: ${config.household?.adults.length || 0} adult(s), ${config.household?.children.length || 0} child(ren)`
                            : 'Statewide microsimulation'}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setStep('population')} className="text-pe-teal-600 text-sm hover:underline">
                      Edit
                    </button>
                  </div>

                  {/* Reforms */}
                  <div className="flex items-center justify-between p-4 bg-pe-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pe-teal-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-pe-gray-500">Reforms Selected</p>
                        <p className="font-semibold text-pe-gray-800">
                          {config.selectedReforms.length} reform(s)
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setStep('reform')} className="text-pe-teal-600 text-sm hover:underline">
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Run Button */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStep('reform')}
                  className="btn btn-ghost"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={handleRunReport}
                  disabled={isRunning}
                  className="btn btn-primary btn-lg"
                >
                  {isRunning ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Running Analysis...
                    </>
                  ) : (
                    <>
                      Run Report
                      <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
