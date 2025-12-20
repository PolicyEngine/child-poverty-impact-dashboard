'use client';

import { useState, useEffect } from 'react';
import HouseholdForm from '@/components/HouseholdForm';
import ReformOptionsSelector from '@/components/ReformOptionsSelector';
import HouseholdResultsDisplay from '@/components/HouseholdResultsDisplay';
import IncomeSweepChart from '@/components/IncomeSweepChart';
import type {
  HouseholdInput,
  HouseholdResults,
  HouseholdImpact,
  StateReformOptions,
  StatePrograms,
  IncomeSweepDataPoint,
} from '@/lib/household-types';
import {
  getStatePrograms,
  getReformOptions,
  calculateBaseline,
  calculateImpact,
  runIncomeSweep,
} from '@/lib/household-api';

type AnalysisMode = 'household' | 'statewide';
type ChartView = 'net_income' | 'benefits' | 'tax_rate' | 'breakdown';

export default function AnalyzePage() {
  const [mode, setMode] = useState<AnalysisMode>('household');
  const [chartView, setChartView] = useState<ChartView>('net_income');

  // Household state
  const [household, setHousehold] = useState<HouseholdInput | null>(null);
  const [selectedReforms, setSelectedReforms] = useState<string[]>([]);

  // State data
  const [statePrograms, setStatePrograms] = useState<StatePrograms | null>(null);
  const [reformOptions, setReformOptions] = useState<StateReformOptions | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  // Results
  const [baseline, setBaseline] = useState<HouseholdResults | null>(null);
  const [impact, setImpact] = useState<HouseholdImpact | null>(null);
  const [incomeSweepData, setIncomeSweepData] = useState<IncomeSweepDataPoint[] | null>(null);
  const [reformSweepData, setReformSweepData] = useState<IncomeSweepDataPoint[] | null>(null);

  // Loading/error states
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current state for fetching reform options
  const [currentState, setCurrentState] = useState<string>('CA');

  // Page load animation
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch state programs and reform options when state changes
  useEffect(() => {
    const fetchStateData = async () => {
      setLoadingState(true);
      try {
        const [programs, options] = await Promise.all([
          getStatePrograms(currentState),
          getReformOptions(currentState),
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
  }, [currentState]);

  // Handle household form submission
  const handleHouseholdSubmit = async (householdInput: HouseholdInput) => {
    setHousehold(householdInput);
    setCurrentState(householdInput.state);
    setCalculating(true);
    setError(null);

    try {
      // Calculate baseline
      const baselineResult = await calculateBaseline(householdInput);
      setBaseline(baselineResult);

      // Run income sweep for baseline
      const sweepResult = await runIncomeSweep(householdInput);
      setIncomeSweepData(sweepResult.data_points);

      // If reforms are selected, calculate impact
      if (selectedReforms.length > 0) {
        const impactResult = await calculateImpact(householdInput, selectedReforms);
        setImpact(impactResult);

        // Run income sweep with reforms
        const reformSweep = await runIncomeSweep(householdInput, selectedReforms);
        setReformSweepData(reformSweep.data_points);
      } else {
        setImpact(null);
        setReformSweepData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCalculating(false);
    }
  };

  // Handle reform selection changes
  const handleReformChange = async (newSelectedReforms: string[]) => {
    setSelectedReforms(newSelectedReforms);

    // If we have a household, recalculate with new reforms
    if (household && baseline) {
      setCalculating(true);
      setError(null);

      try {
        if (newSelectedReforms.length > 0) {
          const impactResult = await calculateImpact(household, newSelectedReforms);
          setImpact(impactResult);

          const reformSweep = await runIncomeSweep(household, newSelectedReforms);
          setReformSweepData(reformSweep.data_points);
        } else {
          setImpact(null);
          setReformSweepData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setCalculating(false);
      }
    }
  };

  const chartOptions = [
    { id: 'net_income', label: 'Net Income', icon: '📈' },
    { id: 'benefits', label: 'Benefits', icon: '💰' },
    { id: 'tax_rate', label: 'Tax Rate', icon: '📊' },
    { id: 'breakdown', label: 'Overview', icon: '🔍' },
  ];

  return (
    <div className="min-h-screen bg-pe-gray-50/30">
      {/* Header Section */}
      <div className="bg-white border-b border-pe-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div
            className={`transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-pe-gray-900 tracking-tight">
                  Policy Impact Analysis
                </h1>
                <p className="text-pe-gray-500 mt-1">
                  Enter household details and explore how policy reforms could affect your family
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="tab-group">
                <button
                  onClick={() => setMode('household')}
                  className={`tab ${mode === 'household' ? 'tab-active' : ''}`}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Household
                </button>
                <button
                  onClick={() => setMode('statewide')}
                  className={`tab ${mode === 'statewide' ? 'tab-active' : ''}`}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Statewide
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {mode === 'household' ? (
          <div
            className={`grid lg:grid-cols-12 gap-6 transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            {/* Left Column - Household Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="card">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-pe-teal-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-pe-gray-800">Your Household</h2>
                    <p className="text-xs text-pe-gray-500">Enter your family details</p>
                  </div>
                </div>
                <HouseholdForm
                  initialValues={household || undefined}
                  onSubmit={handleHouseholdSubmit}
                  isLoading={calculating}
                />
              </div>
            </div>

            {/* Middle Column - Reform Options */}
            <div className="lg:col-span-3">
              <div className="card sticky top-24">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-pe-teal-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-pe-gray-800">Policy Reforms</h2>
                    <p className="text-xs text-pe-gray-500">Select reforms to model</p>
                  </div>
                </div>
                <ReformOptionsSelector
                  stateCode={currentState}
                  statePrograms={statePrograms || undefined}
                  reformOptions={reformOptions || undefined}
                  selectedOptions={selectedReforms}
                  onSelectionChange={handleReformChange}
                  isLoading={loadingState}
                />
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="lg:col-span-5 space-y-6">
              {/* Error Display */}
              {error && (
                <div className="card bg-red-50 border-red-200">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-red-800 font-semibold text-sm">Error</h3>
                      <p className="text-red-600 text-sm mt-0.5">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results Display */}
              <HouseholdResultsDisplay
                baseline={baseline || undefined}
                impact={impact || undefined}
                isLoading={calculating}
              />

              {/* Income Sweep Charts */}
              {incomeSweepData && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pe-teal-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-pe-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-pe-gray-800">Income Analysis</h2>
                        <p className="text-xs text-pe-gray-500">How outcomes change with income</p>
                      </div>
                    </div>
                  </div>

                  {/* Chart Type Selector */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    {chartOptions.map((chart) => (
                      <button
                        key={chart.id}
                        onClick={() => setChartView(chart.id as ChartView)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          chartView === chart.id
                            ? 'bg-pe-teal-500 text-white shadow-sm'
                            : 'bg-pe-gray-100 text-pe-gray-600 hover:bg-pe-gray-200'
                        }`}
                      >
                        <span className="mr-1.5">{chart.icon}</span>
                        {chart.label}
                      </button>
                    ))}
                  </div>

                  <IncomeSweepChart
                    data={incomeSweepData}
                    reformData={reformSweepData || undefined}
                    chartType={chartView}
                    title={`${
                      chartView === 'net_income'
                        ? 'Net Income'
                        : chartView === 'benefits'
                          ? 'Benefits'
                          : chartView === 'tax_rate'
                            ? 'Effective Tax Rate'
                            : 'Income Overview'
                    } by Employment Income`}
                  />
                </div>
              )}

              {/* Empty State */}
              {!baseline && !calculating && (
                <div className="card text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-pe-teal-50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-pe-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-pe-gray-800 mb-2">
                    Ready to analyze
                  </h3>
                  <p className="text-pe-gray-500 text-sm max-w-sm mx-auto">
                    Enter your household details on the left to see how policy reforms could affect your family.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Statewide Analysis Mode */
          <div
            className={`transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="card text-center py-16 max-w-2xl mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-pe-teal-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-pe-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-pe-gray-800 mb-3">
                Statewide Impact Analysis
              </h3>
              <p className="text-pe-gray-500 mb-6 max-w-md mx-auto">
                Analyze how policy reforms would affect child poverty rates across the entire state
                population using microsimulation.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-pe-teal-50 rounded-full">
                <span className="w-2 h-2 rounded-full bg-pe-teal-500 animate-pulse" />
                <span className="text-sm font-medium text-pe-teal-700">Coming soon</span>
              </div>
              <p className="text-xs text-pe-gray-400 mt-6">
                This feature will estimate aggregate impacts on child poverty,
                fiscal costs, and distributional effects.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
