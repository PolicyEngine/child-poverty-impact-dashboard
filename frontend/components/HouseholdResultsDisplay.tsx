'use client';

import type { HouseholdResults, HouseholdImpact } from '@/lib/household-types';

interface HouseholdResultsDisplayProps {
  baseline?: HouseholdResults;
  impact?: HouseholdImpact;
  isLoading?: boolean;
}

export default function HouseholdResultsDisplay({
  baseline,
  impact,
  isLoading = false,
}: HouseholdResultsDisplayProps) {
  if (isLoading) {
    return (
      <div className="card text-center py-12">
        <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
        <p className="text-pe-gray-500">Calculating household benefits...</p>
      </div>
    );
  }

  if (!baseline && !impact) {
    return (
      <div className="card text-center py-12 text-gray-500">
        <p>Enter your household details and click calculate to see results</p>
      </div>
    );
  }

  const results = impact?.reform || baseline;
  const baselineResults = impact?.baseline || baseline;

  if (!results || !baselineResults) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Impact Summary (if comparing reform) */}
      {impact && (
        <div
          className={`card ${
            impact.net_income_change > 0
              ? 'bg-green-50 border-green-200'
              : impact.net_income_change < 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50'
          }`}
        >
          <h3 className="text-lg font-semibold mb-4">Reform Impact</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div
                className={`text-3xl font-bold ${
                  impact.net_income_change > 0
                    ? 'text-green-600'
                    : impact.net_income_change < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {impact.net_income_change >= 0 ? '+' : ''}
                {formatCurrency(impact.net_income_change)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Net Income Change</div>
              <div className="text-xs text-gray-500">
                ({impact.percent_income_change >= 0 ? '+' : ''}
                {formatPercent(impact.percent_income_change)})
              </div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  impact.ctc_change > 0
                    ? 'text-green-600'
                    : impact.ctc_change < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {impact.ctc_change >= 0 ? '+' : ''}
                {formatCurrency(impact.ctc_change)}
              </div>
              <div className="text-sm text-gray-600 mt-1">CTC Change</div>
            </div>
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  impact.eitc_change > 0
                    ? 'text-green-600'
                    : impact.eitc_change < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {impact.eitc_change >= 0 ? '+' : ''}
                {formatCurrency(impact.eitc_change)}
              </div>
              <div className="text-sm text-gray-600 mt-1">EITC Change</div>
            </div>
          </div>

          {impact.poverty_status_change !== 'unchanged' && (
            <div className="mt-4 text-center">
              <span
                className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  impact.poverty_status_change === 'lifted'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {impact.poverty_status_change === 'lifted'
                  ? 'Lifted out of poverty!'
                  : 'Fell into poverty'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Detailed Results */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Income & Taxes */}
        <div className="card">
          <h3 className="section-title">Income & Taxes</h3>
          <div className="space-y-3">
            <ResultRow
              label="Gross Income"
              baseline={baselineResults.gross_income}
              reform={impact ? results.gross_income : undefined}
              format={formatCurrency}
            />
            <ResultRow
              label="Federal Income Tax"
              baseline={-baselineResults.federal_income_tax}
              reform={impact ? -results.federal_income_tax : undefined}
              format={formatCurrency}
              isNegative
            />
            <ResultRow
              label="State Income Tax"
              baseline={-baselineResults.state_income_tax}
              reform={impact ? -results.state_income_tax : undefined}
              format={formatCurrency}
              isNegative
            />
            <ResultRow
              label="Payroll Tax"
              baseline={-baselineResults.payroll_tax}
              reform={impact ? -results.payroll_tax : undefined}
              format={formatCurrency}
              isNegative
            />
            <div className="border-t pt-3 mt-3">
              <ResultRow
                label="Effective Tax Rate"
                baseline={baselineResults.effective_tax_rate}
                reform={impact ? results.effective_tax_rate : undefined}
                format={formatPercent}
              />
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="card">
          <h3 className="section-title">Benefits</h3>
          <div className="space-y-3">
            <ResultRow
              label="Federal CTC"
              baseline={baselineResults.federal_ctc}
              reform={impact ? results.federal_ctc : undefined}
              format={formatCurrency}
            />
            <ResultRow
              label="State CTC"
              baseline={baselineResults.state_ctc}
              reform={impact ? results.state_ctc : undefined}
              format={formatCurrency}
            />
            <ResultRow
              label="Federal EITC"
              baseline={baselineResults.federal_eitc}
              reform={impact ? results.federal_eitc : undefined}
              format={formatCurrency}
            />
            <ResultRow
              label="State EITC"
              baseline={baselineResults.state_eitc}
              reform={impact ? results.state_eitc : undefined}
              format={formatCurrency}
            />
            <ResultRow
              label="SNAP Benefits"
              baseline={baselineResults.snap_benefits}
              reform={impact ? results.snap_benefits : undefined}
              format={formatCurrency}
            />
            <div className="border-t pt-3 mt-3">
              <ResultRow
                label="Total Benefits"
                baseline={baselineResults.total_benefits}
                reform={impact ? results.total_benefits : undefined}
                format={formatCurrency}
                isBold
              />
            </div>
          </div>
        </div>
      </div>

      {/* Net Income & Poverty Status */}
      <div className="card">
        <h3 className="section-title">Net Income & Poverty Status</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <ResultRow
              label="Net Income"
              baseline={baselineResults.net_income}
              reform={impact ? results.net_income : undefined}
              format={formatCurrency}
              isBold
            />
            <ResultRow
              label="Total Child Benefits"
              baseline={baselineResults.total_child_benefits}
              reform={impact ? results.total_child_benefits : undefined}
              format={formatCurrency}
              className="mt-3"
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Poverty Status</span>
              <div className="flex gap-2">
                <PovertyBadge
                  inPoverty={baselineResults.in_poverty}
                  inDeepPoverty={baselineResults.in_deep_poverty}
                  label={impact ? 'Baseline' : undefined}
                />
                {impact && (
                  <>
                    <span className="text-gray-400">→</span>
                    <PovertyBadge
                      inPoverty={results.in_poverty}
                      inDeepPoverty={results.in_deep_poverty}
                      label="Reform"
                    />
                  </>
                )}
              </div>
            </div>
            {baselineResults.in_poverty && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Poverty Gap</span>
                <span className="font-medium">
                  {formatCurrency(results.poverty_gap)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  baseline,
  reform,
  format,
  isBold = false,
  isNegative = false,
  className = '',
}: {
  label: string;
  baseline: number;
  reform?: number;
  format: (value: number) => string;
  isBold?: boolean;
  isNegative?: boolean;
  className?: string;
}) {
  const hasChange = reform !== undefined && reform !== baseline;
  const change = reform !== undefined ? reform - baseline : 0;

  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className={`text-gray-600 ${isBold ? 'font-medium' : ''}`}>{label}</span>
      <div className="text-right">
        <span className={isBold ? 'font-semibold' : ''}>{format(baseline)}</span>
        {hasChange && (
          <span
            className={`ml-2 text-sm ${
              change > 0
                ? isNegative
                  ? 'text-red-600'
                  : 'text-green-600'
                : change < 0
                  ? isNegative
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            ({change >= 0 ? '+' : ''}
            {format(change)})
          </span>
        )}
      </div>
    </div>
  );
}

function PovertyBadge({
  inPoverty,
  inDeepPoverty,
  label,
}: {
  inPoverty: boolean;
  inDeepPoverty: boolean;
  label?: string;
}) {
  let bgColor = 'bg-green-100 text-green-800';
  let text = 'Not in poverty';

  if (inDeepPoverty) {
    bgColor = 'bg-red-100 text-red-800';
    text = 'Deep poverty';
  } else if (inPoverty) {
    bgColor = 'bg-orange-100 text-orange-800';
    text = 'In poverty';
  }

  return (
    <div className="text-center">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <span className={`px-2 py-1 rounded text-xs font-medium ${bgColor}`}>{text}</span>
    </div>
  );
}
