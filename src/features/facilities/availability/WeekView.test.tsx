import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedFacilityAdmin, seedSpanRequests } from '@/mocks/data/facilityAdminSeeds';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

const ZONE = 'Africa/Johannesburg';
const admin = createApiClient({
  baseUrl: TEST_API_BASE_URL,
  getToken: async () => 'user:mock-approver-1',
});

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
  seedSpanRequests(FIXED_NOW);
});

const week = (facility: string, monday: string, extra = '') =>
  `/facilities/${facility}?view=week&week=${monday}${extra}`;
const weekGrid = (name: string) => screen.findByRole('grid', { name });
const cell = (grid: HTMLElement, name: RegExp) => within(grid).getByRole('button', { name });

describe('the week grid', () => {
  it('is seven day columns against a time axis, a cell for every hour', async () => {
    renderApp(week('rothdene-hall', '2026-11-02'));
    const grid = await weekGrid('Week of 2 November 2026');
    const headers = within(grid)
      .getAllByRole('columnheader')
      .map((h) => h.getAttribute('aria-label'));
    expect(headers).toEqual([
      'Time',
      'Monday 2 November, today',
      'Tuesday 3 November',
      'Wednesday 4 November',
      'Thursday 5 November',
      'Friday 6 November',
      'Saturday 7 November',
      'Sunday 8 November',
    ]);
    // 07:00 to 23:00 is sixteen hours, for seven days.
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(16 * 7);
    expect(
      within(grid)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(Array.from({ length: 16 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`));
  });

  it('keeps its view and week in the URL, and is reached from the toolbar', async () => {
    const { router } = renderApp('/facilities/rothdene-hall');
    await screen.findByRole('grid', { name: 'November 2026' });
    await userEvent.click(screen.getByRole('button', { name: 'Week view' }));
    await weekGrid('Week of 2 November 2026');
    expect(router.state.location.search).toContain('view=week');
    expect(router.state.location.search).toContain('week=');
    expect(screen.getByRole('button', { name: 'Week view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Month view' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('has one cell in the tab order', async () => {
    renderApp(week('rothdene-hall', '2026-11-02'));
    const grid = await weekGrid('Week of 2 November 2026');
    expect(
      within(grid)
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0),
    ).toHaveLength(1);
  });

  it('marks the current time on today’s column', async () => {
    renderApp(week('rothdene-hall', '2026-11-02'));
    const grid = await weekGrid('Week of 2 November 2026');
    const marker = grid.querySelector<HTMLElement>('[data-now]');
    expect(marker).not.toBeNull();
    // 10:00 on an axis of 07:00 to 23:00.
    expect(marker?.style.top).toBe('18.75%');
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await weekGrid('Week of 9 November 2026');
    expect(document.querySelector('[data-now]')).toBeNull();
  });
});

describe('the six states, with their reasons', () => {
  it('shows booked time as booked', async () => {
    renderApp(week('city-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    expect(cell(grid, /^Friday 20 November, 08:00 to 09:00, unavailable, booked/)).toBeVisible();
  });

  it('shows an hour that is free as available, and one that is partly taken as partly available', async () => {
    renderApp(week('mitchell-wing', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    expect(cell(grid, /^Tuesday 17 November, 10:00 to 11:00, available$/)).toBeVisible();
    // Booked 10:00 to 15:00 on the Thursday: the hour before it is free.
    expect(cell(grid, /^Thursday 19 November, 09:00 to 10:00, available$/)).toBeVisible();
    expect(cell(grid, /^Thursday 19 November, 14:00 to 15:00, unavailable, booked/)).toBeVisible();
  });

  it('shows a request that is holding the time as held', async () => {
    renderApp(week('loch-wing', '2026-11-09'));
    const grid = await weekGrid('Week of 9 November 2026');
    expect(
      cell(grid, /^Wednesday 11 November, 11:00 to 12:00, unavailable, held pending a request/),
    ).toBeVisible();
  });

  it('shows set-up and clear-down time as such', async () => {
    renderApp(week('rothdene-hall', '2026-11-30'));
    const grid = await weekGrid('Week of 30 November 2026');
    expect(cell(grid, /^Saturday 5 December, 10:00 to 11:00, unavailable, booked/)).toBeVisible();
    expect(
      cell(grid, /^Saturday 5 December, 07:00 to 08:00, unavailable, set-up or clear-down time/),
    ).toBeVisible();
    expect(
      cell(grid, /^Sunday 6 December, 07:00 to 08:00, unavailable, set-up or clear-down time/),
    ).toBeVisible();
  });

  it('names the related facility for a block caused by the hierarchy', async () => {
    renderApp(week('mitchell-wing', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    expect(
      cell(grid, /^Friday 20 November, 09:00 to 10:00, unavailable, City Hall is booked/),
    ).toBeVisible();
    // And the other way: the parent is blocked by its wing.
    renderApp(week('city-hall', '2026-11-16'));
  });

  it('names the wing for its parent, too', async () => {
    renderApp(week('city-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    expect(
      cell(grid, /^Thursday 19 November, 11:00 to 12:00, unavailable, Mitchell Wing is booked/),
    ).toBeVisible();
  });

  it('shows part of a day closed for a reason as closed for that time', async () => {
    const at = (t: string) =>
      DateTime.fromISO(`2026-11-25T${t}`, { zone: ZONE }).toUTC().toISO() as string;
    await admin.post('/admin/facilities/lakeside-hall/blackouts', {
      body: {
        startsAt: at('12:00'),
        endsAt: at('14:00'),
        allDay: false,
        reason: 'Water supply cut',
      },
    });
    renderApp(week('lakeside-hall', '2026-11-23'));
    const grid = await weekGrid('Week of 23 November 2026');
    expect(
      cell(grid, /^Wednesday 25 November, 12:00 to 13:00, unavailable, closed: Water supply cut/),
    ).toBeVisible();
    expect(cell(grid, /^Wednesday 25 November, 11:00 to 12:00, available$/)).toBeVisible();
  });

  it('shows a whole closed day as closed, with why', async () => {
    renderApp(week('vaal-marina-hall', '2026-12-07'));
    const grid = await weekGrid('Week of 7 December 2026');
    expect(cell(grid, /^Tuesday 8 December, 10:00 to 11:00, closed, Maintenance/)).toBeVisible();
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(8);
  });

  it('shows a public holiday as closed', async () => {
    renderApp(week('rothdene-hall', '2026-12-14'));
    const grid = await weekGrid('Week of 14 December 2026');
    expect(
      cell(
        grid,
        /^Wednesday 16 December, 10:00 to 11:00, closed, Public holiday: Day of Reconciliation/,
      ),
    ).toBeVisible();
  });

  it('shows what is too soon, and what is too far ahead', async () => {
    renderApp(week('rothdene-hall', '2026-11-02'));
    const grid = await weekGrid('Week of 2 November 2026');
    expect(
      cell(grid, /^Monday 2 November, today, 12:00 to 13:00, too soon or past, not bookable/),
    ).toBeVisible();
  });

  it('shares its words with the month: the same reasons, in the same phrases', async () => {
    renderApp(week('city-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    const names = within(grid)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? '');
    for (const state of ['booked', 'Mitchell Wing is booked', 'available']) {
      expect(names.some((n) => n.includes(state))).toBe(true);
    }
  });
});

describe('week navigation', () => {
  it('moves by week, keeping the previous week on screen while the next loads', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/facilities/:id/availability`, async ({ request, params }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('from') === '2026-11-16') await delay(1000);
        const { computeAvailability } = await import('@/mocks/availability');
        const { buildLedger } = await import('@/mocks/data/bookingLedger');
        const { REAL_FACILITIES } = await import('@/mocks/data/facilities.real');
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
    const { router } = renderApp(week('rothdene-hall', '2026-11-09'));
    await weekGrid('Week of 9 November 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    // The week just left stays, dimmed and marked busy, while the next one loads.
    expect(screen.getByRole('grid', { name: 'Week of 9 November 2026' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(await weekGrid('Week of 16 November 2026')).toBeVisible();
    expect(router.state.location.search).toContain('week=2026-11-16');
    expect(screen.getByText('Showing the week of 16 to 22 November 2026')).toBeInTheDocument();
  });

  it('prefetches the weeks either side', async () => {
    const requested: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith('/availability'))
        requested.push(url.searchParams.get('from') ?? '');
    };
    server.events.on('request:start', listener);
    try {
      renderApp(week('rothdene-hall', '2026-11-09'));
      await weekGrid('Week of 9 November 2026');
      await waitFor(() =>
        expect(requested).toEqual(
          expect.arrayContaining(['2026-11-09', '2026-11-02', '2026-11-16']),
        ),
      );
    } finally {
      server.events.removeListener('request:start', listener);
    }
  });

  it('does not go before this week, or past the booking horizon', async () => {
    renderApp(week('rothdene-hall', '2026-11-02'));
    await weekGrid('Week of 2 November 2026');
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeEnabled();
  });

  it('has a way back to the month the week is mostly in', async () => {
    const { router } = renderApp(week('rothdene-hall', '2026-11-23'));
    await weekGrid('Week of 23 November 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Back to November' }));
    expect(await screen.findByRole('grid', { name: 'November 2026' })).toBeVisible();
    expect(router.state.location.search).not.toContain('view=week');
  });

  it('goes back to the month a week straddling two belongs mostly to', async () => {
    renderApp(week('rothdene-hall', '2026-11-30'));
    await weekGrid('Week of 30 November 2026');
    // 30 November to 6 December: its Thursday is in December.
    expect(screen.getByRole('button', { name: 'Back to December' })).toBeVisible();
  });
});

describe('the week grid from the keyboard', () => {
  const focusedName = () => document.activeElement?.getAttribute('aria-label') ?? '';

  it('moves between hours and days with the arrow keys', async () => {
    renderApp(week('rothdene-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    const first = within(grid)
      .getAllByRole('button')
      .find((b) => b.tabIndex === 0) as HTMLElement;
    first.focus();
    expect(focusedName()).toMatch(/^Monday 16 November, 07:00 to 08:00/);
    await userEvent.keyboard('{ArrowRight}');
    expect(focusedName()).toMatch(/^Tuesday 17 November, 07:00 to 08:00/);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(focusedName()).toMatch(/^Tuesday 17 November, 09:00 to 10:00/);
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(focusedName()).toMatch(/^Monday 16 November, 08:00 to 09:00/);
  });

  it('goes to the start and end of the week with Home and End', async () => {
    renderApp(week('rothdene-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    const start = cell(grid, /^Wednesday 18 November, 07:00 to 08:00/);
    start.focus();
    await userEvent.keyboard('{End}');
    expect(focusedName()).toMatch(/^Sunday 22 November, 07:00/);
    await userEvent.keyboard('{Home}');
    expect(focusedName()).toMatch(/^Monday 16 November, 07:00/);
  });

  it('moves by week with Page Up and Page Down, loading the week it lands in', async () => {
    const { router } = renderApp(week('rothdene-hall', '2026-11-09'));
    const grid = await weekGrid('Week of 9 November 2026');
    cell(grid, /^Wednesday 11 November, 07:00 to 08:00/).focus();
    await userEvent.keyboard('{PageDown}');
    await weekGrid('Week of 16 November 2026');
    await waitFor(() => expect(focusedName()).toMatch(/^Wednesday 18 November, 07:00 to 08:00/));
    expect(router.state.location.search).toContain('week=2026-11-16');
    await userEvent.keyboard('{PageUp}');
    await weekGrid('Week of 9 November 2026');
    await waitFor(() => expect(focusedName()).toMatch(/^Wednesday 11 November, 07:00/));
  });

  it('carries on into the next week with the right arrow from Sunday', async () => {
    renderApp(week('rothdene-hall', '2026-11-09'));
    const grid = await weekGrid('Week of 9 November 2026');
    cell(grid, /^Sunday 15 November, 08:00 to 09:00/).focus();
    await userEvent.keyboard('{ArrowRight}');
    await weekGrid('Week of 16 November 2026');
    await waitFor(() => expect(focusedName()).toMatch(/^Monday 16 November, 08:00 to 09:00/));
  });

  it('stays inside the hours of the axis', async () => {
    renderApp(week('rothdene-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    cell(grid, /^Monday 16 November, 07:00 to 08:00/).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(focusedName()).toMatch(/^Monday 16 November, 07:00 to 08:00/);
  });

  it('opens the day on Enter, as the month does', async () => {
    const { router } = renderApp(week('rothdene-hall', '2026-11-16'));
    const grid = await weekGrid('Week of 16 November 2026');
    cell(grid, /^Tuesday 17 November, 10:00 to 11:00/).focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(router.state.location.search).toContain('date=2026-11-17');
    expect(screen.getByRole('heading', { name: 'Tuesday 17 November' })).toBeVisible();
  });
});

describe('spans in the week view', () => {
  it('shows an approved span as one block across its days, its ends joined to their neighbours', async () => {
    renderApp(week('rothdene-hall', '2027-01-04'));
    const grid = await weekGrid('Week of 4 January 2027');
    // Friday afternoon, all of Saturday, Sunday morning, all booked.
    expect(cell(grid, /^Friday 8 January, 15:00 to 16:00, unavailable, booked/)).toBeVisible();
    expect(cell(grid, /^Saturday 9 January, 07:00 to 08:00, unavailable, booked/)).toBeVisible();
    expect(cell(grid, /^Saturday 9 January, 22:00 to 23:00, unavailable, booked/)).toBeVisible();
    expect(cell(grid, /^Sunday 10 January, 11:00 to 12:00, unavailable, booked/)).toBeVisible();
    expect(cell(grid, /^Sunday 10 January, 12:00 to 13:00, available$/)).toBeVisible();
    // Drawn as blocks that run into one another across the columns.
    const blocks = [...grid.querySelectorAll<HTMLElement>('[style*="top"]')].filter((b) =>
      b.className.includes('pattern-solid'),
    );
    expect(blocks).toHaveLength(3);
    const [friday, saturday, sunday] = blocks;
    expect(friday?.className).toContain('right-0');
    expect(friday?.className).not.toContain('border-r-0 ' + 'left-0');
    expect(saturday?.className).toContain('left-0 ');
    expect(saturday?.className).toContain('right-0');
    expect(sunday?.className).toContain('left-0 ');
  });

  it('holds a closed day of the span in full: the committee room’s weekend, in a week that is open on Saturday for others', async () => {
    renderApp(week('city-hall', '2026-12-14'));
    const grid = await weekGrid('Week of 14 December 2026');
    expect(
      cell(
        grid,
        /^Saturday 19 December, 10:00 to 11:00, unavailable, City Hall Committee Room is booked/,
      ),
    ).toBeVisible();
  });

  it('reads the same in the facility zone whatever the system zone', async () => {
    for (const zone of ['America/Los_Angeles', 'Pacific/Auckland']) {
      vi.stubEnv('TZ', zone);
      const { unmount } = renderApp(week('rothdene-hall', '2027-01-04'));
      const grid = await weekGrid('Week of 4 January 2027');
      expect(cell(grid, /^Friday 8 January, 14:00 to 15:00, unavailable, booked/)).toBeVisible();
      expect(cell(grid, /^Friday 8 January, 13:00 to 14:00, available$/)).toBeVisible();
      expect(cell(grid, /^Sunday 10 January, 11:00 to 12:00, unavailable, booked/)).toBeVisible();
      unmount();
      vi.unstubAllEnvs();
    }
  });
});

describe('on a phone', () => {
  it('scrolls sideways inside its own box rather than squeezing the days out of reach', async () => {
    setViewportWidth(MOBILE_WIDTH);
    renderApp(week('rothdene-hall', '2026-11-02'));
    const grid = await weekGrid('Week of 2 November 2026');
    expect(grid.parentElement?.className).toContain('overflow-x-auto');
    expect(grid.className).toContain('min-w-lg');
  });
});
