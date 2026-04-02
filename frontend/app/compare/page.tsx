'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useStates, useStateComparison } from '@/hooks/useAnalysis';
import { colors, chartColors } from '@/lib/colors';
import type { ReformRequest, StateInfo } from '@/lib/types';
import type { StateComparisonResponse } from '@/lib/api';

const STATE_COLORS = {
  withCTC: colors.success,
  withoutCTC: colors.blue[500],
  selected: chartColors.primary,
};

export default function ComparePage() {
  const { data: states, isLoading: statesLoading } = useStates();
  const { mutate: compareStates, data: comparison, isPending } = useStateComparison();

  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'poverty' | 'cost' | 'effectiveness'>('poverty');

  // Simple reform for comparison
  const [reformConfig, setReformConfig] = useState({
    ctcAmount: 3600,
    refundable: true,
  });

  const handleRunComparison = () => {
    const reform: ReformRequest = {
      name: 'Expanded CTC',
      description: `$${reformConfig.ctcAmount} CTC`,
      year: 2026,
      states: selectedStates,
      ctc: {
        enabled: true,
        amount_young: reformConfig.ctcAmount,
        amount_older: reformConfig.ctcAmount * 0.83, // 3000/3600 ratio
        age_eligibility: '0_17',
        income_basis: 'agi',
        phaseout_structure: 'asymmetric',
        phaseout_start_single: 75000,
        phaseout_start_joint: 150000,
        phaseout_rate: 0.05,
        refundable: reformConfig.refundable,
        refundable_amount: null,
      },
      eitc: { enabled: false, individualized: false, expansion_percent: 0, childless_expansion: false, age_floor_reduction: 0, age_ceiling_increase: 0 },
      dependent_exemption: { enabled: false, amount_per_dependent: 0, refundable: false, income_limit_single: null, income_limit_joint: null },
      ubi: { enabled: false, amount_per_child: 0, amount_per_adult: 0, age_eligibility: '0_17', phase_out_with_income: false, phaseout_start: 0, phaseout_rate: 0 },
      snap: { enabled: false, benefit_increase_percent: 0, expand_eligibility_percent: 0, remove_asset_test: false, increase_child_allotment: 0 },
      state_ctc: { enabled: false, state: '', amount_young: 0, amount_older: 0, age_eligibility: '0_17', income_limit: null, refundable: true, matches_federal: false, match_percent: 0 },
    };

    compareStates({ reform, states: selectedStates.length > 0 ? selectedStates : undefined });
  };

  const toggleState = (code: string) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
    );
  };

  const selectAll = () => {
    if (states) {
      setSelectedStates(states.map((s) => s.state_code));
    }
  };

  const clearSelection = () => {
    setSelectedStates([]);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Compare States</h1>
        <p className="text-gray-600">
          Analyze how policy reforms affect child poverty across different states
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* State Selection */}
        <div className="card">
          <h3 className="section-title">Select States</h3>

          <div className="flex gap-2 mb-4">
            <button onClick={selectAll} className="btn btn-secondary text-sm">
              Select All
            </button>
            <button onClick={clearSelection} className="btn btn-secondary text-sm">
              Clear
            </button>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>
            States with existing CTC
            <span className="inline-block w-3 h-3 rounded bg-blue-500 ml-4 mr-1"></span>
            States without CTC
          </div>

          {statesLoading ? (
            <div className="text-center py-8">Loading states...</div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {states?.map((state) => (
                <button
                  key={state.state_code}
                  onClick={() => toggleState(state.state_code)}
                  className={`p-2 text-sm rounded border transition-colors ${
                    selectedStates.includes(state.state_code)
                      ? 'bg-pe-teal-500 text-white border-pe-teal-500'
                      : state.has_state_ctc
                      ? 'bg-green-50 border-green-200 hover:bg-green-100'
                      : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                  }`}
                  title={state.state_name}
                >
                  {state.state_code}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reform Configuration */}
        <div className="card">
          <h3 className="section-title">Reform Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="label">CTC Amount (Young Children)</label>
              <input
                type="number"
                className="input"
                value={reformConfig.ctcAmount}
                onChange={(e) =>
                  setReformConfig((prev) => ({
                    ...prev,
                    ctcAmount: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="refundable"
                checked={reformConfig.refundable}
                onChange={(e) =>
                  setReformConfig((prev) => ({
                    ...prev,
                    refundable: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              <label htmlFor="refundable">Fully Refundable</label>
            </div>

            <button
              onClick={handleRunComparison}
              disabled={isPending}
              className="btn btn-primary w-full py-3"
            >
              {isPending ? 'Comparing...' : 'Compare States'}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        {comparison && (
          <div className="card">
            <h3 className="section-title">National Impact</h3>

            <div className="space-y-4">
              <div className="stat-card bg-green-50">
                <div className="stat-value text-green-700">
                  {Math.abs(comparison.national_poverty_impact.child_poverty_percent_change).toFixed(1)}%
                </div>
                <div className="stat-label">National Poverty Reduction</div>
              </div>

              <div className="stat-card bg-amber-50">
                <div className="stat-value text-amber-700">
                  ${comparison.national_fiscal_cost.total_cost_billions.toFixed(1)}B
                </div>
                <div className="stat-label">Total Cost</div>
              </div>

              <div className="stat-card bg-blue-50">
                <div className="stat-value text-blue-700">
                  {comparison.national_poverty_impact.children_lifted_out_of_poverty.toLocaleString()}
                </div>
                <div className="stat-label">Children Lifted</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="section-title mb-0">State-by-State Results</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('poverty')}
                  className={`btn text-sm ${sortBy === 'poverty' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  By Poverty Reduction
                </button>
                <button
                  onClick={() => setSortBy('cost')}
                  className={`btn text-sm ${sortBy === 'cost' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  By Cost
                </button>
                <button
                  onClick={() => setSortBy('effectiveness')}
                  className={`btn text-sm ${sortBy === 'effectiveness' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  By Effectiveness
                </button>
              </div>
            </div>

            <StateComparisonChart comparison={comparison} sortBy={sortBy} />
          </div>

          <div className="card">
            <h3 className="section-title">State Rankings</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-medium text-gray-700 mb-4">Top 10 by Poverty Reduction</h4>
                <ol className="space-y-2">
                  {comparison.states_by_poverty_reduction.slice(0, 10).map((code, i) => {
                    const state = comparison.states.find((s) => s.state_code === code);
                    return (
                      <li key={code} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>
                          {i + 1}. {state?.state_name || code}
                        </span>
                        <span className="text-green-600 font-medium">
                          {Math.abs(state?.poverty_impact.child_poverty_percent_change || 0).toFixed(1)}%
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-4">Top 10 by Cost-Effectiveness</h4>
                <ol className="space-y-2">
                  {comparison.states_by_cost_effectiveness.slice(0, 10).map((code, i) => {
                    const state = comparison.states.find((s) => s.state_code === code);
                    return (
                      <li key={code} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>
                          {i + 1}. {state?.state_name || code}
                        </span>
                        <span className="text-blue-600 font-medium">
                          ${Math.round(state?.fiscal_cost.cost_per_child_lifted_from_poverty || 0).toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StateComparisonChart({
  comparison,
  sortBy,
}: {
  comparison: StateComparisonResponse;
  sortBy: 'poverty' | 'cost' | 'effectiveness';
}) {
  const sortedStates = [...comparison.states].sort((a, b) => {
    switch (sortBy) {
      case 'poverty':
        return a.poverty_impact.child_poverty_percent_change - b.poverty_impact.child_poverty_percent_change;
      case 'cost':
        return b.fiscal_cost.total_cost_billions - a.fiscal_cost.total_cost_billions;
      case 'effectiveness':
        return a.fiscal_cost.cost_per_child_lifted_from_poverty - b.fiscal_cost.cost_per_child_lifted_from_poverty;
    }
  });

  const chartData = sortedStates.map((state) => ({
    name: state.state_code,
    value:
      sortBy === 'poverty'
        ? Math.abs(state.poverty_impact.child_poverty_percent_change)
        : sortBy === 'cost'
        ? state.fiscal_cost.total_cost_billions
        : state.fiscal_cost.cost_per_child_lifted_from_poverty / 1000,
  }));

  const label =
    sortBy === 'poverty'
      ? 'Poverty Reduction (%)'
      : sortBy === 'cost'
      ? 'Total Cost ($B)'
      : 'Cost per Child ($K)';

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(v: number) =>
            sortBy === 'poverty'
              ? `${v.toFixed(1)}%`
              : sortBy === 'cost'
              ? `$${v.toFixed(2)}B`
              : `$${(v * 1000).toLocaleString()}`
          }
        />
        <Bar dataKey="value" name={label}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={sortBy === 'poverty' ? colors.success : sortBy === 'cost' ? colors.warning : colors.blue[500]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
