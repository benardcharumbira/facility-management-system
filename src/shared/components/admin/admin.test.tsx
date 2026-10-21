import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { ImpactResult, OperatingDay } from '@/shared/api';
import { rangeToInstants, EMPTY_DATE_RANGE } from './DateRangeField';
import { HierarchySelect } from './HierarchySelect';
import { ImpactList } from './ImpactDialog';
import { ScheduleEditor } from './ScheduleEditor';
import { SectionedEditLayout } from './SectionedEditLayout';
import { UnsavedChangesBar } from './UnsavedChangesBar';
import { useImpactGuard, type GuardOutcome } from './useImpactGuard';

const booking = (id: string, reason: ImpactResult['affectedBookings'][number]['reason']) => ({
  bookingId: id,
  reference: `MVL-2026-${id}`,
  applicantName: 'Grace Mthembu',
  facility: { id: 'f', name: 'Rothdene Hall', timeZone: 'Africa/Johannesburg' },
  startsAt: '2026-12-12T07:00:00Z',
  endsAt: '2026-12-12T11:00:00Z',
  status: 'approved',
  reason,
  conflictsWith: null,
});

const none: ImpactResult = { affectedBookings: [], totalAffected: 0 };
const some: ImpactResult = {
  affectedBookings: [booking('1', 'inside_blackout'), booking('2', 'over_capacity')],
  totalAffected: 2,
};

function Guarded({
  impact,
  apply,
  onOutcome,
}: {
  impact: ImpactResult;
  apply: () => Promise<void>;
  onOutcome: (outcome: GuardOutcome) => void;
}) {
  const { guard, dialog } = useImpactGuard();
  return (
    <>
      <button
        onClick={() =>
          void guard({
            check: async () => impact,
            apply,
            title: 'Do the thing?',
            summary: 'It will happen.',
            confirmLabel: 'Do it',
          }).then(onOutcome)
        }
      >
        Save
      </button>
      {dialog}
    </>
  );
}

describe('useImpactGuard', () => {
  it('applies at once, with no dialog, when nothing is affected', async () => {
    const apply = vi.fn(async () => {});
    const onOutcome = vi.fn();
    render(<Guarded impact={none} apply={apply} onOutcome={onOutcome} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('applied'));
    expect(apply).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows what is affected and applies nothing until confirmed', async () => {
    const apply = vi.fn(async () => {});
    const onOutcome = vi.fn();
    render(<Guarded impact={some} apply={apply} onOutcome={onOutcome} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Do the thing?' });
    expect(within(dialog).getByText('2 bookings are affected:')).toBeVisible();
    expect(within(dialog).getByText('MVL-2026-1')).toBeVisible();
    expect(within(dialog).getByText('MVL-2026-2')).toBeVisible();
    expect(apply).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Do it' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('applied'));
    expect(apply).toHaveBeenCalledOnce();
  });

  it('reports a cancel, and applies nothing, when the person goes back', async () => {
    const apply = vi.fn(async () => {});
    const onOutcome = vi.fn();
    render(<Guarded impact={some} apply={apply} onOutcome={onOutcome} />);
    const save = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(save);
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Go back' }),
    );
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('cancelled'));
    expect(apply).not.toHaveBeenCalled();
    await waitFor(() => expect(save).toHaveFocus());
  });

  it('also reports a cancel on Escape', async () => {
    const onOutcome = vi.fn();
    render(<Guarded impact={some} apply={async () => {}} onOutcome={onOutcome} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('cancelled'));
  });

  it('keeps the dialog open with the reason when applying fails, so it can be retried', async () => {
    let attempts = 0;
    const onOutcome = vi.fn();
    render(
      <Guarded
        impact={some}
        apply={async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('The server said no.');
        }}
        onOutcome={onOutcome}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Do it' }));
    expect(await within(dialog).findByText('The server said no.')).toBeVisible();
    expect(onOutcome).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Do it' }));
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith('applied'));
  });

  it('throws a failure of the check to the caller instead of showing a dialog', async () => {
    function Failing() {
      const { guard } = useImpactGuard();
      const [message, setMessage] = useState('');
      return (
        <button
          onClick={() =>
            void guard({
              check: async () => {
                throw new Error('No such facility');
              },
              apply: async () => {},
              title: 't',
              summary: 's',
              confirmLabel: 'c',
            }).catch((error: Error) => setMessage(error.message))
          }
        >
          {message || 'Save'}
        </button>
      );
    }
    render(<Failing />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'No such facility' })).toBeVisible();
  });
});

describe('ImpactList', () => {
  it('says in a sentence why each booking is affected', () => {
    render(
      <ImpactList
        impact={{
          totalAffected: 5,
          affectedBookings: [
            booking('1', 'inside_blackout'),
            booking('2', 'outside_operating_hours'),
            {
              ...booking('3', 'new_conflict'),
              conflictsWith: {
                bookingId: 'x',
                reference: 'MVL-2026-9',
                facility: { id: 'a', name: 'City Hall' },
              },
            },
            booking('4', 'over_capacity'),
            booking('5', 'facility_unavailable'),
          ],
        }}
      />,
    );
    expect(screen.getByText('Falls inside the closure.')).toBeVisible();
    expect(screen.getByText('Would fall outside the new operating hours.')).toBeVisible();
    expect(screen.getByText('Would now clash with MVL-2026-9 at City Hall.')).toBeVisible();
    expect(screen.getByText('Expects more people than the new capacity allows.')).toBeVisible();
    expect(screen.getByText('The facility would no longer be available for it.')).toBeVisible();
    expect(screen.getAllByText('Sat 12 Dec, 09:00 to 13:00')).toHaveLength(5);
  });
});

describe('HierarchySelect', () => {
  it('offers only the options it is given, so a cycle cannot be chosen', async () => {
    const onChange = vi.fn();
    render(
      <HierarchySelect
        label="Part of"
        value={null}
        eligible={[{ id: 'a', name: 'City Hall' }]}
        onChange={onChange}
      />,
    );
    const options = within(screen.getByLabelText('Part of')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['None: a standalone facility', 'City Hall']);
    await userEvent.selectOptions(screen.getByLabelText('Part of'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
    await userEvent.selectOptions(screen.getByLabelText('Part of'), '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('ScheduleEditor', () => {
  const week: OperatingDay[] = Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i + 1,
    opensAt: i < 5 ? '08:00' : null,
    closesAt: i < 5 ? '17:00' : null,
  }));

  function Host({ onChange }: { onChange?: (days: OperatingDay[]) => void }) {
    const [days, setDays] = useState(week);
    return (
      <ScheduleEditor
        value={days}
        onChange={(next) => {
          setDays(next);
          onChange?.(next);
        }}
      />
    );
  }

  it('shows closed as a choice, not blank times', () => {
    render(<Host />);
    const sunday = within(screen.getByRole('radiogroup', { name: 'Sunday is' }));
    expect(sunday.getByRole('radio', { name: 'Closed' })).toBeChecked();
    // Saturday and Sunday.
    expect(screen.getAllByText('Closed all day', { selector: 'span' })).toHaveLength(2);
    expect(screen.queryByLabelText('Sunday opens')).not.toBeInTheDocument();
  });

  it('opens a closed day with sensible hours, and closes an open one', async () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Saturday is' })).getByRole('radio', {
        name: 'Open',
      }),
    );
    expect(screen.getByLabelText('Saturday opens')).toHaveValue('08:00');
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Monday is' })).getByRole('radio', {
        name: 'Closed',
      }),
    );
    expect(onChange.mock.lastCall?.[0][0]).toMatchObject({ opensAt: null, closesAt: null });
  });
});

describe('rangeToInstants', () => {
  it('runs a whole-day range to the start of the day after the last, in the facility zone', () => {
    expect(
      rangeToInstants(
        { ...EMPTY_DATE_RANGE, startDate: '2026-12-12', endDate: '2026-12-13', allDay: true },
        'Africa/Johannesburg',
      ),
    ).toEqual({
      startsAt: '2026-12-11T22:00:00Z',
      endsAt: '2026-12-13T22:00:00Z',
      allDay: true,
    });
  });

  it('uses the times given when it is not a whole day, and is null while incomplete', () => {
    expect(
      rangeToInstants(
        {
          startDate: '2026-12-12',
          endDate: '2026-12-12',
          allDay: false,
          startTime: '12:00',
          endTime: '14:30',
        },
        'Africa/Johannesburg',
      ),
    ).toEqual({ startsAt: '2026-12-12T10:00:00Z', endsAt: '2026-12-12T12:30:00Z', allDay: false });
    expect(rangeToInstants(EMPTY_DATE_RANGE, 'Africa/Johannesburg')).toBeNull();
  });
});

describe('SectionedEditLayout', () => {
  it('links every section, marking the current one', () => {
    render(
      <MemoryRouter>
        <SectionedEditLayout
          sections={[
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta', flag: <span>None</span> },
          ]}
          current="b"
          hrefFor={(id) => `/x?section=${id}`}
        >
          <p>Body</p>
        </SectionedEditLayout>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Beta None' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/x?section=a');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });
});

describe('UnsavedChangesBar', () => {
  it('announces the count politely, and offers nothing to save when there is nothing', () => {
    const { rerender } = render(
      <UnsavedChangesBar count={0} onSave={() => {}} onDiscard={() => {}} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('No unsaved changes');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    rerender(<UnsavedChangesBar count={1} onSave={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 unsaved change');
    rerender(<UnsavedChangesBar count={12} onSave={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('12 unsaved changes');
    expect(screen.getByRole('button', { name: 'Save 12 changes' })).toBeEnabled();
  });

  it('saves and discards on request, and shows a failed save without losing the count', async () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    render(
      <UnsavedChangesBar
        count={2}
        onSave={onSave}
        onDiscard={onDiscard}
        error="Nothing was saved."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved.');
    expect(screen.getByRole('status')).toHaveTextContent('2 unsaved changes');
    await userEvent.click(screen.getByRole('button', { name: 'Save 2 changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('cannot be used twice while saving', () => {
    render(<UnsavedChangesBar count={2} saving onSave={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
