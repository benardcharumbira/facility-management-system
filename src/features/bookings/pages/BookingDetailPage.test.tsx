import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedBookings } from '@/mocks/data/bookingSeeds';
import { bookingStore } from '@/mocks/data/bookingStore';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.applicant);
  setViewportWidth(DESKTOP_WIDTH);
  seedBookings(FIXED_NOW);
});

afterEach(() => vi.unstubAllEnvs());

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const open = async (id: string, reference: string) => {
  const view = renderApp(`/bookings/${id}`);
  await heading(reference);
  return view;
};
const header = () =>
  screen.getAllByRole('heading', { level: 1 })[0]?.closest('header') as HTMLElement;
const statusPanel = () =>
  screen.getByRole('region', { name: /./, hidden: false, description: '' }) as HTMLElement;
void statusPanel;

describe('the answer, before any scrolling', () => {
  it('says a pending request is being reviewed, how long it has waited, and when to expect an answer', async () => {
    await open('seed-pending', 'MVL-2026-9001');
    // Everything below sits inside the header, above the details.
    const top = header();
    expect(within(top).getByText('Pending', { selector: 'span' })).toBeVisible();
    expect(
      within(top).getByRole('heading', {
        level: 2,
        name: 'The municipality is reviewing your request',
      }),
    ).toBeVisible();
    expect(within(top).getByText(/has been waiting 3 days/)).toBeVisible();
    expect(await within(top).findByText('We expect to reply within 5 working days.')).toBeVisible();
    expect(within(top).getByText('It is not confirmed until it has been approved.')).toBeVisible();
  });

  it('explains the hold in words, with a date, and no countdown', async () => {
    await open('seed-pending', 'MVL-2026-9001');
    expect(
      screen.getByText(
        'While it waits, your request holds this time until 9 November 2026. If it has not been decided by then, the time is released.',
      ),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/countdown|remaining|ticking|expires in/i);
    expect(document.querySelector('[role="timer"], time[data-countdown]')).toBeNull();
  });

  it('says an approved booking is confirmed', async () => {
    await open('seed-approved', 'MVL-2026-9002');
    const top = header();
    expect(within(top).getByText('Approved', { selector: 'span' })).toBeVisible();
    expect(
      within(top).getByRole('heading', { level: 2, name: 'Your booking is confirmed' }),
    ).toBeVisible();
    expect(
      within(top).getByText(
        /Rothdene Hall is booked for you on Monday 30 November 2026, 08:00 to 12:00/,
      ),
    ).toBeVisible();
  });

  it('gives a rejection reason in full', async () => {
    await open('seed-rejected', 'MVL-2026-9004');
    const top = header();
    expect(
      within(top).getByRole('heading', { level: 2, name: 'This request was declined' }),
    ).toBeVisible();
    const reason = within(top).getByText(/reserved for a municipal event/);
    expect(reason.textContent).toBe(
      'The hall is reserved for a municipal event on this date and cannot be released. We are unable to offer an alternative evening that week because the hall is closed for floor maintenance from Monday to Thursday. If your date is flexible, please submit a new request for any evening from the following Friday onwards and we will review it as quickly as we can.',
    );
  });

  it('says who cancelled and why, and that the time was released', async () => {
    await open('seed-cancelled', 'MVL-2026-9005');
    expect(
      screen.getByRole('heading', { level: 2, name: 'This booking was cancelled' }),
    ).toBeVisible();
    expect(
      screen.getByText(/cancelled by you on 29 October 2026\. The time has been released\./),
    ).toBeVisible();
    expect(
      screen.getByText('Reason given: The event has been postponed to next year.'),
    ).toBeVisible();
  });

  it('says a draft has not been sent and offers to continue', async () => {
    await open('seed-draft', 'MVL-2026-9000');
    expect(
      screen.getByRole('heading', { level: 2, name: 'This request has not been sent yet' }),
    ).toBeVisible();
    expect(screen.getByText(/Nothing is held for you until you submit it/)).toBeVisible();
  });

  it('shows all five statuses with distinct words', async () => {
    const seen = new Set<string>();
    for (const [id, ref, word] of [
      ['seed-draft', 'MVL-2026-9000', 'Draft'],
      ['seed-pending', 'MVL-2026-9001', 'Pending'],
      ['seed-approved', 'MVL-2026-9002', 'Approved'],
      ['seed-rejected', 'MVL-2026-9004', 'Rejected'],
      ['seed-cancelled', 'MVL-2026-9005', 'Cancelled'],
    ] as const) {
      const { unmount } = await open(id, ref);
      expect(within(header()).getByText(word, { selector: 'span' })).toBeVisible();
      seen.add(word);
      unmount();
    }
    expect(seen.size).toBe(5);
  });
});

describe('after the lists they were made from change', () => {
  it('still names the event type and seating arrangement of a booking, once they are archived', async () => {
    const sysadmin = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:mock-sysadmin',
    });
    await sysadmin.post('/admin/event-types/workshop/archive');
    await sysadmin.post('/admin/seating-arrangements/school-room/archive');
    await open('seed-approved', 'MVL-2026-9002');

    const details = screen
      .getByRole('heading', { level: 2, name: 'Booking details' })
      .closest('section') as HTMLElement;
    expect(await within(details).findByText('Workshop or training')).toBeVisible();
    expect(within(details).getByText('School room')).toBeVisible();
  });
});

describe('details, history and hierarchy', () => {
  it('shows everything that was submitted, and downloads a document', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await open('seed-approved', 'MVL-2026-9002');

    const details = screen
      .getByRole('heading', { level: 2, name: 'Booking details' })
      .closest('section') as HTMLElement;
    expect(await within(details).findByText('Workshop or training')).toBeVisible();
    expect(within(details).getByText('Community skills workshop')).toBeVisible();
    expect(within(details).getByText('80')).toBeVisible();
    expect(within(details).getByText('School room')).toBeVisible();
    expect(within(details).getByText('Chairs × 80')).toBeVisible();
    expect(within(details).getByText('Urn × 1')).toBeVisible();
    expect(within(details).getByText('Cups × 80')).toBeVisible();

    await userEvent.click(within(details).getByRole('button', { name: 'Download programme.pdf' }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    expect(await blob.text()).toBe('Mock contents of programme.pdf');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('lists what has happened, with when and by whom', async () => {
    await open('seed-approved', 'MVL-2026-9002');
    const log = screen.getByRole('list', { name: 'Booking history' });
    const titles = within(log)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p')?.textContent);
    expect(titles).toEqual([
      'Request started by you',
      'Submitted for approval by you',
      'Approved by the municipality',
      'Change of date requested by you',
    ]);
    expect(within(log).getAllByText(/\d{1,2} \w+ 2026, \d\d:\d\d/)).toHaveLength(4);
  });

  it('records a rejection reason in the history too', async () => {
    await open('seed-rejected', 'MVL-2026-9004');
    const log = screen.getByRole('list', { name: 'Booking history' });
    expect(log).toHaveTextContent('Rejected by the municipality');
    expect(within(log).getByText(/reserved for a municipal event/)).toBeVisible();
  });

  it('restates what a booking covers where the venue is part of a hierarchy', async () => {
    const booking = bookingStore.get('seed-pending', 'mock-user-1');
    if (!booking) throw new Error('missing');
    bookingStore.update({
      ...booking,
      facilityId: 'mitchell-wing',
      facility: { id: 'mitchell-wing', name: 'Mitchell Wing', timeZone: 'Africa/Johannesburg' },
    });
    await open('seed-pending', 'MVL-2026-9001');
    expect(await screen.findByText(/Mitchell Wing is part of City Hall/)).toBeVisible();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'shows times in the facility zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      await open('seed-approved', 'MVL-2026-9002');
      expect(
        within(header()).getAllByText(/Monday 30 November 2026, 08:00 to 12:00/).length,
      ).toBeGreaterThan(0);
      expect(
        within(screen.getByRole('list', { name: 'Booking history' })).getAllByRole('listitem'),
      ).toHaveLength(4);
    },
  );
});

describe('not found', () => {
  it.each(['seed-other', 'no-such-booking'])(
    'renders not found for %s, the same either way',
    async (id) => {
      renderApp(`/bookings/${id}`);
      expect(await screen.findByText('We could not find that booking')).toBeVisible();
      expect(screen.queryByText(/forbidden|permission/i)).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to my bookings' })).toHaveAttribute(
        'href',
        '/bookings',
      );
    },
  );
});

describe('actions by status', () => {
  const actions = () => screen.getByRole('region', { name: 'What you can do' });

  it('offers a draft to be continued or deleted', async () => {
    const { router } = await open('seed-draft', 'MVL-2026-9000');
    expect(within(actions()).getByRole('link', { name: 'Continue editing' })).toHaveAttribute(
      'href',
      '/bookings/new?draft=seed-draft',
    );

    await userEvent.click(within(actions()).getByRole('button', { name: 'Delete draft' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this draft?' });
    expect(within(dialog).getByText(/Nothing has been sent to the municipality/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/bookings'));
    expect(await screen.findByRole('heading', { level: 1, name: 'My bookings' })).toBeVisible();
    await waitFor(() => expect(screen.queryByText('MVL-2026-9000')).not.toBeInTheDocument());
  });

  it('offers a pending request only a cancellation', async () => {
    await open('seed-pending', 'MVL-2026-9001');
    expect(within(actions()).getAllByRole('button')).toHaveLength(1);
    expect(within(actions()).getByRole('button', { name: 'Cancel request' })).toBeVisible();
    expect(within(actions()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers an approved booking a change of date, cancellation and printing', async () => {
    const booking = bookingStore.get('seed-approved', 'mock-user-1');
    if (booking) bookingStore.update({ ...booking, rescheduleRequest: null });
    await open('seed-approved', 'MVL-2026-9002');
    expect(within(actions()).getByRole('link', { name: 'Request a change of date' })).toBeVisible();
    expect(within(actions()).getByRole('button', { name: 'Cancel booking' })).toBeVisible();
    expect(within(actions()).getByRole('button', { name: 'Print this booking' })).toBeVisible();
  });

  it('offers a new, prefilled request for the same venue after a rejection or cancellation', async () => {
    await open('seed-rejected', 'MVL-2026-9004');
    const link = within(actions()).getByRole('link', {
      name: 'Start a new request for Vaal Marina Hall',
    });
    const url = new URL(link.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/bookings/new');
    expect(url.searchParams.get('facilityId')).toBe('vaal-marina-hall');
    expect(url.searchParams.get('startsAt')).not.toBeNull();
  });

  it('never offers an action that would fail: a booking too close to its event explains instead', async () => {
    await open('seed-approved-soon', 'MVL-2026-9003');
    expect(within(actions()).queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
    expect(
      within(actions()).queryByRole('link', { name: /change of date/ }),
    ).not.toBeInTheDocument();
    expect(
      within(actions()).getByText(
        /starts in less than 72 hours, so it can no longer be cancelled online/,
      ),
    ).toBeVisible();
    expect(
      within(actions()).getByText(/must be requested at least 72 hours before the event/),
    ).toBeVisible();
    // Printing is still fine.
    expect(within(actions()).getByRole('button', { name: 'Print this booking' })).toBeVisible();
  });

  it('shows no change of date action while one is already open', async () => {
    await open('seed-approved', 'MVL-2026-9002');
    expect(
      within(actions()).queryByRole('link', { name: 'Request a change of date' }),
    ).not.toBeInTheDocument();
    expect(
      within(actions()).getByText('A change of date has been requested. It is shown below.'),
    ).toBeVisible();
  });
});

describe('cancelling', () => {
  it('words cancelling a pending request and cancelling an approved booking differently', async () => {
    const { unmount } = await open('seed-pending', 'MVL-2026-9001');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    const pending = await screen.findByRole('alertdialog', { name: 'Cancel this request?' });
    expect(
      within(pending).getByText(/will stop reviewing your request for Lakeside Hall/),
    ).toBeVisible();
    expect(within(pending).getByText(/the time being held for you will be released/)).toBeVisible();
    expect(within(pending).getByText(/This cannot be undone\./)).toBeVisible();
    const pendingText = pending.textContent;
    unmount();

    await open('seed-approved', 'MVL-2026-9002');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const approved = await screen.findByRole('alertdialog', {
      name: 'Cancel this confirmed booking?',
    });
    expect(
      within(approved).getByText(/is confirmed for you on Monday 30 November 2026/),
    ).toBeVisible();
    expect(within(approved).getByText(/released to other people straight away/)).toBeVisible();
    expect(
      within(approved).getByText(/would have to submit a new request, which may not be approved/),
    ).toBeVisible();
    expect(
      within(approved).getByText(/open request to change the date will be withdrawn/),
    ).toBeVisible();
    expect(approved.textContent).not.toBe(pendingText);
    expect(within(approved).getByRole('button', { name: 'Keep my booking' })).toBeVisible();
  });

  it('updates the booking in place and confirms, without navigating away', async () => {
    const { router } = await open('seed-pending', 'MVL-2026-9001');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Plans changed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));

    expect(
      await screen.findByText(
        'Your request has been cancelled and the time held for you has been released.',
      ),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/bookings/seed-pending');
    expect(within(header()).getByText('Cancelled', { selector: 'span' })).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'This booking was cancelled' }),
    ).toBeVisible();
    const log = screen.getByRole('list', { name: 'Booking history' });
    expect(log).toHaveTextContent('Cancelled by you');
    expect(within(log).getByText('Plans changed')).toBeVisible();
    // The actions have changed with the status.
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start a new request for Lakeside Hall' }),
    ).toBeVisible();
  });

  it('works without a reason, and the dialog can be dismissed with Escape, returning focus', async () => {
    await open('seed-pending', 'MVL-2026-9001');
    const trigger = screen.getByRole('button', { name: 'Cancel request' });
    await userEvent.click(trigger);
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(within(header()).getByText('Pending', { selector: 'span' })).toBeVisible();
  });
});

describe('asking to change the date', () => {
  it('sends a request and leaves the booking approved on its original window, visibly, on both screens', async () => {
    const booking = bookingStore.get('seed-approved', 'mock-user-1');
    if (booking) bookingStore.update({ ...booking, rescheduleRequest: null });
    const { router } = await open('seed-approved', 'MVL-2026-9002');

    // From the booking to its calendar, which says what is held.
    await userEvent.click(screen.getByRole('link', { name: 'Request a change of date' }));
    expect(await screen.findByText('Choosing a new time for booking MVL-2026-9002')).toBeVisible();
    expect(
      screen.getByText(/You currently hold Monday 30 November 2026, 08:00 to 12:00/),
    ).toBeVisible();
    // The calendar opens on the booking's own day; close it to choose another.
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(await screen.findByRole('button', { name: /^Tuesday 24 November/ }));
    const panel = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(panel).getByLabelText('Start time'), '09:00');
    await userEvent.selectOptions(within(panel).getByLabelText('End time'), '12:00');
    await userEvent.click(within(panel).getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('link', { name: 'Review change request' }));

    // Back on the booking, the proposal sits beside what is held, for confirmation.
    await heading('MVL-2026-9002');
    expect(router.state.location.pathname).toBe('/bookings/seed-approved');
    const proposal = screen
      .getByRole('heading', { level: 2, name: 'Confirm your request to change the date' })
      .closest('section') as HTMLElement;
    expect(within(proposal).getByText('Monday 30 November 2026')).toBeVisible();
    expect(within(proposal).getByText('Tuesday 24 November 2026')).toBeVisible();
    expect(
      within(proposal).getByText(
        /This sends a request\. Your booking stays approved on Monday 30 November 2026, 08:00 to 12:00 until the municipality decides\./,
      ),
    ).toBeVisible();
    await userEvent.click(within(proposal).getByRole('button', { name: 'Send change request' }));

    expect(await screen.findByText(/Your request to change the date has been sent/)).toBeVisible();
    expect(within(header()).getByText('Approved', { selector: 'span' })).toBeVisible();
    expect(
      within(header()).getAllByText(/Monday 30 November 2026, 08:00 to 12:00/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Change of date requested' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Confirm your request to change the date' }),
    ).not.toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('proposedStartsAt')).toBeNull();

    // And on the list.
    await userEvent.click(screen.getByRole('link', { name: 'Back to my bookings' }));
    const row = (await screen.findByRole('link', { name: 'MVL-2026-9002, Approved' })).closest(
      'article',
    ) as HTMLElement;
    expect(within(row).getByText('Change of date requested')).toBeVisible();
  });

  it('says so when the proposed time has been taken', async () => {
    const booking = bookingStore.get('seed-approved', 'mock-user-1');
    if (booking) bookingStore.update({ ...booking, rescheduleRequest: null });
    // Rothdene Hall is fully booked, with set-up and clear-down, on Saturday 5 December.
    renderApp(
      '/bookings/seed-approved?proposedStartsAt=2026-12-05T07:00:00Z&proposedEndsAt=2026-12-05T10:00:00Z',
    );
    await heading('MVL-2026-9002');
    await userEvent.click(await screen.findByRole('button', { name: 'Send change request' }));
    expect(await screen.findByText('That time is no longer available')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Choose another time' })).toBeVisible();
    expect(within(header()).getByText('Approved', { selector: 'span' })).toBeVisible();
  });
});

describe('printing', () => {
  it('prints an approved booking as one clean page, without navigation or interface chrome', async () => {
    await open('seed-approved', 'MVL-2026-9002');

    await screen.findAllByText('Workshop or training');
    const printable = screen.getByRole('article', { name: 'Printable booking', hidden: true });
    // It is for the printed page only.
    expect(printable.closest('.hidden')).not.toBeNull();
    expect(printable.closest('.print\\:block')).not.toBeNull();
    expect(printable).toHaveTextContent('MVL-2026-9002');
    expect(printable).toHaveTextContent('Rothdene Hall');
    expect(printable).toHaveTextContent('Monday 30 November 2026');
    expect(printable).toHaveTextContent('08:00 to 12:00 (Africa/Johannesburg time)');
    expect(printable).toHaveTextContent('Community skills workshop');
    expect(printable).toHaveTextContent('Chairs × 80');
    expect(printable).toHaveTextContent('Urn × 1');
    // No buttons, links or navigation in it.
    expect(within(printable).queryAllByRole('button', { hidden: true })).toHaveLength(0);
    expect(within(printable).queryAllByRole('link', { hidden: true })).toHaveLength(0);
    expect(within(printable).queryAllByRole('navigation', { hidden: true })).toHaveLength(0);

    // Everything else on the page is left out of the print.
    expect(document.querySelector('header.print\\:hidden')).not.toBeNull(); // the app bar
    expect(document.querySelector('aside.print\\:hidden')).not.toBeNull(); // the navigation
    expect(
      screen.getByRole('heading', { level: 1, name: 'MVL-2026-9002' }).closest('.print\\:hidden'),
    ).not.toBeNull();
    expect(
      screen.getByRole('region', { name: 'What you can do' }).closest('.print\\:hidden'),
    ).not.toBeNull();
    expect(printable.closest('.print\\:hidden')).toBeNull();
  });

  it('calls the browser print when asked', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await open('seed-approved', 'MVL-2026-9002');
    await userEvent.click(screen.getByRole('button', { name: 'Print this booking' }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it('has no printable version for a booking that is not approved', async () => {
    await open('seed-pending', 'MVL-2026-9001');
    expect(
      screen.queryByRole('article', { name: 'Printable booking', hidden: true }),
    ).not.toBeInTheDocument();
  });
});

describe('the public journey, end to end', () => {
  it('browse, detail, calendar, request, submit, find it in my bookings, open it and cancel it', async () => {
    renderApp('/facilities?q=lakeside');
    await userEvent.click(await screen.findByRole('link', { name: 'Lakeside Hall' }));
    await screen.findByRole('heading', { level: 1, name: 'Lakeside Hall' });

    await userEvent.click(await screen.findByRole('button', { name: /^Wednesday 25 November/ }));
    const panel = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(panel).getByLabelText('Start time'), '09:00');
    await userEvent.selectOptions(within(panel).getByLabelText('End time'), '12:00');
    await userEvent.click(within(panel).getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('link', { name: 'Request booking' }));

    const step = (name: string) => screen.findByRole('heading', { level: 2, name });
    await step('When and where');
    await screen.findByText('This time is still available.');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await step('Event details');
    await userEvent.selectOptions(screen.getByLabelText(/^Type of meeting or event/), 'Meeting');
    await userEvent.type(screen.getByLabelText(/^Event description/), 'Residents meeting');
    await userEvent.selectOptions(screen.getByLabelText(/^Seating arrangement/), 'Cinema');
    await userEvent.type(screen.getByLabelText(/^Expected attendees/), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await step('Resources');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await step('Documents');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await step('Review and submit');
    await userEvent.click(screen.getByLabelText(/I accept the terms and conditions/));
    await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your request has been received' }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'View this booking' }));
    await screen.findByRole('heading', {
      level: 2,
      name: 'The municipality is reviewing your request',
    });

    // It is in My bookings, needing attention.
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', {
        name: 'My bookings',
      }),
    );
    const attention = await screen.findByRole('region', { name: /^Needs attention/ });
    expect(within(attention).getByText(/Residents meeting/)).toBeVisible();

    // Open it and cancel it.
    const mine = within(attention)
      .getAllByRole('link', { name: /^MVL-2026-\d+, Pending$/ })
      .find((link) => link.getAttribute('href')?.startsWith('/bookings/bk-'));
    await userEvent.click(mine as HTMLElement);
    await screen.findByRole('heading', {
      level: 2,
      name: 'The municipality is reviewing your request',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Cancel request',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'This booking was cancelled' }),
    ).toBeVisible();
  });
});

describe('on a small screen', () => {
  it('keeps the dialogs usable', async () => {
    setViewportWidth(MOBILE_WIDTH);
    await open('seed-pending', 'MVL-2026-9001');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Keep my request' })).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep my request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
