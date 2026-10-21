import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedFacilityAdmin, seedSpanRequests } from '@/mocks/data/facilityAdminSeeds';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
  seedSpanRequests(FIXED_NOW);
});

const open = async (facility: string, month = '2026-11', extra = '') => {
  const view = renderApp(`/facilities/${facility}?month=${month}${extra}`);
  const grid = await screen.findByRole('grid', {
    name: new RegExp(
      `^(${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].join('|')}) 20\\d\\d$`,
    ),
  });
  return { ...view, grid };
};
const severalMode = () =>
  userEvent.click(screen.getByRole('button', { name: 'Choose several days' }));
/** A day's cell by its date, whatever else is on screen (a dialog hides the rest from the tree). */
const day = (iso: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`)!;
const band = (iso: string) =>
  day(iso).querySelector('[data-range]')?.getAttribute('data-range') ?? null;
const panel = () => screen.findByRole('dialog');

describe('choosing several days', () => {
  it('is off until asked for, so a click on a day opens that day as before', async () => {
    const { router } = await open('lakeside-hall');
    expect(screen.getByRole('button', { name: 'Choose several days' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(day('2026-11-27'));
    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).not.toContain('dateTo');
    expect(await panel()).toBeVisible();
  });

  it('takes a click on the first day and a click on the last, and shows the run joined up', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    expect(screen.getByRole('button', { name: 'Choose several days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(day('2026-11-27'));
    expect(
      screen.getByText('Start day: Friday 27 November. Now choose the last day.'),
    ).toBeVisible();
    // Hovering over a later day previews the run before it is chosen.
    await userEvent.hover(day('2026-11-29'));
    expect(band('2026-11-27')).toBe('start');
    expect(band('2026-11-28')).toBe('middle');
    expect(band('2026-11-29')).toBe('end');
    await userEvent.click(day('2026-11-29'));

    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
    const dialog = await panel();
    expect(within(dialog).getByText('Friday 27 November to Sunday 29 November')).toBeVisible();
  });

  it('is continuous across the end of a week, not a set of separate days', async () => {
    await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-28'));
    await userEvent.hover(day('2026-12-01'));
    // Saturday, Sunday, then Monday and Tuesday on the next row.
    expect(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'].map(band)).toEqual([
      'start',
      'middle',
      'middle',
      'end',
    ]);
    expect(band('2026-11-27')).toBeNull();
    expect(band('2026-12-02')).toBeNull();
    // The two rows are different rows of the grid.
    expect(day('2026-11-29').closest('tr')).not.toBe(day('2026-11-30').closest('tr'));
    // Every cell in the run is tinted, so it reads as a band and not as dots.
    for (const iso of ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']) {
      expect(day(iso).className).toContain('bg-primary-soft');
    }
  });

  it('takes the two days in either order', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-29'));
    await userEvent.click(day('2026-11-27'));
    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
  });

  it('can be dragged across', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: day('2026-11-27') },
      { target: day('2026-11-28') },
      { target: day('2026-11-29') },
      { keys: '[/MouseLeft]', target: day('2026-11-29') },
    ]);
    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
    expect(await panel()).toBeVisible();
  });

  it('can be dragged backwards', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: day('2026-11-29') },
      { target: day('2026-11-27') },
      { keys: '[/MouseLeft]', target: day('2026-11-27') },
    ]);
    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
  });

  it('is done with the keyboard: Enter starts it, the arrows extend it, Enter confirms it', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    day('2026-11-27').focus();
    await userEvent.keyboard('{Enter}');
    expect(
      screen.getByText('Start day: Friday 27 November. Now choose the last day.'),
    ).toBeVisible();
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}');
    expect(document.activeElement).toBe(day('2026-11-29'));
    expect(['2026-11-27', '2026-11-28', '2026-11-29'].map(band)).toEqual([
      'start',
      'middle',
      'end',
    ]);
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
    expect(await panel()).toBeVisible();
  });

  it('extends with the plain arrows too, and down a week', async () => {
    await open('lakeside-hall');
    await severalMode();
    day('2026-11-23').focus();
    await userEvent.keyboard('{Enter}{ArrowDown}');
    expect(document.activeElement).toBe(day('2026-11-30'));
    expect(band('2026-11-23')).toBe('start');
    expect(band('2026-11-26')).toBe('middle');
    expect(band('2026-11-30')).toBe('end');
  });

  it('is dropped with Escape', async () => {
    await open('lakeside-hall');
    await severalMode();
    day('2026-11-27').focus();
    await userEvent.keyboard('{Enter}{ArrowRight}');
    expect(band('2026-11-28')).toBe('end');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('Choosing days cancelled.')).toBeVisible();
    expect(band('2026-11-27')).toBeNull();
    expect(band('2026-11-28')).toBeNull();
  });

  it('treats the same day twice as a fresh start, not a run of one', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-27'));
    await userEvent.click(day('2026-11-27'));
    expect(router.state.location.search).not.toContain('dateTo');
    expect(
      screen.getByText('Start day: Friday 27 November. Now choose the last day.'),
    ).toBeVisible();
  });

  it('names the run in the cells’ accessible names', async () => {
    await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-27'));
    await userEvent.hover(day('2026-11-29'));
    expect(day('2026-11-27')).toHaveAccessibleName(/first day of your range/);
    expect(day('2026-11-28')).toHaveAccessibleName(/in your range/);
    expect(day('2026-11-29')).toHaveAccessibleName(/last day of your range/);
  });

  it('works by taps on a phone', async () => {
    setViewportWidth(MOBILE_WIDTH);
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.pointer([{ keys: '[TouchA]', target: day('2026-11-27') }]);
    await userEvent.pointer([{ keys: '[TouchA]', target: day('2026-11-29') }]);
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
  });
});

describe('the days of a run that cannot stand', () => {
  it('rejects the whole run for a day in the middle that is unavailable, naming the day and why', async () => {
    // City Hall is booked all day on Friday 20 November, which blocks its wing.
    await open('mitchell-wing');
    await severalMode();
    await userEvent.click(day('2026-11-19'));
    await userEvent.click(day('2026-11-21'));
    const dialog = await panel();
    expect(
      await within(dialog).findByText('These days cannot be requested together'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        /Friday 20 November is not free: City Hall is booked, so a booking cannot run across it\./,
      ),
    ).toBeVisible();
    expect(within(dialog).queryByLabelText(/Start time/)).toBeNull();
    // And the run is drawn as one that will not do.
    expect(day('2026-11-20').className).toContain('bg-danger-soft');
  });

  it('offers the way back to choose different days', async () => {
    const { router } = await open('mitchell-wing');
    await severalMode();
    await userEvent.click(day('2026-11-19'));
    await userEvent.click(day('2026-11-21'));
    const dialog = await panel();
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Choose different days' }),
    );
    await waitFor(() => expect(router.state.location.search).not.toContain('dateTo'));
    expect(screen.getByRole('button', { name: 'Choose several days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('rejects a run across a closure', async () => {
    await open('vaal-marina-hall', '2026-12');
    await severalMode();
    await userEvent.click(day('2026-12-07'));
    await userEvent.click(day('2026-12-10'));
    const dialog = await panel();
    expect(
      await within(dialog).findByText(
        /Tuesday 8 December is closed: Maintenance, and a booking cannot run across a closure\./,
      ),
    ).toBeVisible();
  });

  it('rejects a run longer than the facility allows, stating the limit', async () => {
    await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-23'));
    await userEvent.click(day('2026-12-01'));
    const dialog = await panel();
    expect(
      await within(dialog).findByText(/A booking here can cover at most 7 days\. Yours covers 9/),
    ).toBeVisible();
  });

  it('rejects a first day with nothing left to start on', async () => {
    // Saturday 5 December at Rothdene Hall is booked, with set-up before it and clear-down after.
    await open('rothdene-hall', '2026-12');
    await severalMode();
    await userEvent.click(day('2026-12-05'));
    await userEvent.click(day('2026-12-07'));
    const dialog = await panel();
    expect(
      await within(dialog).findByText(/Saturday 5 December has no time left to start a booking/),
    ).toBeVisible();
  });
});

describe('a run across a day the venue is closed', () => {
  it('is allowed, and the closed days need no times', async () => {
    // The committee room opens on weekdays only.
    await open('city-hall-committee-room');
    await severalMode();
    await userEvent.click(day('2026-11-27'));
    await userEvent.click(day('2026-11-30'));
    const dialog = await panel();
    expect(await within(dialog).findByLabelText('Start time on Friday 27 November')).toBeVisible();
    expect(within(dialog).queryByText('These days cannot be requested together')).toBeNull();
    expect(
      within(dialog).getByText(/Days in between are held in full, whatever the hours/),
    ).toBeVisible();
  });
});

describe('choosing the times of a run', () => {
  async function chooseRun(facility: string, from: string, to: string, month = '2026-11') {
    await open(facility, month);
    await severalMode();
    await userEvent.click(day(from));
    await userEvent.click(day(to));
    return panel();
  }

  it('asks for a start on the first day and an end on the last, and reads the whole span back in words', async () => {
    const dialog = await chooseRun('lakeside-hall', '2026-11-27', '2026-11-29');
    await userEvent.selectOptions(
      await within(dialog).findByLabelText('Start time on Friday 27 November'),
      '14:00',
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText('End time on Sunday 29 November'),
      '12:00',
    );
    expect(
      within(dialog).getByText('Friday 27 November 14:00 to Sunday 29 November 12:00, three days'),
    ).toBeVisible();
  });

  it('offers only ends before what is already on the last day', async () => {
    // The wing is booked 10:00 to 15:00 on Thursday 19 November, and free on the Wednesday before.
    const dialog = await chooseRun('mitchell-wing', '2026-11-18', '2026-11-19');
    const end = await within(dialog).findByLabelText('End time on Thursday 19 November');
    const options = within(end)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('10:00');
    expect(options).not.toContain('10:30');
    expect(options).not.toContain('12:00');
    // And a start on the first day can be any time in the hours, up to closing.
    const start = within(dialog).getByLabelText('Start time on Wednesday 18 November');
    expect(
      within(start)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toContain('09:00');
  });

  it('offers a start only after the notice period and what is already on the first day', async () => {
    const dialog = await chooseRun('city-hall-committee-room', '2026-11-27', '2026-11-30');
    const start = await within(dialog).findByLabelText('Start time on Friday 27 November');
    const options = within(start)
      .getAllByRole('option')
      .map((o) => o.textContent);
    // Open 08:00 to 16:30, so the last start is 16:00.
    expect(options).toContain('08:00');
    expect(options).toContain('16:00');
    expect(options).not.toContain('16:30');
  });

  it('makes the choice the booking: instants in the URL, the span in the summary, joined up on the grid', async () => {
    const { router } = await open('lakeside-hall');
    await severalMode();
    await userEvent.click(day('2026-11-27'));
    await userEvent.click(day('2026-11-29'));
    const dialog = await panel();
    await userEvent.selectOptions(
      await within(dialog).findByLabelText('Start time on Friday 27 November'),
      '14:00',
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText('End time on Sunday 29 November'),
      '12:00',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use these times' }));

    await waitFor(() => expect(router.state.location.search).toContain('startsAt='));
    const params = new URLSearchParams(router.state.location.search);
    // 14:00 and 12:00 in Johannesburg are 12:00 and 10:00 UTC.
    expect(params.get('startsAt')).toBe('2026-11-27T12:00:00Z');
    expect(params.get('endsAt')).toBe('2026-11-29T10:00:00Z');
    expect(params.has('dateTo')).toBe(false);

    const summary = await screen.findByRole('region', { name: 'Your selection' });
    expect(
      within(summary).getByText(/Friday 27 November 14:00 to Sunday 29 November 12:00, three days/),
    ).toBeVisible();
    expect(['2026-11-27', '2026-11-28', '2026-11-29'].map(band)).toEqual([
      'start',
      'middle',
      'end',
    ]);
    // Handed to the booking form as the same two instants.
    const request = screen.getByRole('link', { name: 'Request booking' });
    expect(request.getAttribute('href')).toContain('startsAt=2026-11-27T12%3A00%3A00Z');
    expect(request.getAttribute('href')).toContain('endsAt=2026-11-29T10%3A00%3A00Z');
  });

  it('cannot be confirmed until both times are chosen', async () => {
    const dialog = await chooseRun('lakeside-hall', '2026-11-27', '2026-11-29');
    const use = await within(dialog).findByRole('button', { name: 'Use these times' });
    expect(use).toBeDisabled();
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Start time on Friday 27 November'),
      '14:00',
    );
    expect(use).toBeDisabled();
  });

  it('changes a chosen span from the summary, back to its days', async () => {
    const { router } = await open(
      'lakeside-hall',
      '2026-11',
      '&startsAt=2026-11-27T12:00:00Z&endsAt=2026-11-29T10:00:00Z',
    );
    const summary = await screen.findByRole('region', { name: 'Your selection' });
    await userEvent.click(within(summary).getByRole('button', { name: 'Change' }));
    expect(router.state.location.search).toContain('date=2026-11-27');
    expect(router.state.location.search).toContain('dateTo=2026-11-29');
    expect(await panel()).toBeVisible();
  });

  it('shows a span already chosen as a continuous run when the calendar is opened on it', async () => {
    await open(
      'lakeside-hall',
      '2026-11',
      '&startsAt=2026-11-27T12:00:00Z&endsAt=2026-11-29T10:00:00Z',
    );
    expect(['2026-11-27', '2026-11-28', '2026-11-29'].map(band)).toEqual([
      'start',
      'middle',
      'end',
    ]);
  });
});

describe('the facility zone, whatever the system zone', () => {
  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'draws a span on the days it covers in Johannesburg, not in %s',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      await open('rothdene-hall', '2027-01');
      // Friday 8 to Sunday 10 January, 14:00 to 12:00 Johannesburg time.
      for (const iso of ['2027-01-08', '2027-01-09', '2027-01-10']) {
        expect(day(iso)).toHaveAccessibleName(/booked/);
      }
      expect(day('2027-01-07')).toHaveAccessibleName(/available/);
      expect(day('2027-01-11')).toHaveAccessibleName(/available/);
      vi.unstubAllEnvs();
    },
  );

  it('reads a chosen span as the same days under another system zone', async () => {
    vi.stubEnv('TZ', 'Pacific/Auckland');
    await open(
      'lakeside-hall',
      '2026-11',
      '&startsAt=2026-11-27T12:00:00Z&endsAt=2026-11-29T10:00:00Z',
    );
    expect(
      ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30'].map(band),
    ).toEqual([null, 'start', 'middle', 'end', null]);
    vi.unstubAllEnvs();
  });
});

describe('an approved span in the month', () => {
  it('shows as booked on each day it covers, the closed days of the venue included', async () => {
    await open('city-hall-committee-room', '2026-12');
    // Friday 18 December 14:00 to Monday 21 December 12:00.
    for (const iso of ['2026-12-19', '2026-12-20']) {
      expect(day(iso)).toHaveAccessibleName(/unavailable, booked/);
    }
    expect(day('2026-12-18')).toHaveAccessibleName(/booked/);
    expect(day('2026-12-21')).toHaveAccessibleName(/booked/);
  });

  it('is seen from a related facility as that facility being booked, on every day', async () => {
    await open('city-hall', '2026-12');
    expect(day('2026-12-19')).toHaveAccessibleName(
      /unavailable, City Hall Committee Room is booked/,
    );
    expect(day('2026-12-20')).toHaveAccessibleName(
      /unavailable, City Hall Committee Room is booked/,
    );
  });
});
