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
  ReferenceLine,
  Cell,
} from 'recharts';
import type { AnalysisResponse } from '@/lib/types';
import { US_STATES } from '@/lib/household-types';

// PolicyEngine design tokens (aligned with working-parents-tax-relief-act)
const COLORS = {
  primary: '#319795',
  primaryDark: '#285E61',
  positive: '#319795',
  negative: '#9C2127',
  gainMore5: '#319795',
  gainLess5: '#7EC2C0',
  noChange: '#E2E8F0',
  loseLess5: '#D9A0A2',
  loseMore5: '#9C2127',
  baseline: '#6B7280',
  reform: '#319795',
};

const CHART_MARGIN = { top: 20, right: 20, bottom: 30, left: 60 };
const TICK_STYLE = { fontFamily: 'var(--font-sans, Inter, sans-serif)', fontSize: 12, fill: '#6B7280' };

// Format helpers
const formatCurrency = (value: number): string =>
  `$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const formatCurrencyWithSign = (value: number): string => {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatCurrency(value)}`;
};

const formatBillions = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}T`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}B`;
  if (abs >= 0.001) return `${sign}$${(abs * 1000).toFixed(0)}M`;
  return `${sign}$${(abs * 1e9).toFixed(0)}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;
const formatPercentWithSign = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

// Nice tick calculator for symmetric/asymmetric domains
function calcNiceTicks(minVal: number, maxVal: number) {
  const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal));
  if (maxAbs === 0) return { domain: [-1, 1] as [number, number], ticks: [-1, 0, 1] };
  const rough = maxAbs / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  const niceStep = residual <= 1 ? mag : residual <= 2 ? 2 * mag : residual <= 5 ? 5 * mag : 10 * mag;
  const niceMin = Math.floor(minVal / niceStep) * niceStep;
  const niceMax = Math.ceil(maxVal / niceStep) * niceStep;
  const ticks = Array.from(
    { length: Math.round((niceMax - niceMin) / niceStep) + 1 },
    (_, i) => niceMin + i * niceStep,
  );
  return { domain: [niceMin, niceMax] as [number, number], ticks };
}

// Shared custom tooltip
function CustomTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: 6,
      padding: '8px 12px',
      fontFamily: 'var(--font-sans, Inter, sans-serif)',
      fontSize: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      {label && <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1F2937' }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, color: entry.color || '#4B5563' }}>
          {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
        </p>
      ))}
    </div>
  );
}

interface TabProps {
  results: AnalysisResponse;
  state: string | null;
  year: number;
}

// ============================================================================
// OVERVIEW TAB - Headline metrics + quick stats
// ============================================================================

export function StatewideOverview({ results, state, year }: TabProps) {
  const { poverty_impact, fiscal_cost, distributional_impact } = results;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: COLORS.primary }}>Statewide impact</h2>
        <p className="text-sm text-gray-500 mt-1">
          {results.reform_name} • {state ? US_STATES[state] : 'State'} • {year}
        </p>
      </div>

      {/* Headline metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeadlineCard
          label="Child poverty change"
          value={formatPercentWithSign(poverty_impact.child_poverty_percent_change)}
          subtext="Relative to baseline"
          positive={poverty_impact.child_poverty_percent_change < 0}
        />
        <HeadlineCard
          label="Children lifted"
          value={poverty_impact.children_lifted_out_of_poverty.toLocaleString()}
          subtext="Out of poverty"
          positive={poverty_impact.children_lifted_out_of_poverty > 0}
        />
        <HeadlineCard
          label="State fiscal impact"
          value={formatBillions(-fiscal_cost.state_cost_billions)}
          subtext="Annual net revenue"
          positive={fiscal_cost.state_cost_billions < 0}
        />
        <HeadlineCard
          label="Households gaining"
          value={formatPercent(distributional_impact.percent_gaining)}
          subtext="Of all households"
          positive={distributional_impact.percent_gaining > distributional_impact.percent_losing}
        />
      </div>

      {/* Quick stats summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Key statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatGroup
            title="Poverty reduction"
            rows={[
              { label: 'Child poverty rate change', value: `${poverty_impact.child_poverty_change_pp.toFixed(2)}pp` },
              { label: 'Young child poverty change', value: `${poverty_impact.young_child_poverty_change_pp.toFixed(2)}pp` },
              { label: 'Deep poverty change', value: `${poverty_impact.deep_poverty_change_pp.toFixed(2)}pp` },
            ]}
          />
          <StatGroup
            title="Fiscal impact"
            rows={[
              { label: 'State revenue impact', value: formatBillions(-fiscal_cost.state_cost_billions) },
              { label: 'Cost per child lifted', value: formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty) },
              { label: 'Cost per child (all)', value: formatCurrency(fiscal_cost.cost_per_child) },
            ]}
          />
          <StatGroup
            title="Distribution"
            rows={[
              { label: 'Average gain (all)', value: formatCurrencyWithSign(distributional_impact.average_gain_all) },
              { label: 'Bottom 50% gain', value: formatCurrencyWithSign(distributional_impact.average_gain_bottom_50) },
              { label: 'Gini coefficient change', value: `${distributional_impact.gini_change >= 0 ? '+' : ''}${distributional_impact.gini_change.toFixed(4)}` },
            ]}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
        Estimates are static: they do not capture behavioral responses such as changes in labor supply, tax avoidance, or migration.
      </p>
    </div>
  );
}

// ============================================================================
// POVERTY TAB
// ============================================================================

export function StatewidePoverty({ results }: TabProps) {
  const { poverty_impact } = results;

  const metrics = [
    {
      label: 'Child poverty',
      baseline: poverty_impact.baseline_child_poverty_rate,
      reform: poverty_impact.reform_child_poverty_rate,
    },
    {
      label: 'Young child poverty',
      baseline: poverty_impact.baseline_young_child_poverty_rate,
      reform: poverty_impact.reform_young_child_poverty_rate,
    },
    {
      label: 'Deep child poverty',
      baseline: poverty_impact.baseline_deep_child_poverty_rate,
      reform: poverty_impact.reform_deep_child_poverty_rate,
    },
  ];

  const chartData = metrics.map((m) => {
    const pctChange = m.baseline !== 0 ? ((m.reform - m.baseline) / m.baseline) * 100 : 0;
    return { ...m, pctChange };
  });

  const pctValues = chartData.map((d) => d.pctChange);
  const { domain, ticks } = calcNiceTicks(Math.min(0, ...pctValues), Math.max(0, ...pctValues));

  return (
    <div className="space-y-6">
      {/* Hero: children lifted */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: `${COLORS.primary}08`, borderColor: COLORS.primary }}>
          <p className="text-sm text-gray-700 mb-2">Children lifted out of poverty</p>
          <p className="text-4xl font-bold" style={{ color: COLORS.primary }}>
            {poverty_impact.children_lifted_out_of_poverty.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ages 0–17</p>
        </div>
        <div className="rounded-lg p-6 border" style={{ backgroundColor: `${COLORS.primaryDark}08`, borderColor: COLORS.primaryDark }}>
          <p className="text-sm text-gray-700 mb-2">Young children lifted</p>
          <p className="text-4xl font-bold" style={{ color: COLORS.primaryDark }}>
            {poverty_impact.young_children_lifted_out_of_poverty.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ages 0–5</p>
        </div>
      </div>

      {/* Change in poverty rates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Change in poverty rates</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={TICK_STYLE} stroke="#9CA3AF" />
            <YAxis
              domain={domain}
              ticks={ticks}
              tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              tick={TICK_STYLE}
              stroke="#9CA3AF"
              width={70}
            />
            <Tooltip content={<CustomTooltip formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />} />
            <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
            <Bar dataKey="pctChange" name="% change" radius={[2, 2, 0, 0]}>
              {chartData.map((m, i) => (
                <Cell key={i} fill={m.pctChange <= 0 ? COLORS.positive : COLORS.negative} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Details table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left px-4 py-3 font-medium text-gray-900">Metric</th>
                <th className="text-right px-4 py-3 font-medium text-gray-900">Baseline</th>
                <th className="text-right px-4 py-3 font-medium text-gray-900">Reform</th>
                <th className="text-right px-4 py-3 font-medium text-gray-900">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map((m, i) => {
                const changePp = (m.reform - m.baseline) * 100;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{m.label} rate</td>
                    <td className="px-4 py-3 text-gray-700 text-right">{(m.baseline * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-gray-700 text-right">{(m.reform * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-semibold text-right"
                      style={{ color: changePp <= 0 ? COLORS.positive : COLORS.negative }}>
                      {changePp >= 0 ? '+' : ''}{changePp.toFixed(2)}pp
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FISCAL TAB - 3-card totals + program breakdown
// ============================================================================

export function StatewideFiscal({ results, year }: TabProps) {
  const { fiscal_cost } = results;

  // Net revenue impact = negative of cost (cost_billions is positive when it's a cost)
  const totalImpact = -fiscal_cost.total_cost_billions;
  const federalImpact = -fiscal_cost.federal_cost_billions;
  const stateImpact = -fiscal_cost.state_cost_billions;

  const programBreakdown = [
    { name: 'State CTC', value: fiscal_cost.state_ctc_cost_billions },
    { name: 'State EITC', value: fiscal_cost.eitc_cost_billions },
    { name: 'SNAP', value: fiscal_cost.snap_cost_billions },
    { name: 'UBI', value: fiscal_cost.ubi_cost_billions },
    { name: 'Dependent exemption', value: fiscal_cost.dependent_exemption_cost_billions },
  ].filter((p) => Math.abs(p.value) > 0.001);

  return (
    <div className="space-y-6">
      {/* Annual impact - 3 cards */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Budgetary impact ({year})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FiscalCard label="Total" value={totalImpact} />
          <FiscalCard label="Federal" value={federalImpact} />
          <FiscalCard label="State" value={stateImpact} />
        </div>
      </div>

      {/* Cost effectiveness */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Cost effectiveness</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg p-5 border border-gray-200 bg-white">
            <p className="text-sm text-gray-700 mb-2">Cost per child lifted from poverty</p>
            <p className="text-2xl font-bold" style={{ color: COLORS.primary }}>
              {formatCurrency(fiscal_cost.cost_per_child_lifted_from_poverty)}
            </p>
          </div>
          <div className="rounded-lg p-5 border border-gray-200 bg-white">
            <p className="text-sm text-gray-700 mb-2">Cost per child (all children)</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(fiscal_cost.cost_per_child)}
            </p>
          </div>
        </div>
      </div>

      {/* Program breakdown table */}
      {programBreakdown.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Impact by program</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left px-4 py-3 font-medium text-gray-900">Program</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-900">Annual cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {programBreakdown.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 font-semibold text-right"
                      style={{ color: p.value > 0 ? COLORS.negative : COLORS.positive }}>
                      {formatBillions(-p.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 italic">
        Negative values indicate net cost to government; positive values indicate net revenue.
      </p>
    </div>
  );
}

// ============================================================================
// DISTRIBUTIONAL TAB - Decile chart + winners & losers
// ============================================================================

export function StatewideDistributional({ results }: TabProps) {
  const { distributional_impact } = results;
  const [activeView, setActiveView] = useState<'decile' | 'winners'>('decile');
  const [distMode, setDistMode] = useState<'relative' | 'absolute'>('absolute');

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'decile', label: 'Impact by decile' },
          { key: 'winners', label: 'Winners & losers' },
        ] as const).map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeView === v.key ? COLORS.primary : '#F3F4F6',
              color: activeView === v.key ? 'white' : '#374151',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'decile' && (
        <DecileView
          decileImpacts={distributional_impact.decile_impacts}
          giniChange={distributional_impact.gini_change}
          baselineGini={distributional_impact.baseline_gini}
          reformGini={distributional_impact.reform_gini}
          distMode={distMode}
          setDistMode={setDistMode}
        />
      )}

      {activeView === 'winners' && (
        <WinnersLosersView
          percentGaining={distributional_impact.percent_gaining}
          percentLosing={distributional_impact.percent_losing}
          percentUnchanged={distributional_impact.percent_unchanged}
          decileImpacts={distributional_impact.decile_impacts}
          averageGainAll={distributional_impact.average_gain_all}
          averageGainBottom50={distributional_impact.average_gain_bottom_50}
          shareToBottom20={distributional_impact.share_to_bottom_20_pct}
          shareToBottom50={distributional_impact.share_to_bottom_50_pct}
          shareToTop20={distributional_impact.share_to_top_20_pct}
          shareToTop10={distributional_impact.share_to_top_10_pct}
        />
      )}
    </div>
  );
}

function DecileView({
  decileImpacts,
  giniChange,
  baselineGini,
  reformGini,
  distMode,
  setDistMode,
}: {
  decileImpacts: AnalysisResponse['distributional_impact']['decile_impacts'];
  giniChange: number;
  baselineGini: number;
  reformGini: number;
  distMode: 'relative' | 'absolute';
  setDistMode: (m: 'relative' | 'absolute') => void;
}) {
  const isRelative = distMode === 'relative';

  // For relative, approximate % using decile income benchmarks (placeholder: use $50k average per decile)
  // Since we don't have baseline income per decile, we'll show absolute $ for both modes
  // but compute "relative" as share of total benefit
  const chartData = decileImpacts.map((d) => ({
    decile: String(d.decile),
    value: isRelative ? d.share_of_total_benefit : d.average_gain,
  }));

  const values = chartData.map((d) => d.value);
  const maxAbs = Math.max(...values.map(Math.abs), 1);
  const { domain, ticks } = calcNiceTicks(-maxAbs, maxAbs);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-800">Impact by income decile</h3>
        <div className="flex gap-1">
          {(['absolute', 'relative'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDistMode(mode)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                backgroundColor: distMode === mode ? COLORS.primary : '#F3F4F6',
                color: distMode === mode ? 'white' : '#374151',
              }}
            >
              {mode === 'absolute' ? 'Average $' : 'Share of benefits'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600">
        {isRelative
          ? 'Share of total reform benefits captured by each income decile (%).'
          : 'Average change in household income in dollars, by decile.'}
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="decile"
            tick={TICK_STYLE}
            stroke="#9CA3AF"
            label={{ value: 'Income decile', position: 'insideBottom', offset: -15, style: TICK_STYLE }}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tickFormatter={isRelative
              ? (v: number) => `${v.toFixed(0)}%`
              : (v: number) => formatCurrencyWithSign(v)}
            tick={TICK_STYLE}
            stroke="#9CA3AF"
            width={80}
          />
          <Tooltip
            content={<CustomTooltip formatter={isRelative
              ? (v) => `${v.toFixed(1)}%`
              : (v) => formatCurrencyWithSign(v)} />}
          />
          <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
          <Bar dataKey="value" name={isRelative ? 'Share of benefits' : 'Average gain'} radius={[2, 2, 0, 0]}>
            {values.map((v, i) => (
              <Cell key={i} fill={v >= 0 ? COLORS.positive : COLORS.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Gini coefficient summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg p-4 border border-gray-200 bg-white">
          <p className="text-sm text-gray-600">Baseline Gini</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{baselineGini.toFixed(4)}</p>
        </div>
        <div className="rounded-lg p-4 border border-gray-200 bg-white">
          <p className="text-sm text-gray-600">Reform Gini</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{reformGini.toFixed(4)}</p>
        </div>
        <div className="rounded-lg p-4 border"
          style={{
            backgroundColor: `${giniChange < 0 ? COLORS.positive : COLORS.negative}08`,
            borderColor: giniChange < 0 ? COLORS.positive : COLORS.negative,
          }}>
          <p className="text-sm text-gray-600">Gini change</p>
          <p className="text-xl font-bold mt-1"
            style={{ color: giniChange < 0 ? COLORS.positive : COLORS.negative }}>
            {giniChange >= 0 ? '+' : ''}{giniChange.toFixed(4)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {giniChange < 0 ? 'Less inequality' : giniChange > 0 ? 'More inequality' : 'No change'}
          </p>
        </div>
      </div>
    </div>
  );
}

function WinnersLosersView({
  percentGaining,
  percentLosing,
  percentUnchanged,
  decileImpacts,
  averageGainAll,
  averageGainBottom50,
  shareToBottom20,
  shareToBottom50,
  shareToTop20,
  shareToTop10,
}: {
  percentGaining: number;
  percentLosing: number;
  percentUnchanged: number;
  decileImpacts: AnalysisResponse['distributional_impact']['decile_impacts'];
  averageGainAll: number;
  averageGainBottom50: number;
  shareToBottom20: number;
  shareToBottom50: number;
  shareToTop20: number;
  shareToTop10: number;
}) {
  // Stacked data: gaining / unchanged / losing per decile
  const stackedData = decileImpacts.map((d) => ({
    label: `${d.decile}`,
    gaining: d.percent_gaining,
    unchanged: Math.max(0, 100 - d.percent_gaining - d.percent_losing),
    losing: d.percent_losing,
  }));

  return (
    <div className="space-y-6">
      {/* Headline cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg p-6 border" style={{ backgroundColor: `${COLORS.positive}08`, borderColor: COLORS.positive }}>
          <p className="text-sm text-gray-700 mb-2">Winners</p>
          <p className="text-3xl font-bold" style={{ color: COLORS.positive }}>{percentGaining.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">Households gain income</p>
        </div>
        <div className="rounded-lg p-6 border border-gray-300 bg-gray-50">
          <p className="text-sm text-gray-700 mb-2">No change</p>
          <p className="text-3xl font-bold text-gray-600">{percentUnchanged.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">Unaffected households</p>
        </div>
        <div className="rounded-lg p-6 border" style={{ backgroundColor: `${COLORS.negative}08`, borderColor: COLORS.negative }}>
          <p className="text-sm text-gray-700 mb-2">Losers</p>
          <p className="text-3xl font-bold" style={{ color: COLORS.negative }}>{percentLosing.toFixed(1)}%</p>
          <p className="text-xs text-gray-600 mt-1">Households lose income</p>
        </div>
      </div>

      {/* Stacked bar by decile */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Winners & losers by income decile</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stackedData} layout="vertical" barSize={22} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={TICK_STYLE} stroke="#9CA3AF" />
              <YAxis type="category" dataKey="label" tick={TICK_STYLE} stroke="#9CA3AF" width={40} />
              <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)}%`} />} />
              <Bar dataKey="gaining" stackId="a" fill={COLORS.positive} name="Gain" />
              <Bar dataKey="unchanged" stackId="a" fill={COLORS.noChange} name="No change" />
              <Bar dataKey="losing" stackId="a" fill={COLORS.negative} name="Lose" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <LegendItem color={COLORS.positive} label="Gain" />
            <LegendItem color={COLORS.noChange} label="No change" />
            <LegendItem color={COLORS.negative} label="Lose" />
          </div>
        </div>
      </div>

      {/* Share of benefits */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Share of total benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ShareBar label="Bottom 20%" pct={shareToBottom20} color={COLORS.primary} />
          <ShareBar label="Bottom 50%" pct={shareToBottom50} color={COLORS.primary} />
          <ShareBar label="Top 20%" pct={shareToTop20} color="#9CA3AF" />
          <ShareBar label="Top 10%" pct={shareToTop10} color="#9CA3AF" />
        </div>
      </div>

      {/* Average gain summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg p-4 border border-gray-200 bg-white">
          <p className="text-sm text-gray-600">Average gain (all households)</p>
          <p className="text-2xl font-bold mt-1" style={{ color: averageGainAll >= 0 ? COLORS.positive : COLORS.negative }}>
            {formatCurrencyWithSign(averageGainAll)}
          </p>
        </div>
        <div className="rounded-lg p-4 border border-gray-200 bg-white">
          <p className="text-sm text-gray-600">Average gain (bottom 50%)</p>
          <p className="text-2xl font-bold mt-1" style={{ color: averageGainBottom50 >= 0 ? COLORS.positive : COLORS.negative }}>
            {formatCurrencyWithSign(averageGainBottom50)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SMALL HELPER COMPONENTS
// ============================================================================

function HeadlineCard({ label, value, subtext, positive }: {
  label: string;
  value: string;
  subtext: string;
  positive: boolean;
}) {
  const color = positive ? COLORS.positive : COLORS.negative;
  return (
    <div className="rounded-lg p-5 border bg-white" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  );
}

function FiscalCard({ label, value }: { label: string; value: number }) {
  const color = value >= 0 ? COLORS.positive : COLORS.negative;
  const bg = value >= 0 ? '#ECFDF5' : '#FEF2F2';
  const border = value >= 0 ? '#A7F3D0' : '#FECACA';
  return (
    <div className="rounded-lg p-5 border" style={{ backgroundColor: bg, borderColor: border }}>
      <p className="text-sm text-gray-700 mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{formatBillions(value)}</p>
    </div>
  );
}

function StatGroup({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold" style={{ color: COLORS.primary }}>{title}</h4>
      {rows.map((r, i) => (
        <div key={i} className={`flex justify-between py-2 ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}`}>
          <span className="text-sm text-gray-600">{r.label}</span>
          <span className="text-sm font-medium text-gray-800">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-700">{label}</span>
    </div>
  );
}

function ShareBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold" style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ backgroundColor: color, width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
