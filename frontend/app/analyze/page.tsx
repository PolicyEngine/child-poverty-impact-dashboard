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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Child Poverty Impact Dashboard</h1>
        <p className="text-gray-600">
          Enter your household details and explore how policy reforms could affect your family
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={() => setMode('household')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'household'
                ? 'bg-white shadow text-policyengine-blue'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Household Analysis
          </button>
          <button
            onClick={() => setMode('statewide')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'statewide'
                ? 'bg-white shadow text-policyengine-blue'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Statewide Impact
          </button>
        </div>
      </div>

      {mode === 'household' ? (
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column - Household Form */}
          <div className="lg:col-span-4 space-y-6">
            <HouseholdForm
              initialValues={household || undefined}
              onSubmit={handleHouseholdSubmit}
              isLoading={calculating}
            />
          </div>

          {/* Middle Column - Reform Options */}
          <div className="lg:col-span-3">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Policy Reforms</h2>
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
            {error && (
              <div className="card bg-red-50 border border-red-200">
                <h3 className="text-red-700 font-semibold mb-2">Error</h3>
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <HouseholdResultsDisplay
              baseline={baseline || undefined}
              impact={impact || undefined}
              isLoading={calculating}
            />

            {/* Income Sweep Charts */}
            {incomeSweepData && (
              <div className="space-y-4">
                {/* Chart Type Selector */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'net_income', label: 'Net Income' },
                    { id: 'benefits', label: 'Benefits Breakdown' },
                    { id: 'tax_rate', label: 'Tax Rate' },
                    { id: 'breakdown', label: 'Overview' },
                  ].map((chart) => (
                    <button
                      key={chart.id}
                      onClick={() => setChartView(chart.id as ChartView)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        chartView === chart.id
                          ? 'bg-policyengine-blue text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
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
          </div>
        </div>
      ) : (
        /* Statewide Analysis Mode */
        <div className="card text-center py-12">
          <h3 className="text-xl font-semibold mb-4">Statewide Impact Analysis</h3>
          <p className="text-gray-600 mb-6">
            Analyze how policy reforms would affect child poverty rates across the entire state
            population.
          </p>
          <p className="text-sm text-gray-400">
            This feature uses microsimulation to estimate aggregate impacts on child poverty,
            fiscal costs, and distributional effects.
          </p>
          <div className="mt-8 text-gray-400">Coming soon...</div>
        </div>
      )}
    </div>
  );
}
