'use client';

import { useState, useEffect } from 'react';
import type { ReformOption, StateReformOptions, StatePrograms, AdjustableParameter } from '@/lib/household-types';

// Track parameter values for configurable options
export interface ParameterValues {
  [optionId: string]: {
    [paramName: string]: number;
  };
}

interface ReformOptionsSelectorProps {
  stateCode: string;
  statePrograms?: StatePrograms;
  reformOptions?: StateReformOptions;
  selectedOptions: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  parameterValues?: ParameterValues;
  onParameterChange?: (optionId: string, paramName: string, value: number) => void;
  isLoading?: boolean;
  /** Compare mode runs the same reform across multiple states, so state-
   *  specific reforms (state CTC/EITC/SNAP/child allowance) are hidden —
   *  they only apply in one state and break the apples-to-apples premise. */
  federalOnly?: boolean;
}

export default function ReformOptionsSelector({
  stateCode,
  statePrograms,
  reformOptions,
  selectedOptions,
  onSelectionChange,
  parameterValues = {},
  onParameterChange,
  isLoading = false,
  federalOnly = false,
}: ReformOptionsSelectorProps) {
  const [activeTab, setActiveTab] = useState<'ctc' | 'eitc' | 'snap' | 'allowance' | 'federal'>(
    federalOnly ? 'federal' : 'eitc',
  );

  // If the parent toggled federalOnly on, drop any non-federal selections
  // so the wizard doesn't carry stale state-specific reforms into Modal.
  useEffect(() => {
    if (!federalOnly || !reformOptions) return;
    const federalIds = new Set(reformOptions.federal_options.map((o) => o.id));
    const filtered = selectedOptions.filter((id) => federalIds.has(id));
    if (filtered.length !== selectedOptions.length) {
      onSelectionChange(filtered);
    }
    if (activeTab !== 'federal') setActiveTab('federal');
  }, [federalOnly, reformOptions]);

  const toggleOption = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      onSelectionChange(selectedOptions.filter((id) => id !== optionId));
      return;
    }
    const allOptions = reformOptions
      ? [
          ...reformOptions.ctc_options,
          ...reformOptions.eitc_options,
          ...reformOptions.snap_options,
          ...reformOptions.child_allowance_options,
          ...reformOptions.federal_options,
        ]
      : [];
    const option = allOptions.find((o) => o.id === optionId);
    // In-development reforms are surfaced but not selectable.
    if (option?.in_development) return;
    // Selecting an option drops any reform it declares itself mutually
    // exclusive with.
    const exclusive = new Set(option?.exclusive_with ?? []);
    onSelectionChange([
      ...selectedOptions.filter((id) => !exclusive.has(id)),
      optionId,
    ]);
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="card text-center py-8">
        <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
        <p className="text-pe-gray-500">Loading reform options for {stateCode}...</p>
      </div>
    );
  }

  if (!reformOptions) {
    return (
      <div className="card text-center py-8 text-gray-500">
        {stateCode
          ? `Unable to load reform options for ${stateCode}. Please ensure the backend is running.`
          : 'Select a state to see available reform options'}
      </div>
    );
  }

  type TabId = 'ctc' | 'eitc' | 'snap' | 'allowance' | 'federal';
  const tabs: { id: TabId; label: string; options: ReformOption[] }[] = federalOnly
    ? [{ id: 'federal', label: 'Federal', options: reformOptions.federal_options }]
    : [
        { id: 'ctc', label: 'Child Tax Credit', options: reformOptions.ctc_options },
        { id: 'eitc', label: 'EITC', options: reformOptions.eitc_options },
        { id: 'snap', label: 'SNAP', options: reformOptions.snap_options },
        { id: 'allowance', label: 'Child Allowance', options: reformOptions.child_allowance_options },
        { id: 'federal', label: 'Federal', options: reformOptions.federal_options },
      ];

  return (
    <div className="space-y-4">
      {/* Current Programs Summary */}
      {statePrograms && (
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-gray-800 mb-3">
            Current Programs in {statePrograms.state_name}
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className={statePrograms.has_state_ctc ? 'text-green-600' : 'text-gray-400'}>
                {statePrograms.has_state_ctc ? '✓' : '✗'}
              </span>
              <div>
                <span className="font-medium">State CTC:</span>
                {statePrograms.has_state_ctc ? (
                  <span className="text-gray-600 ml-1">
                    {statePrograms.ctc_name} - ${statePrograms.ctc_max_amount}
                  </span>
                ) : (
                  <span className="text-gray-400 ml-1">None</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className={statePrograms.has_state_eitc ? 'text-green-600' : 'text-gray-400'}>
                {statePrograms.has_state_eitc ? '✓' : '✗'}
              </span>
              <div>
                <span className="font-medium">State EITC:</span>
                {statePrograms.has_state_eitc ? (
                  <span className="text-gray-600 ml-1">
                    {statePrograms.eitc_name} - {(statePrograms.eitc_match_rate! * 100).toFixed(0)}%
                    match
                  </span>
                ) : (
                  <span className="text-gray-400 ml-1">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Count */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          {selectedOptions.length} reform{selectedOptions.length !== 1 ? 's' : ''} selected
        </span>
        {selectedOptions.length > 0 && (
          <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700">
            Clear all
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-pe-teal-500 text-pe-teal-600'
                  : 'border-transparent text-pe-gray-500 hover:text-pe-gray-700'
              }`}
            >
              {tab.label}
              {tab.options.length > 0 && (
                <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                  {tab.options.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Options Grid */}
      <div className="space-y-3">
        {tabs
          .find((t) => t.id === activeTab)
          ?.options.map((option) => (
            <ReformOptionCard
              key={option.id}
              option={option}
              isSelected={selectedOptions.includes(option.id)}
              onToggle={() => toggleOption(option.id)}
              parameterValues={parameterValues[option.id] || {}}
              onParameterChange={(paramName, value) => {
                onParameterChange?.(option.id, paramName, value);
              }}
            />
          ))}

        {tabs.find((t) => t.id === activeTab)?.options.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            No {activeTab} options available for this state
          </div>
        )}
      </div>
    </div>
  );
}

function ReformOptionCard({
  option,
  isSelected,
  onToggle,
  parameterValues,
  onParameterChange,
}: {
  option: ReformOption;
  isSelected: boolean;
  onToggle: () => void;
  parameterValues: { [paramName: string]: number };
  onParameterChange: (paramName: string, value: number) => void;
}) {
  const hasAdjustableParams = option.is_configurable && option.adjustable_params && option.adjustable_params.length > 0;
  const inDevelopment = option.in_development === true;

  return (
    <div
      className={`p-4 border-2 rounded-xl transition-all duration-200 ${
        inDevelopment
          ? 'border-pe-gray-200 bg-pe-gray-50 opacity-60'
          : isSelected
            ? 'border-pe-teal-500 bg-pe-teal-50'
            : 'border-pe-gray-200 hover:border-pe-gray-300 hover:shadow-sm'
      }`}
      aria-disabled={inDevelopment}
    >
      {/* Header - clickable to toggle (disabled while in development) */}
      <div
        onClick={inDevelopment ? undefined : onToggle}
        className={`flex items-start justify-between ${
          inDevelopment ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-800">{option.name}</h4>
            {inDevelopment && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                In development
              </span>
            )}
            {!inDevelopment && option.is_new_program && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                New Program
              </span>
            )}
            {!inDevelopment && option.is_enhancement && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Enhancement
              </span>
            )}
            {!inDevelopment && hasAdjustableParams && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                Configurable
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
          {inDevelopment && (
            <p className="text-xs text-amber-700 mt-1">
              Not yet available — coming soon.
            </p>
          )}
        </div>
        {!inDevelopment && (
          <div
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-4 ${
              isSelected
                ? 'bg-pe-teal-500 border-pe-teal-500'
                : 'border-pe-gray-300'
            }`}
          >
            {isSelected && <span className="text-white text-sm">✓</span>}
          </div>
        )}
      </div>

      {/* Adjustable Parameters - shown when selected */}
      {!inDevelopment && isSelected && hasAdjustableParams && (
        <div className="mt-4 pt-4 border-t border-pe-gray-200 space-y-4">
          {option.adjustable_params!.map((param) => {
            // Hide params gated behind a toggle that's currently off.
            if (param.depends_on && !(parameterValues[param.depends_on] ?? 0)) {
              return null;
            }
            const currentValue = parameterValues[param.name] ?? param.default_value;

            // Checkbox control (stored as 0/1).
            if (param.control === 'toggle') {
              return (
                <div key={param.name} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={currentValue > 0}
                    onChange={(e) =>
                      onParameterChange(param.name, e.target.checked ? 1 : 0)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 h-4 w-4 accent-pe-teal-500"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {param.label}
                    </label>
                    {param.description && (
                      <p className="text-xs text-gray-500">{param.description}</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={param.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    {param.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= param.min_value && val <= param.max_value) {
                          onParameterChange(param.name, val);
                        }
                      }}
                      min={param.min_value}
                      max={param.max_value}
                      step={param.step}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-pe-teal-500 focus:border-transparent"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm text-gray-500 w-6">{param.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">{param.min_value}{param.unit}</span>
                  <input
                    type="range"
                    value={currentValue}
                    onChange={(e) => onParameterChange(param.name, parseFloat(e.target.value))}
                    min={param.min_value}
                    max={param.max_value}
                    step={param.step}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pe-teal-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-400 w-10 text-right">{param.max_value}{param.unit}</span>
                </div>
                {param.description && (
                  <p className="text-xs text-gray-500">{param.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Estimated Impact */}
      {option.estimated_household_impact && !hasAdjustableParams && (
        <p className="text-sm text-green-600 mt-2">
          Estimated impact: +${option.estimated_household_impact.toLocaleString()}/year
        </p>
      )}
    </div>
  );
}
