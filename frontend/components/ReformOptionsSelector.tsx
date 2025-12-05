'use client';

import { useState, useEffect } from 'react';
import type { ReformOption, StateReformOptions, StatePrograms } from '@/lib/household-types';

interface ReformOptionsSelectorProps {
  stateCode: string;
  statePrograms?: StatePrograms;
  reformOptions?: StateReformOptions;
  selectedOptions: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  isLoading?: boolean;
}

export default function ReformOptionsSelector({
  stateCode,
  statePrograms,
  reformOptions,
  selectedOptions,
  onSelectionChange,
  isLoading = false,
}: ReformOptionsSelectorProps) {
  const [activeTab, setActiveTab] = useState<'ctc' | 'eitc' | 'snap' | 'allowance' | 'federal'>('ctc');

  const toggleOption = (optionId: string) => {
    if (selectedOptions.includes(optionId)) {
      onSelectionChange(selectedOptions.filter((id) => id !== optionId));
    } else {
      onSelectionChange([...selectedOptions, optionId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="card text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-policyengine-blue mx-auto mb-4"></div>
        <p className="text-gray-600">Loading reform options for {stateCode}...</p>
      </div>
    );
  }

  if (!reformOptions) {
    return (
      <div className="card text-center py-8 text-gray-500">
        Select a state to see available reform options
      </div>
    );
  }

  const tabs = [
    { id: 'ctc', label: 'Child Tax Credit', options: reformOptions.ctc_options },
    { id: 'eitc', label: 'EITC', options: reformOptions.eitc_options },
    { id: 'snap', label: 'SNAP', options: reformOptions.snap_options },
    { id: 'allowance', label: 'Child Allowance', options: reformOptions.child_allowance_options },
    { id: 'federal', label: 'Federal', options: reformOptions.federal_options },
  ] as const;

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
                  ? 'border-policyengine-blue text-policyengine-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
}: {
  option: ReformOption;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-policyengine-blue bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800">{option.name}</h4>
            {option.is_new_program && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                New Program
              </span>
            )}
            {option.is_enhancement && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                Enhancement
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
          {option.estimated_household_impact && (
            <p className="text-sm text-green-600 mt-2">
              Estimated impact: +${option.estimated_household_impact.toLocaleString()}/year
            </p>
          )}
        </div>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected
              ? 'bg-policyengine-blue border-policyengine-blue'
              : 'border-gray-300'
          }`}
        >
          {isSelected && <span className="text-white text-sm">✓</span>}
        </div>
      </div>
    </div>
  );
}
