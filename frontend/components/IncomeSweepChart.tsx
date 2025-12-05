'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
} from 'recharts';
import type { IncomeSweepDataPoint } from '@/lib/household-types';

interface IncomeSweepChartProps {
  data: IncomeSweepDataPoint[];
  reformData?: IncomeSweepDataPoint[];
  chartType?: 'net_income' | 'benefits' | 'tax_rate' | 'breakdown';
  title?: string;
}

export default function IncomeSweepChart({
  data,
  reformData,
  chartType = 'net_income',
  title,
}: IncomeSweepChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      income: point.income,
      net_income: point.net_income,
      federal_ctc: point.federal_ctc,
      state_ctc: point.state_ctc,
      federal_eitc: point.federal_eitc,
      state_eitc: point.state_eitc,
      snap_benefits: point.snap_benefits,
      total_benefits: point.total_benefits,
      effective_tax_rate: point.effective_tax_rate,
      in_poverty: point.in_poverty,
      reform_net_income: reformData?.[index]?.net_income,
      reform_total_benefits: reformData?.[index]?.total_benefits,
      reform_effective_tax_rate: reformData?.[index]?.effective_tax_rate,
    }));
  }, [data, reformData]);

  const renderChart = () => {
    switch (chartType) {
      case 'net_income':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="income"
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Employment Income', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Net Income', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Income: ${formatCurrency(label as number)}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="net_income"
              name="Baseline Net Income"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            {reformData && (
              <Line
                type="monotone"
                dataKey="reform_net_income"
                name="Reform Net Income"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            )}
            {/* 45-degree reference line */}
            <Line
              type="monotone"
              dataKey="income"
              name="Gross Income"
              stroke="#9ca3af"
              strokeDasharray="5 5"
              strokeWidth={1}
              dot={false}
            />
          </LineChart>
        );

      case 'benefits':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="income"
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Employment Income', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Benefits', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Income: ${formatCurrency(label as number)}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="snap_benefits"
              name="SNAP"
              stackId="1"
              stroke="#f59e0b"
              fill="#fcd34d"
            />
            <Area
              type="monotone"
              dataKey="federal_eitc"
              name="Federal EITC"
              stackId="1"
              stroke="#10b981"
              fill="#6ee7b7"
            />
            <Area
              type="monotone"
              dataKey="state_eitc"
              name="State EITC"
              stackId="1"
              stroke="#059669"
              fill="#34d399"
            />
            <Area
              type="monotone"
              dataKey="federal_ctc"
              name="Federal CTC"
              stackId="1"
              stroke="#3b82f6"
              fill="#93c5fd"
            />
            <Area
              type="monotone"
              dataKey="state_ctc"
              name="State CTC"
              stackId="1"
              stroke="#1d4ed8"
              fill="#60a5fa"
            />
          </AreaChart>
        );

      case 'tax_rate':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="income"
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Employment Income', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              domain={[-0.5, 0.5]}
              label={{ value: 'Effective Tax Rate', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => formatPercent(value)}
              labelFormatter={(label) => `Income: ${formatCurrency(label as number)}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="effective_tax_rate"
              name="Baseline Tax Rate"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            {reformData && (
              <Line
                type="monotone"
                dataKey="reform_effective_tax_rate"
                name="Reform Tax Rate"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            )}
            {/* Zero line */}
            <Line
              type="monotone"
              dataKey={() => 0}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              strokeWidth={1}
              dot={false}
              legendType="none"
            />
          </LineChart>
        );

      case 'breakdown':
        return (
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="income"
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Employment Income', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={(v) => `$${v / 1000}k`}
              label={{ value: 'Amount', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Income: ${formatCurrency(label as number)}`}
            />
            <Legend />
            <Bar dataKey="total_benefits" name="Total Benefits" fill="#3b82f6" opacity={0.7} />
            <Line
              type="monotone"
              dataKey="net_income"
              name="Net Income"
              stroke="#1d4ed8"
              strokeWidth={2}
              dot={false}
            />
            {reformData && (
              <Line
                type="monotone"
                dataKey="reform_net_income"
                name="Reform Net Income"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      {title && <h3 className="section-title mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
