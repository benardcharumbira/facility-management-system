import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityLog } from './detail/ActivityLog';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { DateRangeFilter, type DateRange } from './filters/DateRangeFilter';
import { ResultsSection } from './list/ResultsSection';
import { StatusBadge } from './ui/StatusBadge';

describe('StatusBadge', () => {
  it('always carries the status in words, beside its pattern and icon', () => {
    const { container } = render(
      <StatusBadge
        label="Pending"
        icon={<svg data-testid="icon" />}
        pattern="striped"
        className="text-warning"
      />,
    );
    expect(screen.getByText('Pending')).toBeVisible();
    expect(container.querySelector('.pattern-striped')).not.toBeNull();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Sure?"
          description="It cannot be undone."
          confirmLabel="Do it"
          onConfirm={onConfirm}
        >
          <p>Extra field</p>
        </ConfirmDialog>
      </>
    );
  }

  it('traps focus, closes on Escape and returns focus to the opener', async () => {
    render(<Harness onConfirm={async () => {}} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('alertdialog', { name: 'Sure?' });
    expect(within(dialog).getByText('Extra field')).toBeVisible();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes after the work succeeds, and stays open with the message if it fails', async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('Not today'))
      .mockResolvedValueOnce(undefined);
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Do it' }));
    expect(await screen.findByText('Not today')).toBeVisible();
    expect(screen.getByRole('alertdialog')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Do it' }));
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});

describe('DateRangeFilter', () => {
  it('reports each end and stops the range being reversed', async () => {
    function Harness() {
      const [range, setRange] = useState<DateRange>({ from: undefined, to: '2026-11-10' });
      return <DateRangeFilter label="Event date" value={range} onChange={setRange} />;
    }
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Event date' });
    expect(within(group).getByLabelText('From')).toHaveAttribute('max', '2026-11-10');
    expect(within(group).getByLabelText('To')).toHaveValue('2026-11-10');
    await userEvent.type(within(group).getByLabelText('From'), '2026-11-01');
    expect(within(group).getByLabelText('To')).toHaveAttribute('min', '2026-11-01');
  });
});

describe('ActivityLog and ResultsSection', () => {
  it('lists events in order with their times and actors', () => {
    render(
      <ActivityLog
        label="History"
        entries={[
          { key: 'a', title: 'Submitted', when: '1 November 2026, 10:00', actor: 'you' },
          {
            key: 'b',
            title: 'Approved',
            when: '3 November 2026, 09:00',
            actor: 'the municipality',
            detail: 'Looks fine',
          },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'History' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Submitted by you');
    expect(items[1]).toHaveTextContent('Approved by the municipality');
    expect(items[1]).toHaveTextContent('Looks fine');
  });

  it('titles a group of results', () => {
    render(
      <ResultsSection title="Upcoming" count={2}>
        <p>rows</p>
      </ResultsSection>,
    );
    expect(screen.getByRole('region', { name: /^Upcoming/ })).toHaveTextContent('rows');
  });
});
