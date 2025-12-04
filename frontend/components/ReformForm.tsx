'use client';

import { useState } from 'react';
import type {
  ReformRequest,
  CTCConfig,
  EITCConfig,
  SNAPConfig,
  UBIConfig,
  StateCTCConfig,
  DependentExemptionConfig,
  defaultReformRequest,
} from '@/lib/types';

interface ReformFormProps {
  initialValues?: Partial<ReformRequest>;
  onSubmit: (reform: ReformRequest) => void;
  isLoading?: boolean;
}

export default function ReformForm({
  initialValues,
  onSubmit,
  isLoading = false,
}: ReformFormProps) {
  const [reform, setReform] = useState<ReformRequest>({
    name: 'Custom Reform',
    description: '',
    year: 2024,
    states: [],
    ctc: {
      enabled: false,
      amount_young: 0,
      amount_older: 0,
      age_eligibility: '0_17',
      income_basis: 'agi',
      phaseout_structure: 'asymmetric',
      phaseout_start_single: 200000,
      phaseout_start_joint: 400000,
      phaseout_rate: 0.05,
      refundable: true,
      refundable_amount: null,
    },
    eitc: {
      enabled: false,
      individualized: false,
      expansion_percent: 0,
      childless_expansion: false,
      age_floor_reduction: 0,
      age_ceiling_increase: 0,
    },
    dependent_exemption: {
      enabled: false,
      amount_per_dependent: 0,
      refundable: false,
      income_limit_single: null,
      income_limit_joint: null,
    },
    ubi: {
      enabled: false,
      amount_per_child: 0,
      amount_per_adult: 0,
      age_eligibility: '0_17',
      phase_out_with_income: false,
      phaseout_start: 0,
      phaseout_rate: 0,
    },
    snap: {
      enabled: false,
      benefit_increase_percent: 0,
      expand_eligibility_percent: 0,
      remove_asset_test: false,
      increase_child_allotment: 0,
    },
    state_ctc: {
      enabled: false,
      state: '',
      amount_young: 0,
      amount_older: 0,
      age_eligibility: '0_17',
      income_limit: null,
      refundable: true,
      matches_federal: false,
      match_percent: 0,
    },
    ...initialValues,
  });

  const [activeTab, setActiveTab] = useState<'ctc' | 'eitc' | 'snap' | 'ubi' | 'state_ctc' | 'other'>('ctc');

  const updateCTC = (updates: Partial<CTCConfig>) => {
    setReform((prev) => ({
      ...prev,
      ctc: { ...prev.ctc, ...updates },
    }));
  };

  const updateEITC = (updates: Partial<EITCConfig>) => {
    setReform((prev) => ({
      ...prev,
      eitc: { ...prev.eitc, ...updates },
    }));
  };

  const updateSNAP = (updates: Partial<SNAPConfig>) => {
    setReform((prev) => ({
      ...prev,
      snap: { ...prev.snap, ...updates },
    }));
  };

  const updateUBI = (updates: Partial<UBIConfig>) => {
    setReform((prev) => ({
      ...prev,
      ubi: { ...prev.ubi, ...updates },
    }));
  };

  const updateStateCTC = (updates: Partial<StateCTCConfig>) => {
    setReform((prev) => ({
      ...prev,
      state_ctc: { ...prev.state_ctc, ...updates },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reform);
  };

  const tabs = [
    { id: 'ctc', label: 'Child Tax Credit', enabled: reform.ctc.enabled },
    { id: 'eitc', label: 'EITC', enabled: reform.eitc.enabled },
    { id: 'snap', label: 'SNAP', enabled: reform.snap.enabled },
    { id: 'ubi', label: 'Child Allowance', enabled: reform.ubi.enabled },
    { id: 'state_ctc', label: 'State CTC', enabled: reform.state_ctc.enabled },
  ] as const;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reform Name */}
      <div className="card">
        <h3 className="section-title">Reform Details</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Reform Name</label>
            <input
              type="text"
              className="input"
              value={reform.name}
              onChange={(e) => setReform((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={reform.year}
              onChange={(e) => setReform((prev) => ({ ...prev, year: parseInt(e.target.value) }))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reform Tabs */}
      <div className="card">
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-policyengine-blue border-b-2 border-policyengine-blue'
                  : 'text-gray-500 hover:text-gray-700'
              } ${tab.enabled ? 'bg-green-50' : ''}`}
            >
              {tab.label}
              {tab.enabled && <span className="ml-1 text-green-600">●</span>}
            </button>
          ))}
        </div>

        {/* CTC Tab */}
        {activeTab === 'ctc' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Toggle
                enabled={reform.ctc.enabled}
                onChange={(enabled) => updateCTC({ enabled })}
              />
              <span className="font-medium">Enable CTC Reform</span>
            </div>

            {reform.ctc.enabled && (
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="label">Amount for Young Children (0-5)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ctc.amount_young}
                    onChange={(e) => updateCTC({ amount_young: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Amount for Older Children (6-17)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ctc.amount_older}
                    onChange={(e) => updateCTC({ amount_older: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Age Eligibility</label>
                  <select
                    className="input"
                    value={reform.ctc.age_eligibility}
                    onChange={(e) => updateCTC({ age_eligibility: e.target.value as any })}
                  >
                    <option value="prenatal_3">Prenatal to Age 3</option>
                    <option value="0_5">Ages 0-5</option>
                    <option value="0_17">Ages 0-17 (All Children)</option>
                    <option value="6_17">Ages 6-17</option>
                  </select>
                </div>
                <div>
                  <label className="label">Phaseout Start (Single)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ctc.phaseout_start_single}
                    onChange={(e) => updateCTC({ phaseout_start_single: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Phaseout Start (Joint)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ctc.phaseout_start_joint}
                    onChange={(e) => updateCTC({ phaseout_start_joint: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Phaseout Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={reform.ctc.phaseout_rate}
                    onChange={(e) => updateCTC({ phaseout_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.ctc.refundable}
                    onChange={(refundable) => updateCTC({ refundable })}
                  />
                  <span>Fully Refundable</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EITC Tab */}
        {activeTab === 'eitc' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Toggle
                enabled={reform.eitc.enabled}
                onChange={(enabled) => updateEITC({ enabled })}
              />
              <span className="font-medium">Enable EITC Reform</span>
            </div>

            {reform.eitc.enabled && (
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="label">Expansion Percentage</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.eitc.expansion_percent}
                    onChange={(e) => updateEITC({ expansion_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.eitc.individualized}
                    onChange={(individualized) => updateEITC({ individualized })}
                  />
                  <span>Individualized EITC</span>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.eitc.childless_expansion}
                    onChange={(childless_expansion) => updateEITC({ childless_expansion })}
                  />
                  <span>Expand for Childless Workers</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SNAP Tab */}
        {activeTab === 'snap' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Toggle
                enabled={reform.snap.enabled}
                onChange={(enabled) => updateSNAP({ enabled })}
              />
              <span className="font-medium">Enable SNAP Reform</span>
            </div>

            {reform.snap.enabled && (
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="label">Benefit Increase (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.snap.benefit_increase_percent}
                    onChange={(e) => updateSNAP({ benefit_increase_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Eligibility Expansion (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.snap.expand_eligibility_percent}
                    onChange={(e) => updateSNAP({ expand_eligibility_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Additional Child Allotment ($/month)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.snap.increase_child_allotment}
                    onChange={(e) => updateSNAP({ increase_child_allotment: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.snap.remove_asset_test}
                    onChange={(remove_asset_test) => updateSNAP({ remove_asset_test })}
                  />
                  <span>Remove Asset Test</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UBI Tab */}
        {activeTab === 'ubi' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Toggle
                enabled={reform.ubi.enabled}
                onChange={(enabled) => updateUBI({ enabled })}
              />
              <span className="font-medium">Enable Child Allowance / UBI</span>
            </div>

            {reform.ubi.enabled && (
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="label">Amount per Child ($/year)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ubi.amount_per_child}
                    onChange={(e) => updateUBI({ amount_per_child: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Amount per Adult ($/year)</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.ubi.amount_per_adult}
                    onChange={(e) => updateUBI({ amount_per_adult: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.ubi.phase_out_with_income}
                    onChange={(phase_out_with_income) => updateUBI({ phase_out_with_income })}
                  />
                  <span>Phase Out with Income</span>
                </div>
                {reform.ubi.phase_out_with_income && (
                  <>
                    <div>
                      <label className="label">Phaseout Start</label>
                      <input
                        type="number"
                        className="input"
                        value={reform.ubi.phaseout_start}
                        onChange={(e) => updateUBI({ phaseout_start: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="label">Phaseout Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={reform.ubi.phaseout_rate}
                        onChange={(e) => updateUBI({ phaseout_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* State CTC Tab */}
        {activeTab === 'state_ctc' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Toggle
                enabled={reform.state_ctc.enabled}
                onChange={(enabled) => updateStateCTC({ enabled })}
              />
              <span className="font-medium">Enable State CTC</span>
            </div>

            {reform.state_ctc.enabled && (
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="label">State</label>
                  <select
                    className="input"
                    value={reform.state_ctc.state}
                    onChange={(e) => updateStateCTC({ state: e.target.value })}
                  >
                    <option value="">Select a state</option>
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    {/* Add all states */}
                  </select>
                </div>
                <div>
                  <label className="label">Amount for Young Children</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.state_ctc.amount_young}
                    onChange={(e) => updateStateCTC({ amount_young: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="label">Amount for Older Children</label>
                  <input
                    type="number"
                    className="input"
                    value={reform.state_ctc.amount_older}
                    onChange={(e) => updateStateCTC({ amount_older: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Toggle
                    enabled={reform.state_ctc.refundable}
                    onChange={(refundable) => updateStateCTC({ refundable })}
                  />
                  <span>Refundable</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary px-8 py-3 text-lg disabled:opacity-50"
        >
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>
    </form>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`toggle ${enabled ? 'toggle-enabled' : 'toggle-disabled'}`}
      onClick={() => onChange(!enabled)}
    >
      <span
        className={`toggle-dot ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}
