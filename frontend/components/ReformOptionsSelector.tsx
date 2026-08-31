'use client';

import { useState } from 'react';
import type { ReformOption, StateReformOptions, StatePrograms, AdjustableParameter } from '@/lib/household-types';
import { eitcStructured, eitcIsWfc } from '@/lib/state-programs';

// Reform categories where only one option may be active at a time. The
// federal CTC options are competing whole-credit restructurings, so they're
// mutually exclusive. (Federal EITC is intentionally NOT here: the two EITC
// bills target disjoint filer groups — childless workers vs. families with
// children — so they stack.)
const SINGLE_SELECT_CATEGORIES = new Set<string>(['federal_ctc']);

/** Float-safe "still at current law" check — slider/typed values must
 *  compare equal to decimal defaults (e.g. 4.5) without FP noise. */
function isAtDefault(value: number | undefined, dflt: number): boolean {
  return value === undefined || Math.abs(value - dflt) < 1e-9;
}

/** Whether selecting this option actually changes policy. The reform
 *  builders emit only values changed from current law, so a configurable
 *  option with every param at its default is a no-op. Created programs and
 *  presets without adjustable params are reforms on selection alone. */
export function selectionChangesPolicy(
  option: ReformOption,
  pv: { [paramName: string]: number } | undefined,
): boolean {
  if (option.creates_program) return true;
  const ps = option.adjustable_params ?? [];
  if (!option.is_configurable || ps.length === 0) return true;
  return ps.some((p) => !isAtDefault(pv?.[p.name], p.default_value));
}

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
}: ReformOptionsSelectorProps) {
  const [activeTab, setActiveTab] = useState<
    'ctc' | 'eitc' | 'depexempt' | 'grocery' | 'snap' | 'allowance' | 'fedctc' | 'fedeitc'
  >('eitc');

  const toggleOption = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      onSelectionChange(selectedOptions.filter((id) => id !== optionId));
      return;
    }
    const allOptions = reformOptions
      ? [
          ...reformOptions.ctc_options,
          ...reformOptions.eitc_options,
          ...reformOptions.dependent_exemption_options,
          ...reformOptions.grocery_credit_options,
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
    // Single-select categories (e.g. federal CTC, where the options are
    // competing whole-CTC restructurings): selecting one drops any other
    // already-selected option in the same category.
    if (option && SINGLE_SELECT_CATEGORIES.has(option.category)) {
      for (const id of selectedOptions) {
        const sel = allOptions.find((o) => o.id === id);
        if (sel && sel.category === option.category) exclusive.add(id);
      }
    }
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

  type TabId = 'ctc' | 'eitc' | 'depexempt' | 'grocery' | 'snap' | 'allowance' | 'fedctc' | 'fedeitc';
  const federalCtc = reformOptions.federal_options.filter(
    (o) => o.category === 'federal_ctc',
  );
  const federalEitc = reformOptions.federal_options.filter(
    (o) => o.category === 'federal_eitc',
  );
  const tabs: {
    id: TabId;
    label: string;
    options: ReformOption[];
    note?: string;
  }[] = [
    { id: 'ctc', label: 'State CTC', options: reformOptions.ctc_options },
    {
      id: 'eitc',
      // MN/WA run a Working Family (Tax) Credit rather than a federal-match
      // EITC, so label the tab to match the state's actual program. WI/OR are
      // still federal-EITC matches (just multi-rate), so they stay "EITC".
      label: eitcIsWfc(reformOptions.state_code) ? 'State WFC' : 'State EITC',
      options: reformOptions.eitc_options,
    },
    {
      id: 'depexempt',
      label: 'Dependent Exemption',
      options: reformOptions.dependent_exemption_options,
      note: 'Adjust, partially repeal, or eliminate the state dependent exemption/credit. Combine it with a State EITC or Child Allowance option to model replacing it with a different provision.',
    },
    ...(reformOptions.grocery_credit_options.length > 0
      ? [
          {
            id: 'grocery' as TabId,
            label: 'Grocery Credit',
            options: reformOptions.grocery_credit_options,
            note: "Idaho's refundable grocery tax credit: a per-person amount (including children), prorated by months not receiving SNAP.",
          },
        ]
      : []),
    { id: 'snap', label: 'SNAP', options: reformOptions.snap_options },
    { id: 'allowance', label: 'Child Allowance', options: reformOptions.child_allowance_options },
    {
      id: 'fedctc',
      label: 'Federal CTC',
      options: federalCtc,
      note: 'Choose one federal CTC reform. These are competing proposals, so only one can be active at a time.',
    },
    {
      id: 'fedeitc',
      label: 'Federal EITC',
      options: federalEitc,
      note: 'You can combine both EITC bills because they target different filers: the Tax Cuts for Workers Act expands the credit for childless workers, while the Working Parents Tax Relief Act boosts it for families with young children.',
    },
  ];

  // Selected options whose every param is still at current law — the reform
  // builders emit only changed values, so these are no-ops. Created programs
  // (selection alone is a reform) and preset options without adjustable
  // params (selection flips the reform on) are never no-ops.
  const isNoOpSelection = (o: ReformOption): boolean =>
    !selectionChangesPolicy(o, parameterValues[o.id]);
  const noOpCount = tabs
    .flatMap((t) => t.options)
    .filter((o) => selectedOptions.includes(o.id) && isNoOpSelection(o))
    .length;

  return (
    <div className="space-y-4">
      {/* Current Programs Summary */}
      {statePrograms && (
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-gray-800 mb-3">
            Current Programs in {statePrograms.state_name}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Every existing program is always part of the calculation under
            current law. Select a program below only to change it.
          </p>
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
                <span className="font-medium">
                  {eitcIsWfc(statePrograms.state_code) ? 'State WFC:' : 'State EITC:'}
                </span>
                {statePrograms.has_state_eitc ? (
                  <span className="text-gray-600 ml-1">
                    {statePrograms.eitc_name}
                    {/* MN/WA aren't a percentage of the federal EITC, so the
                        "% match" descriptor is misleading — show name only. */}
                    {!eitcStructured(statePrograms.state_code) &&
                    statePrograms.eitc_match_rate != null
                      ? ` - ${(statePrograms.eitc_match_rate * 100).toFixed(0)}% match`
                      : ''}
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
          {noOpCount > 0 && (
            <span className="text-amber-700">
              {' '}
              ({noOpCount} with no changes yet)
            </span>
          )}
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
          {tabs.map((tab) => {
            // Badge shows how many reforms in this category actually CHANGE
            // policy — selected no-ops (everything still at current law)
            // don't count, so resetting values returns the tab to no badge.
            const activeCount = tab.options.filter(
              (o) => selectedOptions.includes(o.id) && !isNoOpSelection(o),
            ).length;
            return (
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
                {activeCount > 0 && (
                  <span className="ml-1 text-xs bg-pe-teal-100 text-pe-teal-700 px-1.5 py-0.5 rounded">
                    {activeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Options Grid */}
      <div className="space-y-3">
        {(() => {
          const note = tabs.find((t) => t.id === activeTab)?.note;
          return note ? (
            <p className="text-xs text-pe-gray-500 bg-pe-gray-50 border border-pe-gray-200 rounded-lg px-3 py-2">
              {note}
            </p>
          ) : null;
        })()}
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
                // Configuring a wizard reform auto-includes it, so the user
                // doesn't have to also click the card to select it.
                if (!selectedOptions.includes(option.id)) {
                  onSelectionChange([...selectedOptions, option.id]);
                }
                onParameterChange?.(option.id, paramName, value);
              }}
            />
          ))}

        {tabs.find((t) => t.id === activeTab)?.options.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>
              No {tabs.find((t) => t.id === activeTab)?.label} options
              available for this state
            </p>
            {activeTab === 'ctc' && (
              <div className="mt-3">
                <p className="text-sm">
                  This state has no Child Tax Credit. You can create one with
                  the child allowance: add an income phase-out to make it a
                  CTC-style credit.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('allowance')}
                  className="btn btn-primary mt-3"
                >
                  Create one with the Child Allowance
                </button>
              </div>
            )}
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
  // Reform builders emit only values changed from current law, so a
  // selected card with every param at its default is a NO-OP. Created
  // programs (child allowance) are the exception — their defaults are a
  // real reform. Surface the no-op state so "selected" isn't mistaken
  // for "changing policy".
  const isNoOp = isSelected && !selectionChangesPolicy(option, parameterValues);
  // Child allowance + state CTC tabs have a single option, so show its
  // inputs as a wizard immediately (no card-click to expand) and use typed
  // input boxes rather than sliders.
  const wizardMode =
    option.category === 'child_allowance' ||
    option.category === 'state_ctc' ||
    option.category === 'state_dependent_exemption';

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
            {option.creates_program && (
              <span className="text-xs bg-pe-teal-100 text-pe-teal-700 px-2 py-0.5 rounded">
                Creates a new program
              </span>
            )}
            {isNoOp && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                No change yet
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
          {isNoOp && (
            <p className="text-xs text-amber-700 mt-1">
              Every value is still at current law. Adjust a value below to
              make this selection change policy.
            </p>
          )}
          {inDevelopment && (
            <p className="text-xs text-amber-700 mt-1">
              Not yet available. Coming soon.
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

      {/* Adjustable Parameters - shown when selected, or always in wizard mode */}
      {!inDevelopment && (isSelected || wizardMode) && hasAdjustableParams && (
        <div className="mt-4 pt-4 border-t border-pe-gray-200 space-y-4">
          {option.adjustable_params!.map((param) => {
            // Hide params gated behind a toggle that's currently off.
            if (param.depends_on && !(parameterValues[param.depends_on] ?? 0)) {
              return null;
            }
            // Hide params that should only show when a toggle is OFF.
            if (param.depends_on_off && (parameterValues[param.depends_on_off] ?? 0)) {
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
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    {param.label}
                  </label>
                  {/* Bordered box with the $ / % sign inside it. */}
                  <div className={`flex items-center border border-gray-300 rounded px-2 bg-white focus-within:ring-2 focus-within:ring-pe-teal-500 ${wizardMode ? 'w-32' : 'w-24'}`}>
                    {param.unit === '$' && (
                      <span className="text-sm text-gray-500 mr-1">$</span>
                    )}
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
                      className="w-full py-1 text-sm text-right bg-transparent outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {param.unit && param.unit !== '$' && (
                      <span className="text-sm text-gray-500 ml-1">{param.unit}</span>
                    )}
                  </div>
                </div>
                {/* Slider only outside wizard mode (CTC / child allowance use typed boxes). */}
                {!wizardMode && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-8">{param.unit === '$' ? `$${param.min_value}` : `${param.min_value}${param.unit}`}</span>
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
                    <span className="text-xs text-gray-400 w-10 text-right">{param.unit === '$' ? `$${param.max_value}` : `${param.max_value}${param.unit}`}</span>
                  </div>
                )}
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
