import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedBookings } from '@/mocks/data/bookingSeeds';
import { bookingStore } from '@/mocks/data/bookingStore';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { clerkState } from '@/test/clerk-mock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  seedBookings(FIXED_NOW);
});

const count = () => screen.getByRole('status');
const waitForCount = (text: RegExp) => waitFor(() => expect(count()).toHaveTextContent(text));
const section = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });
const references = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole('link', { name: /^MVL-2026-\d+/ })
    .map((link) => link.textContent);
const openList = async (search = '') => {
  const view = renderApp(`/bookings${search}`);
  await waitForCount(/^\d+ bookings?$/);
  return view;
};

describe('the default view', () => {
  it('puts what needs attention first: drafts, pending, upcoming approved, then everything past', async () => {
    await openList();
    expect(count()).toHaveTextContent('7 bookings');

    expect(references(section('Needs attention'))).toEqual(['MVL-2026-9000', 'MVL-2026-9001']);
    expect(references(section('Upcoming'))).toEqual(['MVL-2026-9003', 'MVL-2026-9002']);
    expect(references(section('Past and closed'))).toEqual([
      'MVL-2026-9005',
      'MVL-2026-9004',
      'MVL-2026-9006',
    ]);

    // Section order is the page order.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(
      headings
        .filter((h) => h !== 'Filters')
        .slice(0, 3)
        .map((h) => h?.replace(/\d+$/, '')),
    ).toEqual(['Needs attention', 'Upcoming', 'Past and closed']);
  });

  it("shows only the caller's own bookings", async () => {
    await openList();
    expect(screen.queryByText(/Another applicant/)).not.toBeInTheDocument();
  });

  it('leads each row with its status and says how long a request has waited or when a draft was saved', async () => {
    await openList();
    const attention = section('Needs attention');
    const draft = within(attention)
      .getByRole('link', { name: 'MVL-2026-9000, Draft' })
      .closest('article') as HTMLElement;
    expect(within(draft).getByText('Draft', { selector: 'span' })).toBeVisible();
    expect(within(draft).getByText('Last saved 7 days ago, on 26 October 2026')).toBeVisible();

    const pending = within(attention)
      .getByRole('link', { name: 'MVL-2026-9001, Pending' })
      .closest('article') as HTMLElement;
    expect(within(pending).getByText('Waiting 3 days, since 30 October 2026')).toBeVisible();
    expect(within(pending).getByRole('link', { name: 'Lakeside Hall' })).toHaveAttribute(
      'href',
      '/facilities/lakeside-hall',
    );
    expect(within(pending).getByText('Monday 16 November 2026, 10:00 to 14:00')).toBeVisible();
    expect(within(pending).getByText(/Meeting · Ward committee quarterly meeting/)).toBeVisible();
    expect(within(pending).getByRole('link', { name: 'MVL-2026-9001, Pending' })).toHaveAttribute(
      'href',
      '/bookings/seed-pending',
    );
  });

  it('marks past events, and a request to change the date', async () => {
    await openList();
    const past = within(section('Past and closed'))
      .getByRole('link', { name: 'MVL-2026-9006, Approved' })
      .closest('article') as HTMLElement;
    expect(within(past).getByText('Past event')).toBeVisible();
    const approved = within(section('Upcoming'))
      .getByRole('link', { name: 'MVL-2026-9002, Approved' })
      .closest('article') as HTMLElement;
    expect(within(approved).getByText('Change of date requested')).toBeVisible();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'shows times in the facility zone, not the system zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      await openList();
      expect(screen.getByText('Monday 23 November 2026, 09:00 to 13:00')).toBeVisible();
      vi.unstubAllEnvs();
    },
  );

  it('resumes a draft in the booking form at the right step, with its answers', async () => {
    const { router } = await openList();
    await userEvent.click(screen.getByRole('link', { name: 'Continue editing' }));

    expect(router.state.location.pathname).toBe('/bookings/new');
    expect(new URLSearchParams(router.state.location.search).get('draft')).toBe('seed-draft');
    expect(await screen.findByRole('heading', { level: 2, name: 'Event details' })).toBeVisible();
    expect(screen.getByLabelText(/^Event description/)).toHaveValue(
      'A family celebration (draft, details still to come)',
    );
  });
});

describe('empty states', () => {
  it('explains the service and routes to browsing when there are no bookings at all', async () => {
    clerkState.getToken.mockResolvedValue('user:nobody');
    renderApp('/bookings');
    expect(await screen.findByText('You have no bookings yet')).toBeVisible();
    expect(screen.getByText(/Request a hall or room/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse venues' })).toHaveAttribute(
      'href',
      '/facilities',
    );
    expect(screen.queryByText('No bookings match')).not.toBeInTheDocument();
  });

  it('says something different when filters exclude everything, and offers to clear them', async () => {
    renderApp('/bookings?q=zzzz&status=approved');
    expect(await screen.findByText('No bookings match')).toBeVisible();
    expect(screen.queryByText('You have no bookings yet')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitForCount(/^7 bookings$/);
  });

  it('gives a quiet note, not an empty state, when there are upcoming bookings but no past ones', async () => {
    for (const id of ['seed-rejected', 'seed-cancelled', 'seed-past']) bookingStore.remove(id);
    await openList();
    expect(references(section('Upcoming'))).toHaveLength(2);
    const past = section('Past and closed');
    expect(within(past).getByText('You have no past bookings yet.')).toBeVisible();
    expect(screen.queryByText('No bookings match')).not.toBeInTheDocument();
    expect(screen.queryByText('You have no bookings yet')).not.toBeInTheDocument();
  });
});

describe('search, filters and sorting, all in the URL', () => {
  it('filters by status and removes the filter from its chip', async () => {
    const { router } = await openList();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pending' }));
    await waitForCount(/^1 booking$/);
    expect(router.state.location.search).toBe('?status=pending');
    expect(references(section('Needs attention'))).toEqual(['MVL-2026-9001']);

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Status: Pending' }));
    expect(router.state.location.search).toBe('');
    await waitForCount(/^7 bookings$/);
  });

  it('filters by event date range', async () => {
    const { router } = await openList();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-05' } });
    await waitForCount(/^1 booking$/);
    expect(router.state.location.search).toBe('?from=2026-11-01&to=2026-11-05');
    expect(screen.getByText(/Youth club planning session/)).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /Remove filter: Event date: 1 November 2026 to 5 November 2026/,
      }),
    ).toBeVisible();
  });

  it('filters by venue', async () => {
    const { router } = await openList();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Lakeside Hall' }));
    await waitForCount(/^2 bookings$/);
    expect(router.state.location.search).toBe('?facilityId=lakeside-hall');
  });

  it('searches reference, venue and description', async () => {
    const { router } = await openList();
    const box = screen.getByRole('searchbox', { name: 'Search bookings' });
    await userEvent.type(box, 'workshop');
    await waitForCount(/^1 booking$/);
    expect(router.state.location.search).toBe('?q=workshop');

    await userEvent.clear(box);
    await userEvent.type(box, 'MVL-2026-9003');
    expect(await screen.findByText(/Youth club planning session/)).toBeVisible();

    await userEvent.clear(box);
    await userEvent.type(box, 'vaal marina');
    expect(await screen.findByText(/Wedding reception/)).toBeVisible();
  });

  it('sorts by event date, submission date and status, and drops the sections', async () => {
    const { router } = await openList();
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'eventDate');
    await waitFor(() => expect(router.state.location.search).toBe('?sort=eventDate'));
    const list = await screen.findByRole('list', { name: 'Bookings' });
    expect(references(list)).toEqual([
      'MVL-2026-9006',
      'MVL-2026-9003',
      'MVL-2026-9004',
      'MVL-2026-9001',
      'MVL-2026-9000',
      'MVL-2026-9002',
      'MVL-2026-9005',
    ]);
    expect(screen.queryByRole('heading', { name: /Needs attention/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'submitted');
    await waitFor(() => expect(router.state.location.search).toBe('?sort=submitted'));
    await waitFor(() =>
      expect(references(screen.getByRole('list', { name: 'Bookings' })).at(-1)).toBe(
        'MVL-2026-9000',
      ),
    );

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'status');
    await waitFor(() => expect(router.state.location.search).toBe('?sort=status'));
    await waitFor(() =>
      expect(references(screen.getByRole('list', { name: 'Bookings' })).slice(0, 2)).toEqual([
        'MVL-2026-9000',
        'MVL-2026-9001',
      ]),
    );
  });

  it('restores everything from the URL', async () => {
    await openList('?q=hall&status=approved&facilityId=rothdene-hall&sort=-eventDate');
    expect(screen.getByRole('searchbox', { name: 'Search bookings' })).toHaveValue('hall');
    expect(screen.getByRole('checkbox', { name: 'Approved' })).toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Rothdene Hall' })).toBeChecked();
    expect(screen.getByLabelText('Sort by')).toHaveValue('-eventDate');
    expect(references(screen.getByRole('list', { name: 'Bookings' }))).toEqual([
      'MVL-2026-9002',
      'MVL-2026-9006',
    ]);
  });
});

describe('reuse and small screens', () => {
  it('uses the shared list primitives: the same filter drawer on a small screen', async () => {
    setViewportWidth(MOBILE_WIDTH);
    await openList();
    expect(screen.queryByRole('checkbox', { name: 'Pending' })).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Filters' });
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Pending' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
    await waitForCount(/^1 booking$/);
  });
});
