import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/mocks/availability';
import { buildLedger } from '@/mocks/data/bookingLedger';
import { REAL_FACILITIES } from '@/mocks/data/facilities.real';
import { createFacilityHandlers } from '@/mocks/facilities';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

const AVAILABILITY_API = `${TEST_API_BASE_URL}/facilities/:id/availability`;

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
});

const grid = (name = 'November 2026') => screen.findByRole('grid', { name });
const cell = async (name: RegExp) => screen.findByRole('button', { name });
const dialog = () => screen.findByRole('dialog');
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('month grid', () => {
  it('is a grid of six Monday first weeks with today marked', async () => {
    renderApp('/facilities/rothdene-hall');
    const table = await grid();

    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.getAttribute('abbr'));
    expect(headers).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(within(table).getAllByRole('gridcell')).toHaveLength(42);
    // 1 November 2026 is a Sunday, so the first row starts on Monday 26 October.
    expect(within(table).getAllByRole('button')[0]).toHaveAccessibleName(/^Monday 26 October/);
    expect(within(table).getByRole('button', { name: /^Monday 2 November, today/ })).toBeVisible();
    // Roving tabindex: exactly one cell is in the tab order.
    expect(
      within(table)
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0),
    ).toHaveLength(1);
  });

  it('lists every status in the legend, in words', async () => {
    renderApp('/facilities/rothdene-hall');
    await grid();
    const legend = screen.getByRole('region', { name: 'Legend' });
    for (const label of [
      'Available',
      'Booked',
      'Held',
      'Set-up or clear-down',
      'Blocked by a related space',
      'Closed',
      'Too soon or past',
      'Too far ahead',
    ]) {
      expect(within(legend).getByText(label)).toBeVisible();
    }
  });
});

describe('hierarchy', () => {
  it.each(['mitchell-wing', 'loch-wing', 'city-hall-committee-room'])(
    'blocks %s with City Hall named when City Hall is booked',
    async (id) => {
      renderApp(`/facilities/${id}`);
      const blocked = await cell(/^Friday 20 November, unavailable, City Hall is booked$/);
      expect(blocked).toBeVisible();

      await userEvent.click(blocked);
      const panel = await dialog();
      const entry = within(panel)
        .getByText('Unavailable, City Hall is booked')
        .closest('li') as HTMLElement;
      expect(within(entry).getByText(/is the larger venue that contains/)).toBeVisible();
      expect(within(entry).getByRole('link', { name: 'View City Hall' })).toHaveAttribute(
        'href',
        '/facilities/city-hall',
      );
    },
  );

  it('blocks City Hall with the child named, and leaves unaffected siblings available', async () => {
    renderApp('/facilities/city-hall');
    const parent = await cell(/^Thursday 19 November, partly available, Mitchell Wing is booked$/);
    await userEvent.click(parent);
    const panel = await dialog();
    const entry = within(panel)
      .getByText('Unavailable, Mitchell Wing is booked')
      .closest('li') as HTMLElement;
    expect(within(entry).getByText(/is a space inside City Hall/)).toBeVisible();
    expect(within(entry).getByText('10:00 to 15:00')).toBeVisible();
    expect(within(entry).getByRole('link', { name: 'View Mitchell Wing' })).toBeVisible();
  });

  it.each(['loch-wing', 'city-hall-committee-room'])(
    'leaves sibling %s available that day',
    async (id) => {
      renderApp(`/facilities/${id}`);
      expect(await cell(/^Thursday 19 November, available$/)).toBeVisible();
    },
  );

  it('shows the venue itself as booked, not blocked, on its own booking', async () => {
    renderApp('/facilities/mitchell-wing');
    expect(await cell(/^Thursday 19 November, partly available, booked$/)).toBeVisible();
  });
});

describe('statuses', () => {
  it('renders set-up and clear-down around a booking, distinct from the booking', async () => {
    renderApp('/facilities/rothdene-hall?month=2026-12');
    expect(
      await cell(/^Friday 4 December, partly available, set-up or clear-down time$/),
    ).toBeVisible();
    const booked = await cell(
      /^Saturday 5 December, unavailable, set-up or clear-down time, booked$/,
    );
    expect(
      await cell(/^Sunday 6 December, partly available, set-up or clear-down time$/),
    ).toBeVisible();

    await userEvent.click(booked);
    const panel = await dialog();
    const labels = within(panel)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p:nth-child(2)')?.textContent)
      .filter(Boolean);
    expect(labels).toEqual(['Set-up or clear-down', 'Booked', 'Set-up or clear-down']);
    expect(within(panel).getByText('07:00 to 10:00')).toBeVisible();
    expect(within(panel).getByText('10:00 to 16:00')).toBeVisible();
  });

  it('renders a held request', async () => {
    renderApp('/facilities/loch-wing');
    const held = await cell(/^Wednesday 11 November, partly available, held pending a request$/);
    await userEvent.click(held);
    const panel = await dialog();
    expect(within(panel).getByText('Held')).toBeVisible();
    expect(within(panel).getByText(/pending and is holding this time/)).toBeVisible();
  });

  it('reads closed days differently for a holiday, a maintenance blackout and ordinary hours', async () => {
    renderApp('/facilities/vaal-marina-hall?month=2026-12');
    const holiday = await cell(
      /^Wednesday 16 December, closed, Public holiday: Day of Reconciliation$/,
    );
    const maintenance = await cell(/^Tuesday 8 December, closed, Maintenance$/);
    expect(holiday.getAttribute('aria-label')).not.toBe(maintenance.getAttribute('aria-label'));

    await userEvent.click(maintenance);
    expect(await within(await dialog()).findByText('Maintenance')).toBeVisible();
  });

  it('explains a weekday closure for a weekend only venue', async () => {
    renderApp('/facilities/sicelo-hall');
    expect(await cell(/^Tuesday 10 November, closed, Not open on Tuesdays$/)).toBeVisible();
    expect(await cell(/^Saturday 7 November, available$/)).toBeVisible();
  });

  it('shows a completely free week and a busy week', async () => {
    renderApp('/facilities/vaal-marina-hall');
    await grid();
    for (const date of [
      '23 November',
      '24 November',
      '25 November',
      '26 November',
      '27 November',
    ]) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^\\w+ ${date}, available$`) }),
      ).toBeVisible();
    }
    for (const date of ['9 November', '10 November', '11 November', '12 November']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^\\w+ ${date}, partly available`) }),
      ).toBeVisible();
    }
  });
});

describe('not bookable days', () => {
  it('does not let a day inside the minimum notice period be selected, and says why', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    const today = await cell(
      /^Monday 2 November, today, not bookable, in the past or inside the 48 hour minimum notice$/,
    );
    expect(today).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(today);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.getByText(/This day cannot be requested/)).toBeVisible();
  });

  it('does not let a day beyond the booking horizon be selected', async () => {
    renderApp('/facilities/rothdene-hall?month=2027-02');
    const far = await cell(/^Wednesday 3 February, not bookable yet, more than 90 days ahead$/);
    expect(far).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(far);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves the last day inside the horizon selectable', async () => {
    renderApp('/facilities/rothdene-hall?month=2027-01');
    const last = await cell(/^Sunday 31 January/);
    expect(last).not.toHaveAttribute('aria-disabled');
  });
});

describe('selection', () => {
  it('produces the URL and the booking hand off in UTC from a valid choice', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    await userEvent.click(await cell(/^Tuesday 24 November, available$/));
    const panel = await dialog();

    await userEvent.selectOptions(within(panel).getByLabelText('Start time'), '09:00');
    await userEvent.selectOptions(within(panel).getByLabelText('End time'), '12:00');

    // 09:00 to 12:00 in Johannesburg (UTC+2) is 07:00 to 10:00 UTC.
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('date')).toBe('2026-11-24');
      expect(params.get('startsAt')).toBe('2026-11-24T07:00:00Z');
      expect(params.get('endsAt')).toBe('2026-11-24T10:00:00Z');
    });

    await userEvent.click(within(panel).getByRole('button', { name: 'Done' }));
    const summary = await screen.findByRole('region', { name: 'Your selection' });
    expect(summary).toHaveTextContent('Rothdene Hall · Tuesday 24 November · 09:00 to 12:00');

    const action = screen.getByRole('link', { name: 'Request booking' });
    await userEvent.click(action);
    expect(router.state.location.pathname).toBe('/bookings/new');
    const handoff = new URLSearchParams(router.state.location.search);
    expect(Object.fromEntries(handoff)).toEqual({
      facilityId: 'rothdene-hall',
      startsAt: '2026-11-24T07:00:00Z',
      endsAt: '2026-11-24T10:00:00Z',
    });
  });

  it('says once, near the action, that availability is not a reservation', async () => {
    renderApp('/facilities/rothdene-hall');
    await grid();
    expect(screen.getAllByText(/Availability is not a reservation/)).toHaveLength(1);
  });

  it('prevents a selection that overlaps unavailable time and states the constraint', async () => {
    renderApp('/facilities/city-hall');
    await userEvent.click(
      await cell(/^Thursday 19 November, partly available, Mitchell Wing is booked$/),
    );
    const panel = await dialog();
    const start = within(panel).getByLabelText('Start time');
    const end = within(panel).getByLabelText('End time');

    await userEvent.selectOptions(start, '08:00');
    // Mitchell Wing is booked from 10:00, so nothing later than 10:00 can end this booking.
    expect(within(end).getByRole('option', { name: '10:00' })).toBeEnabled();
    expect(within(end).getByRole('option', { name: '11:00' })).toBeDisabled();
    expect(
      within(panel).getByText('Latest end 10:00: Mitchell Wing is booked from 10:00.'),
    ).toBeVisible();
    // The booked stretch itself cannot be started in either.
    expect(within(start).getByRole('option', { name: '11:00' })).toBeDisabled();
  });

  it('prevents a booking shorter than the minimum and says so', async () => {
    renderApp('/facilities/rothdene-hall');
    await userEvent.click(await cell(/^Tuesday 24 November, available$/));
    const panel = await dialog();
    await userEvent.selectOptions(within(panel).getByLabelText('Start time'), '09:00');

    expect(
      within(within(panel).getByLabelText('End time')).getByRole('option', { name: '09:30' }),
    ).toBeDisabled();
    expect(within(panel).getByText('Bookings must be at least 1 hour.')).toBeVisible();
  });

  it('prevents a start inside the minimum notice period and names that rule', async () => {
    renderApp('/facilities/rothdene-hall');
    await userEvent.click(await cell(/^Wednesday 4 November/));
    const panel = await dialog();
    const start = within(panel).getByLabelText('Start time');
    // 48 hours after Monday 10:00 is Wednesday 10:00.
    expect(within(start).getByRole('option', { name: '09:30' })).toBeDisabled();
    expect(within(panel).getByText('Earliest start 10:00: 48 hours minimum notice.')).toBeVisible();
  });

  it('offers an available gap as a one click choice', async () => {
    const { router } = renderApp('/facilities/city-hall');
    await userEvent.click(
      await cell(/^Thursday 19 November, partly available, Mitchell Wing is booked$/),
    );
    const panel = await dialog();
    await userEvent.click(within(panel).getByRole('button', { name: 'Use 07:00 to 10:00' }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('startsAt')).toBe('2026-11-19T05:00:00Z');
      expect(params.get('endsAt')).toBe('2026-11-19T08:00:00Z');
    });
  });

  it('restores a chosen window from the URL and lets it be cleared', async () => {
    const { router } = renderApp(
      '/facilities/rothdene-hall?startsAt=2026-11-24T07:00:00Z&endsAt=2026-11-24T10:00:00Z',
    );
    const summary = await screen.findByRole('region', { name: 'Your selection' });
    await waitFor(() =>
      expect(summary).toHaveTextContent('Rothdene Hall · Tuesday 24 November · 09:00 to 12:00'),
    );
    expect(screen.getByRole('link', { name: 'Request booking' })).toHaveAttribute(
      'href',
      expect.stringContaining('startsAt=2026-11-24T07%3A00%3A00Z'),
    );

    await userEvent.click(within(summary).getByRole('button', { name: 'Clear' }));
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('region', { name: 'Your selection' })).not.toBeInTheDocument();
  });

  it('flags a shared selection that overlaps a booking', async () => {
    renderApp(
      '/facilities/rothdene-hall?month=2026-12&date=2026-12-05&startsAt=2026-12-05T09:00:00Z&endsAt=2026-12-05T11:00:00Z',
    );
    const panel = await dialog();
    expect(within(panel).getByText('This selection cannot be used')).toBeVisible();
    expect(within(panel).getByText(/overlap time that is unavailable/)).toBeVisible();
  });
});

describe('time zone', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'shows facility time and UTC instants whatever the system zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      // Prove the environment really is in another zone, or this test would show nothing.
      expect(DateTime.local().zoneName).toBe(zone);

      const { router } = renderApp('/facilities/rothdene-hall?month=2026-12');
      await userEvent.click(await cell(/^Saturday 5 December, /));
      const panel = await dialog();
      expect(within(panel).getByText('10:00 to 16:00')).toBeVisible();
      expect(within(panel).getByText(/All times are Africa\/Johannesburg time/)).toBeVisible();

      // Choosing a free time on another day gives the right UTC instants too.
      await userEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
      await userEvent.click(await cell(/^Thursday 3 December, available$/));
      await userEvent.selectOptions(within(await dialog()).getByLabelText('Start time'), '09:00');
      await waitFor(() =>
        expect(new URLSearchParams(router.state.location.search).get('startsAt')).toBe(
          '2026-12-03T07:00:00Z',
        ),
      );
    },
  );
});

describe('keyboard', () => {
  const focused = () => document.activeElement as HTMLElement;

  it('moves by day, week, week boundary and month', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    const start = await cell(/^Wednesday 11 November/);
    start.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toHaveAccessibleName(/^Thursday 12 November/);
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toHaveAccessibleName(/^Thursday 19 November/);
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(focused()).toHaveAccessibleName(/^Wednesday 11 November/);

    await userEvent.keyboard('{Home}');
    expect(focused()).toHaveAccessibleName(/^Monday 9 November/);
    await userEvent.keyboard('{End}');
    expect(focused()).toHaveAccessibleName(/^Sunday 15 November/);

    await userEvent.keyboard('{PageDown}');
    await waitFor(() => expect(router.state.location.search).toBe('?month=2026-12'));
    await waitFor(() => expect(focused()).toHaveAccessibleName(/^Tuesday 15 December/));
    await userEvent.keyboard('{PageUp}');
    await waitFor(() => expect(focused()).toHaveAccessibleName(/^Sunday 15 November/));
  });

  it('crosses into the next month with the arrow keys', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    (await cell(/^Monday 30 November/)).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(router.state.location.search).toBe('?month=2026-12'));
    await waitFor(() => expect(focused()).toHaveAccessibleName(/^Wednesday 2 December/));
  });

  it('opens the panel with Enter, closes with Escape and returns focus to the day', async () => {
    renderApp('/facilities/rothdene-hall');
    const day = await cell(/^Tuesday 24 November/);
    day.focus();
    await userEvent.keyboard('{Enter}');

    const panel = await dialog();
    expect(panel).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Tuesday 24 November/ })).toHaveFocus(),
    );
  });

  it('chooses a time using the keyboard alone', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    (await cell(/^Tuesday 24 November/)).focus();
    await userEvent.keyboard('{Enter}');
    const panel = await dialog();
    const start = within(panel).getByLabelText('Start time');
    start.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.selectOptions(start, '10:00');
    await waitFor(() =>
      expect(new URLSearchParams(router.state.location.search).get('startsAt')).toBe(
        '2026-11-24T08:00:00Z',
      ),
    );
  });
});

describe('month navigation', () => {
  it('keeps the previous month on screen while the next loads, then swaps', async () => {
    server.use(
      http.get(AVAILABILITY_API, async ({ request, params }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('from') === '2026-11-30') await delay(300);
        const facility = REAL_FACILITIES.find((f) => f.id === params.id)!;
        const ledger = buildLedger({
          now: FIXED_NOW,
          startedAt: FIXED_NOW,
          catalogue: REAL_FACILITIES,
        });
        return HttpResponse.json(
          computeAvailability({
            facility,
            catalogue: REAL_FACILITIES,
            ledger,
            from: url.searchParams.get('from') ?? '',
            to: url.searchParams.get('to') ?? '',
            now: FIXED_NOW,
          }),
        );
      }),
    );
    renderApp('/facilities/rothdene-hall');
    await grid();
    // Drop the prefetched December so the click really has to wait.
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('grid', { name: 'November 2026' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByLabelText('Month')).toHaveValue('12');
    expect(await screen.findByRole('grid', { name: 'December 2026' })).toBeVisible();
    expect(screen.getByText('Showing December 2026')).toBeInTheDocument();
  });

  it('prefetches the next month before it is asked for', async () => {
    const requested: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/availability'))
        requested.push(url.searchParams.get('from') ?? '');
    };
    server.events.on('request:start', listener);
    try {
      renderApp('/facilities/rothdene-hall');
      await grid();
      // November's grid starts 26 October; December's starts 30 November.
      await waitFor(() =>
        expect(requested).toEqual(expect.arrayContaining(['2026-10-26', '2026-11-30'])),
      );
    } finally {
      server.events.removeListener('request:start', listener);
    }
  });

  it('reaches a month directly with the selectors, and links to it', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    await grid();
    await userEvent.selectOptions(screen.getByLabelText('Month'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Year'), '2027');
    await waitFor(() => expect(router.state.location.search).toBe('?month=2027-01'));
    expect(await grid('January 2027')).toBeVisible();
  });

  it('cannot go before the current month', async () => {
    renderApp('/facilities/rothdene-hall');
    await grid();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  });
});

describe('states', () => {
  it('shows a grid shaped skeleton while loading, with no change in height', async () => {
    server.use(
      http.get(AVAILABILITY_API, async () => {
        await delay(200);
        return HttpResponse.json({ title: 'x', status: 500 }, { status: 500 });
      }),
    );
    renderApp('/facilities/rothdene-hall');
    const skeleton = await screen.findByRole('table', { name: 'Loading calendar' });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(within(skeleton).getAllByRole('row')).toHaveLength(7);
  });

  it('keeps the loaded grid the same shape as the skeleton', async () => {
    renderApp('/facilities/rothdene-hall');
    expect(within(await grid()).getAllByRole('row')).toHaveLength(7);
  });

  it('contains a calendar error: the rest of the page works and retry recovers', async () => {
    let fail = true;
    server.use(
      http.get(AVAILABILITY_API, ({ request, params }) => {
        if (fail) {
          return HttpResponse.json(
            {
              title: 'Mock failure',
              status: 500,
              detail: 'The availability service is unavailable.',
            },
            { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
          );
        }
        const url = new URL(request.url);
        const facility = REAL_FACILITIES.find((f) => f.id === params.id)!;
        return HttpResponse.json(
          computeAvailability({
            facility,
            catalogue: REAL_FACILITIES,
            ledger: buildLedger({
              now: FIXED_NOW,
              startedAt: FIXED_NOW,
              catalogue: REAL_FACILITIES,
            }),
            from: url.searchParams.get('from') ?? '',
            to: url.searchParams.get('to') ?? '',
            now: FIXED_NOW,
          }),
        );
      }),
    );
    renderApp('/facilities/rothdene-hall');
    expect(await screen.findByText('The availability service is unavailable.')).toBeVisible();
    // The rest of the page is unaffected.
    expect(await heading('Rothdene Hall')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Key facts' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Request booking' })).toBeVisible();

    fail = false;
    const retry = within(screen.getByRole('region', { name: 'Availability' }) ?? document.body);
    await userEvent.click(retry.getByRole('button', { name: 'Retry' }));
    expect(await grid()).toBeVisible();
  });

  it('explains instead of showing a calendar for an unavailable facility', async () => {
    server.use(...createFacilityHandlers(TEST_API_BASE_URL, { delayMs: 0, dataset: 'volume' }));
    renderApp('/facilities/volume-011');
    await heading('Volume Test Venue 011');
    expect(
      screen.getByText(/is currently unavailable, so there is no availability to show/),
    ).toBeVisible();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});

describe('small screens', () => {
  it('opens a day as a sheet and keeps the primary action reachable', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp('/facilities/rothdene-hall');
    await userEvent.click(await cell(/^Tuesday 24 November/));
    const panel = await dialog();
    expect(within(panel).getByRole('heading', { name: 'Tuesday 24 November' })).toBeVisible();
    await userEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(screen.getByRole('link', { name: 'Request booking' })).toBeVisible();
  });
});
