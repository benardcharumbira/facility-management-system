import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FacilityResource } from '@/shared/api';
import { FacilityResources } from './FacilityResources';

const resources: FacilityResource[] = [
  { id: 'chairs', name: 'Chairs', category: 'venue', quantity: 200, quantified: true },
  { id: 'stage', name: 'Stage', category: 'venue', quantity: 1, quantified: false },
  { id: 'kitchen-urn', name: 'Urn', category: 'kitchen', quantity: 2, quantified: true },
];

describe('a facility’s resources', () => {
  it('shows a number for what is counted and none for what is present or not', () => {
    render(<FacilityResources resources={resources} />);
    const list = screen.getByRole('list', { name: 'Venue resources' });
    expect(within(list).getByText('Chairs').parentElement).toHaveTextContent('× 200');
    const stage = within(list).getByText('Stage').parentElement as HTMLElement;
    expect(stage).not.toHaveTextContent('×');
    expect(stage).not.toHaveTextContent('1');
  });

  it('keeps the kitchen behind a disclosure', async () => {
    render(<FacilityResources resources={resources} />);
    expect(screen.queryByText('Urn')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Kitchen equipment/ }));
    expect(await screen.findByText('Urn')).toBeVisible();
  });
});
