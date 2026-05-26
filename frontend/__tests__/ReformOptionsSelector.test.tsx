import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ReformOptionsSelector from '@/components/ReformOptionsSelector';
import type { ReformOption, StateReformOptions } from '@/lib/household-types';

const eitcOption: ReformOption = {
  id: 'ny_eitc',
  name: 'New York EITC',
  description: 'Adjust state EITC as a percentage of the federal EITC.',
  category: 'state_eitc',
  is_new_program: false,
  is_enhancement: true,
  customizable_params: [],
  is_configurable: true,
  estimated_household_impact: 500,
  adjustable_params: [
    {
      name: 'match_rate',
      label: 'Match rate',
      min_value: 0,
      max_value: 100,
      default_value: 30,
      step: 5,
      unit: '%',
      description: 'Percentage of federal EITC.',
    },
  ],
};

const reformOptions: StateReformOptions = {
  state_code: 'NY',
  state_name: 'New York',
  has_income_tax: true,
  existing_programs: {},
  ctc_options: [],
  eitc_options: [eitcOption],
  snap_options: [],
  child_allowance_options: [],
  federal_options: [],
};

describe('ReformOptionsSelector', () => {
  it('renders the EITC option for the state', () => {
    render(
      <ReformOptionsSelector
        stateCode="NY"
        reformOptions={reformOptions}
        selectedOptions={[]}
        onSelectionChange={() => {}}
      />
    );
    expect(screen.getByText('New York EITC')).toBeInTheDocument();
  });

  it('calls onSelectionChange when the option card is toggled', () => {
    const onSelectionChange = vi.fn();
    render(
      <ReformOptionsSelector
        stateCode="NY"
        reformOptions={reformOptions}
        selectedOptions={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(screen.getByText('New York EITC'));
    expect(onSelectionChange).toHaveBeenCalledWith(['ny_eitc']);
  });

  it('exposes the match-rate slider when an option is selected and reports parameter changes', () => {
    const onParameterChange = vi.fn();
    render(
      <ReformOptionsSelector
        stateCode="NY"
        reformOptions={reformOptions}
        selectedOptions={['ny_eitc']}
        onSelectionChange={() => {}}
        parameterValues={{ ny_eitc: { match_rate: 30 } }}
        onParameterChange={onParameterChange}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '50' } });
    expect(onParameterChange).toHaveBeenCalledWith('ny_eitc', 'match_rate', 50);
  });

  it('shows the loading state when isLoading is true', () => {
    render(
      <ReformOptionsSelector
        stateCode="NY"
        selectedOptions={[]}
        onSelectionChange={() => {}}
        isLoading
      />
    );
    expect(screen.getByText(/Loading reform options for NY/)).toBeInTheDocument();
  });

  it('shows an empty-tab message when the active tab has no options', () => {
    render(
      <ReformOptionsSelector
        stateCode="NY"
        reformOptions={{ ...reformOptions, eitc_options: [] }}
        selectedOptions={[]}
        onSelectionChange={() => {}}
      />
    );
    // EITC is the default active tab
    expect(screen.getByText(/No eitc options available/)).toBeInTheDocument();
  });
});
