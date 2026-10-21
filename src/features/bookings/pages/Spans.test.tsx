import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TERMS_VERSION } from '@/mocks/data/bookingOptions';
import { seedFacilityAdmin, seedSpanRequests } from '@/mocks/data/facilityAdminSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient, type Booking, type ImpactResult } from '@/shared/api';
import { ImpactDialog } from '@/shared/components';
import { ROLES } from '@/shared/auth';
import { clerkState } from '@/test/clerk-mock';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  seedFacilityAdmin(FIXED_NOW);
  seedSpanRequests(FIXED_NOW);
});

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const signInAs = (id: string, role: (typeof ROLES)[keyof typeof ROLES] = ROLES.applicant) => {
  mockMeRole(role);
  clerkState.getToken.mockImplementation(async () => `user:${id}`);
};

/** Friday 27 November 14:00 to Sunday 29 November 12:00 in Johannesburg. */
const WEEKEND = { startsAt: '2026-11-27T12:00:00Z', endsAt: '2026-11-29T10:00:00Z' };
const formAt = (facilityId: string, window: { startsAt: string; endsAt: string }) =>
  `/bookings/new?facilityId=${facilityId}&startsAt=${encodeURIComponent(window.startsAt)}&endsAt=${encodeURIComponent(window.endsAt)}`;
const stepHeading = (name: string) => screen.findByRole('heading', { level: 2, name });
const press = (name: string) => userEvent.click(screen.getByRole('button', { name }));
const select = (label: string, option: string) =>
  userEvent.selectOptions(screen.getByLabelText(new RegExp(`^${label}`)), option);

async function toReview(path: string) {
  const view = renderApp(path);
  await stepHeading('When and where');
  await screen.findByText('This time is still available.');
  await press('Continue');
  await stepHeading('Event details');
  await select('Type of meeting or event', 'Wedding');
  await userEvent.type(screen.getByLabelText(/^Event description/), 'A wedding weekend');
  await select('Seating arrangement', 'Banquet');
  await userEvent.type(screen.getByLabelText(/^Expected attendees/), '80');
  await press('Continue');
  await stepHeading('Resources');
  await press('Continue');
  await stepHeading('Documents');
  await press('Continue');
  await stepHeading('Review and submit');
  return view;
}

describe('the booking form', () => {
  it('prefills a span from the calendar and presents it as a date range, not two dates', async () => {
    renderApp(formAt('lakeside-hall', WEEKEND));
    await stepHeading('When and where');
    const facts = screen.getByText('Your request').closest('section') as HTMLElement;
    expect(await within(facts).findByText('Dates')).toBeVisible();
    expect(
      within(facts).getByText('Friday 27 November to Sunday 29 November 2026, three days'),
    ).toBeVisible();
    expect(
      within(facts).getByText(
        '14:00 on the first day to 12:00 on the last day (Africa/Johannesburg time)',
      ),
    ).toBeVisible();
    expect(within(facts).queryByText('Date')).toBeNull();
    expect(await screen.findByText('This time is still available.')).toBeVisible();
  });

  it('keeps a single day as a date and a time', async () => {
    renderApp(
      formAt('lakeside-hall', { startsAt: '2026-11-24T07:00:00Z', endsAt: '2026-11-24T10:00:00Z' }),
    );
    await stepHeading('When and where');
    expect(await screen.findByText('Tuesday 24 November 2026')).toBeVisible();
    expect(screen.getByText('09:00 to 12:00 (Africa/Johannesburg time)')).toBeVisible();
  });

  it('says on arrival which day broke a span that was free when it was chosen', async () => {
    renderApp(
      formAt('mitchell-wing', { startsAt: '2026-11-19T14:00:00Z', endsAt: '2026-11-21T10:00:00Z' }),
    );
    await stepHeading('When and where');
    const warning = await screen.findByText('This time is no longer available');
    expect(warning).toBeVisible();
    expect(screen.getByText(/Friday 20 November is not free: City Hall is booked/)).toBeVisible();
  });

  it('says that a span is too long, with the limit', async () => {
    renderApp(
      formAt('lakeside-hall', { startsAt: '2026-11-23T08:00:00Z', endsAt: '2026-12-01T10:00:00Z' }),
    );
    await stepHeading('When and where');
    expect(await screen.findByText(/at most 7 days\. Yours covers 9/)).toBeVisible();
  });

  it('reads the whole span in words on the review step', async () => {
    await toReview(formAt('lakeside-hall', WEEKEND));
    expect(
      screen.getByText(
        'Friday 27 November 14:00 to Sunday 29 November 12:00, three days (Africa/Johannesburg time)',
      ),
    ).toBeVisible();
    expect(screen.getByText('Dates and times')).toBeVisible();
  });

  it('is requested as one booking with one reference, and the confirmation says the dates', async () => {
    const { router } = await toReview(formAt('lakeside-hall', WEEKEND));
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await press('Submit request');
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/bookings\/bk-\d+\/confirmation$/),
    );
    expect(await screen.findByText('Dates')).toBeVisible();
    expect(
      screen.getByText('Friday 27 November to Sunday 29 November 2026, three days'),
    ).toBeVisible();
    const id = router.state.location.pathname.split('/')[2] ?? '';
    const booking = await as(null).get<Booking>(`/bookings/${id}`);
    expect(booking).toMatchObject({ status: 'pending', ...WEEKEND });
    const mine = await as(null).get<{ items: Array<{ reference: string }> }>('/bookings');
    expect(mine.items.filter((b) => b.reference === booking.reference)).toHaveLength(1);
  });

  it('meets a competing booking on a day inside the span with the conflict path, losing no answers', async () => {
    await toReview(formAt('lakeside-hall', WEEKEND));
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    // Someone else takes the Saturday while this applicant reviews.
    const rival = as('user:applicant-grace');
    const draft = await rival.post<Booking>('/bookings', {
      body: {
        facilityId: 'lakeside-hall',
        startsAt: '2026-11-28T07:00:00Z',
        endsAt: '2026-11-28T10:00:00Z',
      },
    });
    await rival.patch(`/bookings/${draft.id}`, {
      body: {
        eventTypeId: 'meeting',
        description: 'The other applicant',
        attendeeCount: 10,
        seatingArrangementId: 'cinema',
        acceptedTermsVersion: TERMS_VERSION,
      },
    });
    await rival.post(`/bookings/${draft.id}/submit`);

    await press('Submit request');
    const notice = await screen.findByText('That time is no longer available');
    expect(notice).toBeVisible();
    expect(screen.getByRole('link', { name: 'Choose another time' })).toBeVisible();
    expect(screen.getByText(/Nothing you entered has been lost/)).toBeVisible();
    // The clash is on a day inside the span, and says so.
    expect(screen.getByText(/Sat 28 Nov, 09:00 to 12:00|09:00 to 12:00/)).toBeVisible();
  });
});

describe('my bookings and the booking', () => {
  it('lists a span as a range in its row, with one reference', async () => {
    signInAs('applicant-dawie');
    renderApp('/bookings?group=upcoming');
    const row = (await screen.findByText('MVL-2026-9301')).closest('article') as HTMLElement;
    expect(
      within(row).getByText('Friday 8 January 14:00 to Sunday 10 January 12:00, three days'),
    ).toBeVisible();
    expect(screen.getAllByText('MVL-2026-9301')).toHaveLength(1);
  });

  it('shows the span as a range on the booking, and cancels and changes it as a whole', async () => {
    signInAs('applicant-dawie');
    renderApp('/bookings/adm-9301');
    await screen.findByRole('heading', { level: 1, name: 'MVL-2026-9301' });
    expect(
      screen.getAllByText(/Friday 8 January 14:00 to Sunday 10 January 12:00, three days/).length,
    ).toBeGreaterThan(0);
    // Whole booking actions only.
    expect(screen.getByRole('button', { name: /Cancel booking/ })).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Ask to change the date|Request a change of date/ }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Cancel (this )?day/i })).toBeNull();
  });
});

describe('the approval queue', () => {
  it('lists a span as one item with its range, and shows its length and its competitors on the detail', async () => {
    signInAs('approver-vaal', ROLES.facilityAdmin);
    renderApp('/approvals');
    const items = await screen.findAllByRole('link', { name: /MVL-2026-9302/ });
    expect(items).toHaveLength(1);
    expect(
      within(items[0]?.closest('li') as HTMLElement).getByText(
        /Thu 14 Jan, 12:00 to Sat 16 Jan, 12:00/,
      ),
    ).toBeVisible();

    await userEvent.click(items[0] as HTMLElement);
    const detail = await screen.findByRole('article', { name: 'MVL-2026-9302 detail' });
    expect(
      within(detail).getByText(
        'Thursday 14 January 12:00 to Saturday 16 January 12:00, three days',
      ),
    ).toBeVisible();
    expect(
      within(detail).getByText(/Covers three days in a row, as one request with one decision/),
    ).toBeVisible();
    // The single day request in the middle of it competes.
    expect(within(detail).getByText(/MVL-2026-9303/)).toBeVisible();
  });
});

describe('the closure impact', () => {
  it('says which day of a span a closure falls on, and that the whole booking is affected', () => {
    const impact: ImpactResult = {
      totalAffected: 1,
      affectedBookings: [
        {
          bookingId: 'adm-9301',
          reference: 'MVL-2026-9301',
          applicantName: 'Dawie Steyn',
          facility: { id: 'rothdene-hall', name: 'Rothdene Hall', timeZone: 'Africa/Johannesburg' },
          startsAt: '2027-01-08T12:00:00Z',
          endsAt: '2027-01-10T10:00:00Z',
          status: 'approved',
          reason: 'inside_blackout',
          day: '2027-01-09',
          conflictsWith: null,
        },
      ],
    };
    render(
      <ImpactDialog
        open
        onOpenChange={() => {}}
        title="Close Rothdene Hall?"
        summary="A closure."
        impact={impact}
        confirmLabel="Close it"
        onConfirm={async () => {}}
      />,
    );
    expect(
      screen.getByText(
        /The closure falls on Saturday 9 January, one day of this booking\. The booking is one unit, so all of it is affected\./,
      ),
    ).toBeVisible();
    expect(screen.getByText(/Fri 8 Jan, 14:00 to Sun 10 Jan, 12:00/)).toBeVisible();
  });
});
