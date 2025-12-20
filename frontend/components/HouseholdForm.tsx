'use client';

import { useState } from 'react';
import type {
  HouseholdInput,
  PersonInput,
  ChildInput,
  FilingStatus,
} from '@/lib/household-types';
import { US_STATES, defaultHousehold } from '@/lib/household-types';

interface HouseholdFormProps {
  initialValues?: Partial<HouseholdInput>;
  onSubmit: (household: HouseholdInput) => void;
  isLoading?: boolean;
}

export default function HouseholdForm({
  initialValues,
  onSubmit,
  isLoading = false,
}: HouseholdFormProps) {
  const [household, setHousehold] = useState<HouseholdInput>({
    ...defaultHousehold,
    ...initialValues,
  });

  const updateHousehold = (updates: Partial<HouseholdInput>) => {
    setHousehold((prev) => ({ ...prev, ...updates }));
  };

  const addChild = () => {
    setHousehold((prev) => ({
      ...prev,
      children: [...prev.children, { age: 5 }],
    }));
  };

  const removeChild = (index: number) => {
    setHousehold((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }));
  };

  const updateChild = (index: number, updates: Partial<ChildInput>) => {
    setHousehold((prev) => ({
      ...prev,
      children: prev.children.map((child, i) =>
        i === index ? { ...child, ...updates } : child
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(household);
  };

  // Quick presets
  const applyPreset = (preset: 'single' | 'single_parent' | 'married') => {
    switch (preset) {
      case 'single':
        setHousehold({
          ...household,
          filing_status: 'single',
          adults: [{ age: 30 }],
          children: [],
          income: { employment_income: 40000 },
        });
        break;
      case 'single_parent':
        setHousehold({
          ...household,
          filing_status: 'head_of_household',
          adults: [{ age: 35 }],
          children: [{ age: 5 }, { age: 8 }],
          income: { employment_income: 35000 },
        });
        break;
      case 'married':
        setHousehold({
          ...household,
          filing_status: 'married_filing_jointly',
          adults: [{ age: 35 }, { age: 33 }],
          children: [{ age: 3 }, { age: 7 }],
          income: { employment_income: 60000, spouse_employment_income: 30000 },
        });
        break;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quick Presets */}
      <div className="card">
        <h3 className="section-title">Quick Setup</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('single')}
            className="btn btn-secondary text-sm"
          >
            Single Adult
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single_parent')}
            className="btn btn-secondary text-sm"
          >
            Single Parent (2 kids)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('married')}
            className="btn btn-secondary text-sm"
          >
            Married (2 kids)
          </button>
        </div>
      </div>

      {/* State Selection */}
      <div className="card">
        <h3 className="section-title">Location</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">State</label>
            <select
              className="input"
              value={household.state}
              onChange={(e) => updateHousehold({ state: e.target.value })}
            >
              {Object.entries(US_STATES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tax Year</label>
            <select
              className="input"
              value={household.year}
              onChange={(e) => updateHousehold({ year: parseInt(e.target.value) })}
            >
              {[2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filing Status */}
      <div className="card">
        <h3 className="section-title">Filing Status</h3>
        <select
          className="input"
          value={household.filing_status}
          onChange={(e) => updateHousehold({ filing_status: e.target.value as FilingStatus })}
        >
          <option value="single">Single</option>
          <option value="married_filing_jointly">Married Filing Jointly</option>
          <option value="married_filing_separately">Married Filing Separately</option>
          <option value="head_of_household">Head of Household</option>
          <option value="surviving_spouse">Surviving Spouse</option>
        </select>
      </div>

      {/* Adults */}
      <div className="card">
        <h3 className="section-title">Adults</h3>
        <div className="space-y-4">
          {household.adults.map((adult, index) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
              <span className="font-medium text-gray-600">
                {index === 0 ? 'You' : 'Spouse'}
              </span>
              <div className="flex-1">
                <label className="text-sm text-gray-500">Age</label>
                <input
                  type="number"
                  className="input"
                  value={adult.age}
                  min={18}
                  max={120}
                  onChange={(e) => {
                    const newAdults = [...household.adults];
                    newAdults[index] = { ...adult, age: parseInt(e.target.value) || 30 };
                    updateHousehold({ adults: newAdults });
                  }}
                />
              </div>
            </div>
          ))}

          {household.adults.length === 1 &&
            household.filing_status.includes('married') && (
              <button
                type="button"
                onClick={() =>
                  updateHousehold({ adults: [...household.adults, { age: 30 }] })
                }
                className="btn btn-secondary text-sm"
              >
                + Add Spouse
              </button>
            )}
        </div>
      </div>

      {/* Children */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title mb-0">Children</h3>
          <button
            type="button"
            onClick={addChild}
            className="btn btn-primary btn-sm"
          >
            + Add Child
          </button>
        </div>

        {household.children.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No children added. Click "Add Child" to add dependents.
          </p>
        ) : (
          <div className="space-y-4">
            {household.children.map((child, index) => (
              <div
                key={index}
                className="p-4 border border-gray-200 rounded-lg space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">Child {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Age</label>
                    <input
                      type="number"
                      className="input"
                      value={child.age}
                      min={0}
                      max={17}
                      onChange={(e) =>
                        updateChild(index, { age: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`childcare-${index}`}
                      checked={child.in_childcare || false}
                      onChange={(e) =>
                        updateChild(index, { in_childcare: e.target.checked })
                      }
                    />
                    <label htmlFor={`childcare-${index}`} className="text-sm">
                      In childcare
                    </label>
                  </div>
                  {child.in_childcare && (
                    <div>
                      <label className="text-sm text-gray-500">Annual Cost</label>
                      <input
                        type="number"
                        className="input"
                        value={child.childcare_expenses_annual || 0}
                        min={0}
                        onChange={(e) =>
                          updateChild(index, {
                            childcare_expenses_annual: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Income */}
      <div className="card">
        <h3 className="section-title">Income</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Your Employment Income</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                className="input pl-7"
                value={household.income.employment_income}
                min={0}
                onChange={(e) =>
                  updateHousehold({
                    income: {
                      ...household.income,
                      employment_income: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>

          {household.adults.length > 1 && (
            <div>
              <label className="label">Spouse Employment Income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  className="input pl-7"
                  value={household.income.spouse_employment_income || 0}
                  min={0}
                  onChange={(e) =>
                    updateHousehold({
                      income: {
                        ...household.income,
                        spouse_employment_income: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Self-Employment Income</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                className="input pl-7"
                value={household.income.self_employment_income || 0}
                min={0}
                onChange={(e) =>
                  updateHousehold({
                    income: {
                      ...household.income,
                      self_employment_income: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="label">Other Income (SS, Unemployment, etc.)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                className="input pl-7"
                value={
                  (household.income.social_security_income || 0) +
                  (household.income.unemployment_income || 0)
                }
                min={0}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  updateHousehold({
                    income: {
                      ...household.income,
                      social_security_income: val,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Annual Income:</span>
            <span className="font-semibold">
              $
              {(
                (household.income.employment_income || 0) +
                (household.income.spouse_employment_income || 0) +
                (household.income.self_employment_income || 0) +
                (household.income.social_security_income || 0) +
                (household.income.unemployment_income || 0)
              ).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary w-full py-3 text-lg"
      >
        {isLoading ? 'Calculating...' : 'Calculate Benefits & Taxes'}
      </button>
    </form>
  );
}
