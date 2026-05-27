'use client';

import { useState } from 'react';
import type {
  HouseholdInput,
  ChildInput,
  FilingStatus,
  IncomeInput,
} from '@/lib/household-types';
import { defaultHousehold } from '@/lib/household-types';

interface HouseholdFormProps {
  initialValues?: Partial<HouseholdInput>;
  onSubmit: (household: HouseholdInput) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// Selectable "other income" sources. employment_income (and the
// spouse counterpart when married) are always present and not in this
// list. Keys are intentionally restricted to the IncomeInput fields the
// backend already understands.
type OtherIncomeKey =
  | 'self_employment_income'
  | 'social_security_income'
  | 'unemployment_income';

const OTHER_INCOME_OPTIONS: { key: OtherIncomeKey; label: string }[] = [
  { key: 'self_employment_income', label: 'Self-employment income' },
  { key: 'social_security_income', label: 'Social Security' },
  { key: 'unemployment_income', label: 'Unemployment' },
];

function deriveFilingStatus(
  married: boolean,
  hasChildren: boolean,
): FilingStatus {
  if (married) return 'married_filing_jointly';
  if (hasChildren) return 'head_of_household';
  return 'single';
}

export default function HouseholdForm({
  initialValues,
  onSubmit,
  isLoading = false,
  submitLabel = 'Calculate Benefits & Taxes',
}: HouseholdFormProps) {
  const [household, setHousehold] = useState<HouseholdInput>({
    ...defaultHousehold,
    ...initialValues,
  });

  // Marital toggle drives filing_status. Initialize from any incoming
  // filing_status so existing households round-trip correctly.
  const [married, setMarried] = useState(
    initialValues?.filing_status?.startsWith('married') ?? false,
  );

  // Track which optional income sources the user has surfaced. Pre-populate
  // any non-zero values that came in via initialValues.
  const [selectedOtherIncome, setSelectedOtherIncome] = useState<OtherIncomeKey[]>(
    () =>
      OTHER_INCOME_OPTIONS
        .filter(({ key }) => (initialValues?.income?.[key] ?? 0) > 0)
        .map(({ key }) => key),
  );

  const updateHousehold = (updates: Partial<HouseholdInput>) => {
    setHousehold((prev) => ({ ...prev, ...updates }));
  };

  const updateIncome = (updates: Partial<IncomeInput>) => {
    setHousehold((prev) => ({
      ...prev,
      income: { ...prev.income, ...updates },
    }));
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
        i === index ? { ...child, ...updates } : child,
      ),
    }));
  };

  const handleMarriedChange = (next: boolean) => {
    setMarried(next);
    if (next) {
      // Ensure a spouse adult exists; clear single-only state.
      setHousehold((prev) => ({
        ...prev,
        adults: prev.adults.length >= 2 ? prev.adults : [...prev.adults, { age: 30 }],
      }));
    } else {
      // Drop the spouse + their employment income.
      setHousehold((prev) => ({
        ...prev,
        adults: [prev.adults[0] ?? { age: 30 }],
        income: { ...prev.income, spouse_employment_income: 0 },
      }));
    }
  };

  const addOtherIncome = (key: OtherIncomeKey) => {
    if (selectedOtherIncome.includes(key)) return;
    setSelectedOtherIncome((prev) => [...prev, key]);
    updateIncome({ [key]: 0 } as Partial<IncomeInput>);
  };

  const removeOtherIncome = (key: OtherIncomeKey) => {
    setSelectedOtherIncome((prev) => prev.filter((k) => k !== key));
    updateIncome({ [key]: 0 } as Partial<IncomeInput>);
  };

  const availableOtherIncome = OTHER_INCOME_OPTIONS.filter(
    (opt) => !selectedOtherIncome.includes(opt.key),
  );

  // Quick presets
  const applyPreset = (preset: 'single' | 'single_parent' | 'married') => {
    switch (preset) {
      case 'single':
        setMarried(false);
        setHousehold((prev) => ({
          ...prev,
          filing_status: 'single',
          adults: [{ age: 30 }],
          children: [],
          income: { employment_income: 40000 },
        }));
        setSelectedOtherIncome([]);
        break;
      case 'single_parent':
        setMarried(false);
        setHousehold((prev) => ({
          ...prev,
          filing_status: 'head_of_household',
          adults: [{ age: 35 }],
          children: [{ age: 5 }, { age: 8 }],
          income: { employment_income: 35000 },
        }));
        setSelectedOtherIncome([]);
        break;
      case 'married':
        setMarried(true);
        setHousehold((prev) => ({
          ...prev,
          filing_status: 'married_filing_jointly',
          adults: [{ age: 35 }, { age: 33 }],
          children: [{ age: 3 }, { age: 7 }],
          income: { employment_income: 60000, spouse_employment_income: 30000 },
        }));
        setSelectedOtherIncome([]);
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...household,
      filing_status: deriveFilingStatus(married, household.children.length > 0),
    });
  };

  const totalIncome =
    (household.income.employment_income || 0) +
    (household.income.spouse_employment_income || 0) +
    (household.income.self_employment_income || 0) +
    (household.income.social_security_income || 0) +
    (household.income.unemployment_income || 0);

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

      {/* Marital Status */}
      <div className="card">
        <h3 className="section-title">Marital Status</h3>
        <label
          htmlFor="married"
          className="flex items-center gap-3 w-full p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <input
            type="checkbox"
            id="married"
            checked={married}
            onChange={(e) => handleMarriedChange(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">Married</span>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Single filers with children file as head of household automatically.
        </p>
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
            No children added. Click &quot;Add Child&quot; to add dependents.
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
                  updateIncome({
                    employment_income: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          {married && (
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
                    updateIncome({
                      spouse_employment_income: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Other income source selector */}
        {availableOtherIncome.length > 0 && (
          <div className="mt-4">
            <label className="label">Add other income source</label>
            <select
              className="input"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addOtherIncome(e.target.value as OtherIncomeKey);
                }
              }}
            >
              <option value="">+ Add other income source</option>
              {availableOtherIncome.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Selected other income rows */}
        {selectedOtherIncome.length > 0 && (
          <div className="mt-4 space-y-3">
            {selectedOtherIncome.map((key) => {
              const label = OTHER_INCOME_OPTIONS.find((o) => o.key === key)?.label ?? key;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="label">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        className="input pl-7"
                        value={household.income[key] || 0}
                        min={0}
                        onChange={(e) =>
                          updateIncome({
                            [key]: parseInt(e.target.value) || 0,
                          } as Partial<IncomeInput>)
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOtherIncome(key)}
                    aria-label={`Remove ${label}`}
                    className="mt-6 p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Annual Income:</span>
            <span className="font-semibold">${totalIncome.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn btn-primary w-full py-3 text-lg"
      >
        {isLoading ? 'Calculating...' : submitLabel}
      </button>
    </form>
  );
}
