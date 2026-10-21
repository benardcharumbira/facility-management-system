import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { BookingOptions, FacilityDetail } from '@/shared/api';
import { EMPTY_VALUES } from '../values';
import { StepResources } from './StepResources';

const options = {
  resources: [
    { id: 'chairs', name: 'Chairs', category: 'venue', quantified: true },
    { id: 'stage', name: 'Stage', category: 'venue', quantified: false },
    { id: 'kitchen-urn', name: 'Urn', category: 'kitchen', quantified: true },
  ],
} as unknown as BookingOptions;

const facility = {
  resources: [
    { id: 'chairs', name: 'Chairs', category: 'venue', quantity: 40, quantified: true },
    { id: 'stage', name: 'Stage', category: 'venue', quantity: 1, quantified: false },
    { id: 'kitchen-urn', name: 'Urn', category: 'kitchen', quantity: 2, quantified: true },
  ],
} as unknown as FacilityDetail;

function Host() {
  const form = useForm({ defaultValues: EMPTY_VALUES });
  const chosen = useWatch({ control: form.control, name: 'resources' });
  return (
    <FormProvider {...form}>
      <StepResources options={options} facility={facility} />
      <output aria-label="chosen">{JSON.stringify(chosen)}</output>
    </FormProvider>
  );
}

describe('the resources step of the booking form', () => {
  it('gives something counted a quantity, capped at what the venue holds', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chairs' }));
    const quantity = await screen.findByRole('textbox', { name: 'Chairs quantity' });
    expect(quantity).toHaveValue('1');
    expect(screen.getByText('Up to 40 available.')).toBeVisible();
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '90{Enter}');
    expect(quantity).toHaveValue('40');
    expect(screen.getByText('Only 40 available, so the quantity was set to 40.')).toBeVisible();
  });

  it('gives something that is present or not no quantity at all', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stage' }));
    expect(screen.queryByRole('textbox', { name: 'Stage quantity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Increase Stage' })).not.toBeInTheDocument();
    // It is requested as one.
    expect(screen.getByLabelText('chosen')).toHaveTextContent('{"stage":1}');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Stage' }));
    expect(screen.getByLabelText('chosen')).toHaveTextContent('{}');
  });

  it('keeps the kitchen behind a disclosure, and counts it there too', async () => {
    render(<Host />);
    expect(screen.queryByRole('checkbox', { name: 'Urn' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Kitchen resources/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Urn' }));
    expect(
      within(screen.getByRole('group', { name: 'Kitchen resources' })).getByRole('textbox', {
        name: 'Urn quantity',
      }),
    ).toBeVisible();
  });
});
