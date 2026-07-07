'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { colors, chartColors } from '@/lib/colors';
import type { AnalysisResponse } from '@/lib/types';

interface ResultsDisplayProps {
  results: AnalysisResponse;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  return (
    <div className="space-y-8">
      {/* Headline Stats */}
      <HeadlineStats results={results} />

      {/* Poverty Impact */}
      <PovertyImpactSection results={results} />

      {/* Fiscal Cost */}
      <FiscalCostSection results={results} />

      {/* Distributional Impact */}
      <DistributionalSection results={results} />
    </div>
  );
}

function HeadlineStats({ results }: { results: AnalysisResponse }) {
  const { poverty_impact, fiscal_cost, headline_stats } = results;

  return (
    <div className="card">
      <h2 className="section-title">Summary: {results.reform_name}</h2>
      <p className="text-gray-600 mb-6">{results.reform_description}</p>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="stat-card bg-green-50">
          <div className="stat-value text-green-700">
            {Math.abs(poverty_impact.child_poverty_percent_change).toFixed(1)}%
          </div>
          <div className="stat-label">Child Poverty Reduction</div>
        </div>
        <div className="stat-card bg-blue-50">
          <div className="stat-value text-blue-700">
            {Math.round(poverty_impact.children_lifted_out_of_poverty).toLocaleString()}
          </div>
          <div className="stat-label">Children Lifted from Poverty</div>
        </div>
        <div className="stat-card bg-amber-50">
          <div className="stat-value text-amber-700">
            ${fiscal_cost.total_cost_billions.toFixed(1)}B
          </div>
          <div className="stat-label">Annual Cost</div>
        </div>
        <div className="stat-card bg-purple-50">
          <div className="stat-value text-purple-700">
            ${Math.round(fiscal_cost.cost_per_child_lifted_from_poverty).toLocaleString()}
          </div>
          <div className="stat-label">Cost per Child Lifted</div>
        </div>
      </div>
    </div>
  );
}

function PovertyImpactSection({ results }: { results: AnalysisResponse }) {
  const { poverty_impact } = results;

  const povertyData = [
    {
      name: 'All Children (0-17)',
      baseline: poverty_impact.baseline_child_poverty_rate,
      reform: poverty_impact.reform_child_poverty_rate,
    },
    {
      name: 'Young Children (0-3)',
      baseline: poverty_impact.baseline_young_child_poverty_rate,
      reform: poverty_impact.reform_young_child_poverty_rate,
    },
    {
      name: 'Deep Poverty',
      baseline: poverty_impact.baseline_deep_child_poverty_rate,
      reform: poverty_impact.reform_deep_child_poverty_rate,
    },
  ];

  return (
    <div className="card">
      <h2 className="section-title">Poverty Impact</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-medium text-gray-700 mb-4">Poverty Rate Changes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={povertyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
              <Legend />
              <Bar dataKey="baseline" name="Baseline" fill={chartColors.baseline} />
              <Bar dataKey="reform" name="Reform" fill={chartColors.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-700">Key Metrics</h3>

          <MetricRow label="Child Poverty Rate Change" {...ppChange(poverty_impact.child_poverty_change_pp)} />
          <MetricRow label="Young Child Poverty Change" {...ppChange(poverty_impact.young_child_poverty_change_pp)} />
          <MetricRow label="Deep Poverty Change" {...ppChange(poverty_impact.deep_poverty_change_pp)} />
          <MetricRow
            label="Children Lifted (All)"
            value={Math.round(poverty_impact.children_lifted_out_of_poverty).toLocaleString()}
            positive={poverty_impact.children_lifted_out_of_poverty > 0 ? true : undefined}
          />
          <MetricRow
            label="Young Children Lifted"
            value={Math.round(poverty_impact.young_children_lifted_out_of_poverty).toLocaleString()}
            positive={poverty_impact.young_children_lifted_out_of_poverty > 0 ? true : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function FiscalCostSection({ results }: { results: AnalysisResponse }) {
  const { fiscal_cost } = results;

  const costBreakdown = [
    { name: 'CTC', value: fiscal_cost.ctc_cost_billions, color: colors.primary[500] },
    { name: 'EITC', value: fiscal_cost.eitc_cost_billions, color: colors.primary[300] },
    { name: 'SNAP', value: fiscal_cost.snap_cost_billions, color: colors.blue[500] },
    { name: 'UBI', value: fiscal_cost.ubi_cost_billions, color: colors.primary[700] },
    { name: 'State CTC', value: fiscal_cost.state_ctc_cost_billions, color: colors.blue[300] },
  ].filter((item) => item.value > 0);

  return (
    <div className="card">
      <h2 className="section-title">Fiscal Cost</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-medium text-gray-700 mb-4">Cost Breakdown</h3>
          {costBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value.toFixed(1)}B`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}B`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-gray-500 text-center py-12">No cost breakdown available</div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-700">Cost Summary</h3>

          <MetricRow
            label="Total Annual Cost"
            value={`$${fiscal_cost.total_cost_billions.toFixed(2)}B`}
          />
          <MetricRow
            label="Federal Cost"
            value={`$${fiscal_cost.federal_cost_billions.toFixed(2)}B`}
          />
          <MetricRow
            label="State Cost"
            value={`$${fiscal_cost.state_cost_billions.toFixed(2)}B`}
          />
          <div className="border-t pt-4 mt-4">
            <MetricRow
              label="Cost per Child"
              value={`$${Math.round(fiscal_cost.cost_per_child).toLocaleString()}`}
            />
            <MetricRow
              label="Cost per Child Lifted from Poverty"
              value={
                fiscal_cost.cost_per_child_lifted_from_poverty < 1e10
                  ? `$${Math.round(fiscal_cost.cost_per_child_lifted_from_poverty).toLocaleString()}`
                  : 'N/A'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionalSection({ results }: { results: AnalysisResponse }) {
  const { distributional_impact } = results;
  const [mode, setMode] = useState<'absolute' | 'relative'>('absolute');
  const isRel = mode === 'relative';

  const decileData = distributional_impact.decile_impacts.map((d) => ({
    decile: `D${d.decile}`,
    value: isRel ? (d.relative_gain ?? 0) * 100 : d.average_gain,
  }));

  return (
    <div className="card">
      <h2 className="section-title">Distributional Impact</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-medium text-gray-700">
              {isRel
                ? 'Relative gain by income decile'
                : 'Average gain by income decile'}
            </h3>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setMode('absolute')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  !isRel ? 'bg-pe-teal-500 text-white' : 'text-gray-600'
                }`}
              >
                Absolute
              </button>
              <button
                type="button"
                onClick={() => setMode('relative')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  isRel ? 'bg-pe-teal-500 text-white' : 'text-gray-600'
                }`}
              >
                Relative
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={decileData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="decile" />
              <YAxis
                tickFormatter={(v) => (isRel ? `${v.toFixed(1)}%` : `$${v}`)}
              />
              <Tooltip
                formatter={(v: number) =>
                  isRel ? `${v.toFixed(2)}%` : `$${v.toFixed(0)}`
                }
              />
              <Bar
                dataKey="value"
                name={isRel ? 'Relative gain' : 'Average gain'}
                fill={chartColors.primary}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-700">Distribution Summary</h3>

          <MetricRow
            label="Average Gain (All)"
            value={`$${distributional_impact.average_gain_all.toFixed(0)}`}
          />
          <MetricRow
            label="Average Gain (Bottom 50%)"
            value={`$${distributional_impact.average_gain_bottom_50.toFixed(0)}`}
          />
          <MetricRow
            label="Average Gain (Top 10%)"
            value={`$${distributional_impact.average_gain_top_10.toFixed(0)}`}
          />

          <div className="border-t pt-4 mt-4">
            <MetricRow
              label="Gini Change"
              value={distributional_impact.gini_change.toFixed(4)}
              positive={distributional_impact.gini_change < 0}
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <MetricRow
              label="Residents Gaining"
              value={`${distributional_impact.percent_gaining.toFixed(1)}%`}
            />
            <MetricRow
              label="Residents Losing"
              value={`${distributional_impact.percent_losing.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** pp-change display: below display precision renders as a grey 0 rather
 *  than a colored "+0.00 pp". */
function ppChange(x: number): { value: string; positive?: boolean } {
  if (Math.abs(x) < 0.005) return { value: '0' };
  return { value: `${x > 0 ? '+' : ''}${x.toFixed(2)} pp`, positive: x < 0 };
}

function MetricRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span
        className={`font-semibold ${
          positive === true
            ? 'text-green-600'
            : positive === false
            ? 'text-red-600'
            : value === '0'
            ? 'text-gray-400'
            : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
