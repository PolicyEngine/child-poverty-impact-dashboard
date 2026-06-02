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
  | 'capital_gains'
  | 'self_employment_income'
  | 'social_security_income'
  | 'pension_income'
  | 'dividend_income'
  | 'taxable_interest_income'
  | 'taxable_retirement_distributions'
  | 'unemployment_income';

const OTHER_INCOME_OPTIONS: { key: OtherIncomeKey; label: string }[] = [
  { key: 'capital_gains', label: 'Capital gains' },
  { key: 'self_employment_income', label: 'Self-employment income' },
  { key: 'social_security_income', label: 'Social Security' },
  { key: 'pension_income', label: 'Pension income' },
  { key: 'dividend_income', label: 'Dividend income' },
  { key: 'taxable_interest_income', label: 'Taxable interest' },
  { key: 'taxable_retirement_distributions', label: 'Retirement distributions' },
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
    (household.income.unemployment_income || 0) +
    (household.income.pension_income || 0) +
    (household.income.capital_gains || 0) +
    (household.income.dividend_income || 0) +
    (household.income.taxable_interest_income || 0) +
    (household.income.taxable_retirement_distributions || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Quick Presets + Marital Status — one row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-pe-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-pe-gray-500 font-semibold mr-1">
            Quick setup
          </span>
          <button
            type="button"
            onClick={() => applyPreset('single')}
            className="btn btn-secondary btn-sm"
          >
            Single adult
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single_parent')}
            className="btn btn-secondary btn-sm"
          >
            Single parent
          </button>
          <button
            type="button"
            onClick={() => applyPreset('married')}
            className="btn btn-secondary btn-sm"
          >
            Married, 2 kids
          </button>
        </div>
        <label
          htmlFor="married"
          className="flex items-center gap-2 cursor-pointer text-sm text-pe-gray-700"
        >
          <input
            type="checkbox"
            id="married"
            checked={married}
            onChange={(e) => handleMarriedChange(e.target.checked)}
            className="h-4 w-4 accent-pe-teal-500"
          />
          Married
        </label>
      </div>

      {/* Adults + Income — left column adults / right column primary income */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-pe-gray-500 font-semibold">
            Adults
          </h4>
          {household.adults.map((adult, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-sm text-pe-gray-600 w-16">
                {index === 0 ? 'You' : 'Spouse'}
              </span>
              <label className="text-xs text-pe-gray-500">Age</label>
              <input
                type="number"
                className="input py-1.5 w-24"
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
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-pe-gray-500 font-semibold">
            Employment income
          </h4>
          <div className="flex items-center gap-3">
            <span className="text-sm text-pe-gray-600 w-16">You</span>
            <div className="relative flex-1 max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pe-gray-500">$</span>
              <input
                type="number"
                className="input pl-7 py-1.5"
                value={household.income.employment_income}
                min={0}
                onChange={(e) =>
                  updateIncome({ employment_income: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          {married && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-pe-gray-600 w-16">Spouse</span>
              <div className="relative flex-1 max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pe-gray-500">$</span>
                <input
                  type="number"
                  className="input pl-7 py-1.5"
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
      </div>

      {/* Children */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs uppercase tracking-wide text-pe-gray-500 font-semibold">
            Children
          </h4>
          <button
            type="button"
            onClick={addChild}
            className="text-sm text-pe-teal-600 hover:text-pe-teal-700 font-medium"
          >
            + Add child
          </button>
        </div>
        {household.children.length === 0 ? (
          <p className="text-xs text-pe-gray-500">No children added.</p>
        ) : (
          <div className="rounded-lg border border-pe-gray-100 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[5rem_4.5rem_8rem_8rem_2rem] items-center gap-3 px-3 py-2 bg-pe-gray-50 text-[11px] uppercase tracking-wide text-pe-gray-500 font-semibold">
              <span></span>
              <span>Age</span>
              <span>Childcare</span>
              <span>Annual cost</span>
              <span></span>
            </div>
            {household.children.map((child, index) => (
              <div
                key={index}
                className="grid grid-cols-[5rem_4.5rem_8rem_8rem_2rem] items-center gap-3 px-3 py-2 border-t border-pe-gray-100 hover:bg-pe-gray-50/60 transition-colors"
              >
                <span className="text-sm text-pe-gray-700 font-medium">
                  Child {index + 1}
                </span>
                <input
                  type="number"
                  className="input py-1"
                  value={child.age}
                  min={0}
                  max={17}
                  onChange={(e) =>
                    updateChild(index, { age: parseInt(e.target.value) || 0 })
                  }
                />
                <label className="flex items-center gap-1.5 text-xs text-pe-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={child.in_childcare || false}
                    onChange={(e) =>
                      updateChild(index, { in_childcare: e.target.checked })
                    }
                    className="h-3.5 w-3.5 accent-pe-teal-500"
                  />
                  In childcare
                </label>
                {child.in_childcare ? (
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-pe-gray-500 text-xs">
                      $
                    </span>
                    <input
                      type="number"
                      className="input pl-5 py-1"
                      value={child.childcare_expenses_annual || 0}
                      min={0}
                      onChange={(e) =>
                        updateChild(index, {
                          childcare_expenses_annual: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ) : (
                  <span className="text-xs text-pe-gray-300">—</span>
                )}
                <button
                  type="button"
                  onClick={() => removeChild(index)}
                  className="text-pe-gray-400 hover:text-red-500 justify-self-center"
                  aria-label="Remove child"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Other income */}
      {(selectedOtherIncome.length > 0 || availableOtherIncome.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs uppercase tracking-wide text-pe-gray-500 font-semibold">
              Other income
            </h4>
            {availableOtherIncome.length > 0 && (
              <select
                className="text-sm border border-pe-gray-200 rounded px-2 py-1 text-pe-teal-600 bg-white font-medium"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addOtherIncome(e.target.value as OtherIncomeKey);
                  }
                }}
              >
                <option value="">+ Add source</option>
                {availableOtherIncome.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedOtherIncome.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {selectedOtherIncome.map((key) => {
                const label = OTHER_INCOME_OPTIONS.find((o) => o.key === key)?.label ?? key;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-pe-gray-600 flex-1 truncate" title={label}>
                      {label}
                    </span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-pe-gray-500 text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        className="input pl-5 py-1 w-28"
                        value={household.income[key] || 0}
                        min={0}
                        onChange={(e) =>
                          updateIncome({
                            [key]: parseInt(e.target.value) || 0,
                          } as Partial<IncomeInput>)
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOtherIncome(key)}
                      aria-label={`Remove ${label}`}
                      className="text-pe-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Total + submit */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-pe-gray-100">
        <div className="text-sm">
          <span className="text-pe-gray-500">Total annual income: </span>
          <span className="font-semibold text-pe-gray-800">
            ${totalIncome.toLocaleString()}
          </span>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? 'Calculating…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
