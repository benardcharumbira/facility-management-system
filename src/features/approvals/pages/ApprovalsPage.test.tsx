import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedApprovals } from '@/mocks/data/approvalSeeds';
import { TEST_API_BASE_URL } from '@/mocks/server';
import { createApiClient } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import { clerkState } from '@/test/clerk-mock';
import { FIXED_NOW } from '@/test/clock';
import { mockMeRole, renderApp } from '@/test/render';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from '@/test/viewport';

beforeEach(() => {
  mockMeRole(ROLES.facilityAdmin);
  setViewportWidth(DESKTOP_WIDTH);
  seedApprovals(FIXED_NOW);
});

// Hidden too: an open dialog hides the page behind it from the accessibility tree.
const queueList = () => screen.getByRole('list', { name: 'Approval queue', hidden: true });
const row = (n: number) =>
  within(queueList()).getByRole('link', { name: new RegExp(`^MVL-2026-${n},`) });
const rowArticle = (n: number) => row(n).closest('article') as HTMLElement;
const references = () =>
  within(queueList())
    .getAllByRole('link', { hidden: true })
    .map((link) => /MVL-2026-\d+/.exec(link.getAttribute('aria-label') ?? '')?.[0]);
const detailPanel = () => screen.getByRole('region', { name: 'Selected request' });
const heading = (n: number) => screen.findByRole('heading', { level: 2, name: `MVL-2026-${n}` });

/** Opens the queue and waits for the first request to be selected, as it is on a desktop. */
async function openQueue(path = '/approvals') {
  const view = renderApp(path);
  await screen.findByRole('list', { name: 'Approval queue' });
  return view;
}
async function openRequest(n: number) {
  await userEvent.click(row(n));
  await heading(n);
}
const competing = () => within(detailPanel()).getByRole('region', { name: 'Competing requests' });
const waitingCount = () => screen.getByRole('status');

describe('the queue', () => {
  it('shows pending items only, longest waiting first, for the approver’s facilities', async () => {
    await openQueue();
    await waitFor(() => expect(waitingCount()).toHaveTextContent('12 waiting'));
    expect(references()).toEqual([
      'MVL-2026-9101',
      'MVL-2026-9109',
      'MVL-2026-9110',
      'MVL-2026-9102',
      'MVL-2026-9116',
      'MVL-2026-9106',
      'MVL-2026-9104',
      'MVL-2026-9103',
      'MVL-2026-9105',
      'MVL-2026-9108',
      'MVL-2026-9107',
      'MVL-2026-9115',
    ]);
    // Vaal Marina Hall and the Activity Room are somebody else's.
    expect(screen.queryByText(/MVL-2026-9112/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MVL-2026-9113/)).not.toBeInTheDocument();
  });

  it('carries the reference, facility, event window, applicant, event type and waiting time on each row', async () => {
    await openQueue();
    const first = rowArticle(9101);
    expect(within(first).getByText('Over target by 27 hours')).toBeVisible();
    expect(within(first).getByText('City Hall · Thandi Nkosi')).toBeVisible();
    expect(within(first).getByText('Sat 14 Nov, 08:00 to 17:00 · Wedding')).toBeVisible();
    expect(within(first).getByText('Waiting 6 days')).toBeVisible();

    const committee = rowArticle(9107);
    expect(within(committee).getByText('City Hall Committee Room · Lerato Mokoena')).toBeVisible();
    expect(within(committee).getByText('Mon 9 Nov, 14:00 to 16:00 · Meeting')).toBeVisible();
    expect(within(committee).getByText('Waiting 18 hours')).toBeVisible();
  });

  it('flags what is past or near its target, what has a hold ending soon, and what has competition', async () => {
    await openQueue();
    expect(within(rowArticle(9101)).getByText('Over target by 27 hours')).toBeVisible();
    expect(within(rowArticle(9106)).getByText('Hold ends in 20 hours')).toBeVisible();
    expect(within(rowArticle(9101)).getByText('Competes with 2')).toBeVisible();
    expect(within(rowArticle(9102)).getByText('Competes with 1')).toBeVisible();
    expect(within(rowArticle(9116)).queryByText(/Competes with/)).not.toBeInTheDocument();
    // Approaching its target: waiting 4 days of 5.
    expect(within(rowArticle(9110)).getByText('Target in 24 hours')).toBeVisible();
    // No target is published for the committee room, so nothing to flag.
    expect(within(rowArticle(9107)).queryByText(/target/i)).not.toBeInTheDocument();
    expect(within(rowArticle(9110)).getByText('Cannot be approved')).toBeVisible();
  });

  it('tells a change of date from a new request by words, icon and the dates it carries', async () => {
    await openQueue();
    const move = rowArticle(9108);
    expect(within(move).getByText('Change of date')).toBeVisible();
    expect(within(move).getByText(/^Now /)).toBeVisible();
    expect(within(move).getByText(/^Move to /)).toBeVisible();
    expect(within(rowArticle(9116)).getByText('New request')).toBeVisible();
    expect(within(rowArticle(9116)).queryByText(/^Move to /)).not.toBeInTheDocument();
  });

  it('selects the first request on a desktop, so the detail is never an empty pane', async () => {
    const { router } = await openQueue();
    await heading(9101);
    expect(router.state.location.pathname).toBe('/approvals/appr-9101');
    expect(row(9101)).toHaveAttribute('aria-current', 'true');
  });

  it('keeps search, status, kind and sort in the URL, and keeps them when selecting', async () => {
    const { router } = await openQueue('/approvals?q=maria&sort=eventDate');
    await waitFor(() => expect(references()).toEqual(['MVL-2026-9115', 'MVL-2026-9105']));
    await userEvent.click(row(9115));
    await heading(9115);
    expect(router.state.location.pathname).toBe('/approvals/appr-9115');
    expect(router.state.location.search).toBe('?q=maria&sort=eventDate');

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'facility');
    await waitFor(() => expect(router.state.location.search).toContain('sort=facility'));
  });

  it('lets decided items be reviewed, and shows who decided and the reason', async () => {
    await openQueue('/approvals?status=rejected');
    await waitFor(() => expect(references()).toEqual(['MVL-2026-9114']));
    await heading(9114);
    const banner = within(detailPanel()).getByText(/^Rejected by Nomsa Dlamini on/);
    expect(banner).toBeVisible();
    expect(within(detailPanel()).getByText(/past 22:00 at Rothdene Hall/)).toBeVisible();
    expect(
      within(detailPanel()).queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });

  it('filters by kind of request', async () => {
    await openQueue('/approvals?type=reschedule_request');
    await waitFor(() => expect(references()).toEqual(['MVL-2026-9109', 'MVL-2026-9108']));
  });

  it('reads as a good outcome, not an error, when the queue is clear', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:approver-empty');
    renderApp('/approvals');
    expect(await screen.findByText('Nothing is waiting for a decision')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('You are all caught up')).toBeVisible();
  });

  it('says so when nothing matches the search', async () => {
    renderApp('/approvals?q=zzzz');
    expect(await screen.findByText('No requests match')).toBeVisible();
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland'])(
    'shows times in the facility zone, not the system zone (%s)',
    async (zone) => {
      vi.stubEnv('TZ', zone);
      await openQueue();
      expect(
        within(rowArticle(9101)).getByText('Sat 14 Nov, 08:00 to 17:00 · Wedding'),
      ).toBeVisible();
      await heading(9101);
      expect(
        within(detailPanel()).getByText('Saturday 14 November 2026, 08:00 to 17:00'),
      ).toBeVisible();
      vi.unstubAllEnvs();
    },
  );
});

describe('competing requests', () => {
  it('shows a request for the same venue and time with its reference and applicant', async () => {
    await openQueue();
    await openRequest(9104);
    const section = competing();
    expect(within(section).getByRole('link', { name: 'MVL-2026-9105' })).toHaveAttribute(
      'href',
      '/approvals/appr-9105',
    );
    expect(within(section).getByText('Maria van der Merwe · Rothdene Hall')).toBeVisible();
    expect(
      within(section).getByText('Wants Rothdene Hall too, at an overlapping time.'),
    ).toBeVisible();
    expect(within(section).getByText(/Overlap: Sun 22 Nov, 10:00 to 13:00/)).toBeVisible();
    expect(within(section).getByText(/Submitted Sun 1 Nov/)).toBeVisible();
    expect(
      within(section).getByText(/1 other pending request wants overlapping time/),
    ).toBeVisible();
  });

  it('shows a child its parent, and a parent its children, each with the relationship', async () => {
    await openQueue();
    await openRequest(9102);
    expect(
      within(competing()).getByText(
        'Wants City Hall, which contains Mitchell Wing, at an overlapping time.',
      ),
    ).toBeVisible();
    expect(within(competing()).getByRole('link', { name: 'MVL-2026-9101' })).toBeVisible();

    await openRequest(9101);
    const section = competing();
    expect(
      within(section).getByText(
        'Wants Mitchell Wing, which is part of City Hall, at an overlapping time.',
      ),
    ).toBeVisible();
    expect(
      within(section).getByText(
        'Wants Loch Wing, which is part of City Hall, at an overlapping time.',
      ),
    ).toBeVisible();
    expect(within(section).getByText('Johan Pretorius · Mitchell Wing')).toBeVisible();
    expect(within(section).getByText('Aisha Patel · Loch Wing')).toBeVisible();
  });

  it('states what approving a City Hall request takes with it', async () => {
    await openQueue();
    await heading(9101);
    expect(
      within(detailPanel()).getByText(
        'Approving this takes City Hall and therefore Mitchell Wing, City Hall Committee Room and Loch Wing.',
      ),
    ).toBeVisible();
    await openRequest(9102);
    expect(
      within(detailPanel()).getByText(
        'Mitchell Wing is part of City Hall. While it is booked, City Hall cannot be booked as a whole.',
      ),
    ).toBeVisible();
  });

  it('says plainly when nothing competes', async () => {
    await openQueue();
    await openRequest(9116);
    expect(within(competing()).getByText('No other request competes for this time.')).toBeVisible();
  });

  it('shows that a request cannot be approved because an approved booking is in the way', async () => {
    await openQueue();
    await openRequest(9110);
    expect(within(detailPanel()).getByText('This request cannot be approved')).toBeVisible();
    expect(within(competing()).getByRole('link', { name: 'MVL-2026-9111' })).toBeVisible();
    expect(
      within(detailPanel()).queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(within(detailPanel()).getByRole('button', { name: 'Reject' })).toBeVisible();
  });
});

describe('a change of date', () => {
  it('shows where the booking is now and where it would go, apart from a new request', async () => {
    await openQueue();
    await openRequest(9108);
    const panel = detailPanel();
    expect(within(panel).getByText('Change of date', { selector: 'span' })).toBeVisible();
    expect(within(panel).getByText('The change asked for')).toBeVisible();
    expect(within(panel).getByText('Booked now')).toBeVisible();
    expect(within(panel).getByText('Proposed')).toBeVisible();
    expect(within(panel).getByText('Wednesday 2 December 2026, 09:00 to 13:00')).toBeVisible();
    expect(within(panel).getByText('Wednesday 9 December 2026, 09:00 to 13:00')).toBeVisible();
  });

  it('describes the change in the confirmation and decides it at its own endpoint', async () => {
    await openQueue();
    await openRequest(9108);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Approve this change of date?' });
    expect(
      within(dialog).getByText(/The booking moves from Wednesday 2 December 2026/),
    ).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve change' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/MVL-2026-9108 approved/)).toBeVisible();
    await waitFor(() => expect(references()).not.toContain('MVL-2026-9108'));
  });
});

describe('deciding', () => {
  it('names the competing requests that approving will make impossible', async () => {
    await openQueue();
    await heading(9101);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Approve this request?' });
    expect(within(dialog).getByText('The slot is confirmed.')).toBeVisible();
    expect(within(dialog).getByText('Thandi Nkosi is emailed the decision.')).toBeVisible();
    const affected = within(dialog).getByRole('list', { name: 'Requests that become impossible' });
    expect(
      within(affected)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'MVL-2026-9102, Johan Pretorius, Mitchell Wing',
      'MVL-2026-9103, Aisha Patel, Loch Wing',
    ]);
    expect(within(dialog).getByLabelText('Internal note (optional)')).toBeVisible();
  });

  it('says when no other request is affected', async () => {
    await openQueue();
    await openRequest(9116);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('No other pending request is affected.')).toBeVisible();
  });

  it('leaves rivals in the queue, flagged, after one is approved', async () => {
    await openQueue();
    await heading(9101);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    expect(await screen.findByText(/MVL-2026-9101 approved. 2 competing requests/)).toBeVisible();
    await waitFor(() => expect(references()).not.toContain('MVL-2026-9101'));
    expect(within(rowArticle(9102)).getByText('Cannot be approved')).toBeVisible();
    expect(within(rowArticle(9103)).getByText('Cannot be approved')).toBeVisible();
  });

  it('will not reject without a reason, and says what the reason is for', async () => {
    await openQueue();
    await openRequest(9116);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject this request?' });

    const field = within(dialog).getByLabelText(/^Reason for the applicant/);
    expect(field).toHaveFocus();
    expect(within(dialog).getByText(/Sent to the applicant exactly as you write it/)).toBeVisible();
    expect(within(dialog).getByText(/the only explanation they will receive/)).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await within(dialog).findByText(/Give a reason/)).toBeVisible();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    // Still waiting: nothing was sent.
    expect(references()).toContain('MVL-2026-9116');

    await userEvent.type(field, '   ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await within(dialog).findByText(/Give a reason/)).toBeVisible();
  });

  it('rejects with the reason, and the applicant receives it unaltered', async () => {
    await openQueue();
    await openRequest(9116);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    const reason = 'Computer basics classes are held at the library.\nPlease contact them.';
    await userEvent.type(within(dialog).getByLabelText(/^Reason for the applicant/), reason);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    const theirs = await createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => 'user:applicant-lerato',
    }).get<{ status: string; rejectionReason: string }>('/bookings/appr-9116');
    expect(theirs).toMatchObject({ status: 'rejected', rejectionReason: reason });
  });

  it('moves on to the next request, selecting it and putting focus on it', async () => {
    const { router } = await openQueue();
    await openRequest(9116);
    expect(references().slice(3, 6)).toEqual(['MVL-2026-9102', 'MVL-2026-9116', 'MVL-2026-9106']);

    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await heading(9106);
    expect(router.state.location.pathname).toBe('/approvals/appr-9106');
    expect(row(9106)).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(row(9106)).toHaveFocus());
    expect(references()).not.toContain('MVL-2026-9116');
  });

  it('goes back one when the last request is decided, and clears when none are left', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:approver-vaal');
    const { router } = await openQueue();
    await heading(9112);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText(/^Reason/), 'The hall is closed.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));
    expect(await screen.findByText('Nothing is waiting for a decision')).toBeVisible();
    expect(router.state.location.pathname).toBe('/approvals');
  });

  it('handles a request someone else decided first, keeps what was typed, and moves on', async () => {
    const { router } = await openQueue();
    await openRequest(9115);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog');
    const reason = 'The school hall is free that day, please use it instead.';
    await userEvent.type(within(dialog).getByLabelText(/^Reason for the applicant/), reason);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject request' }));

    const message = await within(dialog).findByText(
      /This request was approved by Pieter van Wyk on/,
    );
    expect(message).toBeVisible();
    expect(within(dialog).getByText('Already decided').closest('[role="alert"]')).not.toBeNull();
    // What was typed is still there, and was not sent.
    expect(within(dialog).getByLabelText(/^Reason for the applicant/)).toHaveValue(reason);
    expect(within(dialog).getByText(/Your reason was not sent/)).toBeVisible();
    // Nothing more to confirm; only a way on.
    expect(
      within(dialog).queryByRole('button', { name: 'Reject request' }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    // It was the last in the queue, so the one before it is selected.
    await heading(9107);
    expect(router.state.location.pathname).toBe('/approvals/appr-9107');
    expect(references()).not.toContain('MVL-2026-9115');
  });

  it('refuses to approve what an approved booking now stands in the way of, and says why', async () => {
    await openQueue();
    await heading(9101);
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Approve' }));
    let dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await openRequest(9102);
    expect(within(detailPanel()).getByText('This request cannot be approved')).toBeVisible();
    expect(
      within(detailPanel()).getByText(/MVL-2026-9101 has already been approved/),
    ).toBeVisible();
    expect(
      within(detailPanel()).queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard('a');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // It can still be rejected, with a reason.
    await userEvent.click(within(detailPanel()).getByRole('button', { name: 'Reject' }));
    dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeVisible();
  });
});

describe('opening a request', () => {
  it('shows what the applicant submitted, with documents that can be downloaded', async () => {
    await openQueue();
    await heading(9101);
    const panel = detailPanel();
    expect(within(panel).getByText('Thandi Nkosi', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText(/Wedding reception for about 300 guests/)).toBeVisible();
    expect(within(panel).getByText('300', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('Banquet', { selector: 'dd' })).toBeVisible();
    expect(within(panel).getByText('Chairs × 300')).toBeVisible();
    expect(within(panel).getByText('Cups × 300')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Download catering-plan.pdf' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Download floor-layout.png' })).toBeVisible();
  });

  it('gives the facts that bear on the decision, and warnings where something is off', async () => {
    await openQueue();
    await openRequest(9106);
    const facts = within(detailPanel()).getByRole('region', { name: 'Context for the decision' });
    expect(
      within(facts).getByText(/400 people are expected, but Lakeside Hall holds 180/),
    ).toBeVisible();
    expect(within(facts).getByText(/Chairs: 400 requested, 180 held/)).toBeVisible();
    expect(within(facts).getByText('None before at Lakeside Hall.')).toBeVisible();
    expect(within(facts).getByText(/Within 5 days of submission/)).toBeVisible();

    await openRequest(9107);
    expect(
      within(detailPanel()).getByText('1 previous booking at City Hall Committee Room.'),
    ).toBeVisible();
    expect(within(detailPanel()).getByText('No target is set for this venue.')).toBeVisible();
  });

  it('gives the hold as a date and a sentence', async () => {
    await openQueue();
    await openRequest(9106);
    expect(
      within(detailPanel()).getByText(
        /The applicant's hold on this time ends on 3 November 2026, 06:00\./,
      ),
    ).toBeVisible();
  });

  it('answers not found for a request at a facility the approver is not designated against', async () => {
    renderApp('/approvals/appr-9112');
    expect(await screen.findByText('We could not find that request')).toBeVisible();
    expect(screen.queryByText(/MVL-2026-9112/)).not.toBeInTheDocument();
  });
});

describe('the keyboard', () => {
  it('moves between requests with j and k, and with the arrow keys from within the queue', async () => {
    const { router } = await openQueue();
    await heading(9101);

    await userEvent.keyboard('j');
    await heading(9109);
    expect(router.state.location.pathname).toBe('/approvals/rs-appr-9109');
    expect(row(9109)).toHaveFocus();

    await userEvent.keyboard('j');
    await heading(9110);
    await userEvent.keyboard('k');
    await heading(9109);

    // Arrow keys work with focus in the queue.
    expect(row(9109)).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await heading(9110);
    await userEvent.keyboard('{ArrowUp}');
    await heading(9109);
  });

  it('stops at the ends of the queue', async () => {
    await openQueue();
    await heading(9101);
    await userEvent.keyboard('k');
    expect(screen.getByRole('heading', { level: 2, name: 'MVL-2026-9101' })).toBeVisible();
  });

  it('replaces rather than stacks history as it moves, so Back leaves the queue', async () => {
    const { router } = await openQueue();
    await heading(9101);
    await userEvent.keyboard('jj');
    await heading(9110);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('opens the approve and reject confirmations with a and r, and Escape cancels', async () => {
    await openQueue();
    await openRequest(9116);

    await userEvent.keyboard('a');
    expect(await screen.findByRole('alertdialog', { name: 'Approve this request?' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await userEvent.keyboard('r');
    expect(await screen.findByRole('alertdialog', { name: 'Reject this request?' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(references()).toContain('MVL-2026-9116');
  });

  it('confirms with Enter, and a whole backlog can be worked without the mouse', async () => {
    const { router } = await openQueue();
    await openRequest(9116);

    await userEvent.keyboard('a');
    const dialog = await screen.findByRole('alertdialog');
    // Focus starts on the confirm button, so Enter confirms.
    expect(within(dialog).getByRole('button', { name: 'Approve request' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await heading(9106);

    // Reject the next one: type the reason, then Ctrl+Enter from the text box.
    await userEvent.keyboard('r');
    const rejectDialog = await screen.findByRole('alertdialog');
    expect(within(rejectDialog).getByLabelText(/^Reason for the applicant/)).toHaveFocus();
    await userEvent.keyboard('Not available that day.{Control>}{Enter}{/Control}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await heading(9104);
    expect(router.state.location.pathname).toBe('/approvals/appr-9104');
    expect(references()).not.toContain('MVL-2026-9116');
    expect(references()).not.toContain('MVL-2026-9106');
  });

  it('does not treat Enter as confirm inside the text box, so a reason can have line breaks', async () => {
    await openQueue();
    await openRequest(9116);
    await userEvent.keyboard('r');
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.keyboard('One.{Enter}Two.');
    expect(within(dialog).getByLabelText(/^Reason for the applicant/)).toHaveValue('One.\nTwo.');
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });

  it('focuses the search with / and does not fire shortcuts while typing in it', async () => {
    const { router } = await openQueue();
    await heading(9101);
    await userEvent.keyboard('/');
    const search = screen.getByLabelText('Search the queue');
    expect(search).toHaveFocus();

    await userEvent.keyboard('jka?');
    expect(search).toHaveValue('jka?');
    expect(router.state.location.pathname).toBe('/approvals/appr-9101');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('does not fire shortcuts from the reason box or while a dialog is open', async () => {
    const { router } = await openQueue();
    await openRequest(9116);
    await userEvent.keyboard('r');
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('jak');
    expect(router.state.location.pathname).toBe('/approvals/appr-9116');
    expect(screen.getByLabelText(/^Reason for the applicant/)).toHaveValue('jak');
  });

  it('opens a shortcut reference with ?, listing what is bound', async () => {
    await openQueue();
    await heading(9101);
    await userEvent.keyboard('?');
    const help = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(help).getByText('Approve the selected request')).toBeVisible();
    expect(within(help).getByText('Reject the selected request')).toBeVisible();
    expect(within(help).getByText('Next request')).toBeVisible();
    expect(within(help).getByText('Search the queue')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('has a visible way to the shortcut reference, for people who do not know to press ?', async () => {
    await openQueue();
    await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  });
});

describe('the navigation badge', () => {
  const badge = () =>
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
      name: /^Approvals/,
    });

  it('shows how many requests are waiting, in words as well as a number', async () => {
    await openQueue();
    await waitFor(() => expect(badge()).toHaveAccessibleName('Approvals, 12 waiting'));
    expect(badge()).toHaveTextContent('Approvals12');
  });

  it('shows nothing while nothing is waiting', async () => {
    clerkState.getToken.mockImplementation(async () => 'user:approver-empty');
    renderApp('/approvals');
    await screen.findByText('Nothing is waiting for a decision');
    expect(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'Approvals',
      }),
    ).toBeVisible();
  });

  it('refreshes when the window regains focus, and is not polled', async () => {
    await openQueue();
    await waitFor(() => expect(badge()).toHaveAccessibleName('Approvals, 12 waiting'));

    // Somebody else decides one while this tab sits in the background.
    await createApiClient({
      baseUrl: TEST_API_BASE_URL,
      getToken: async () => null,
    }).post('/bookings/appr-9116/reject', { body: { reason: 'No.' } });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(badge()).toHaveAccessibleName('Approvals, 12 waiting');

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(badge()).toHaveAccessibleName('Approvals, 11 waiting'));
  });

  it('lets a system administrator in, seeing every facility', async () => {
    mockMeRole(ROLES.systemAdmin);
    clerkState.getToken.mockImplementation(async () => 'user:mock-sysadmin');
    renderApp('/approvals');
    await screen.findByRole('list', { name: 'Approval queue' });
    await waitFor(() => expect(waitingCount()).toHaveTextContent('14 waiting'));
    expect(references()).toContain('MVL-2026-9112');
  });

  it('keeps applicants out', async () => {
    mockMeRole(ROLES.applicant);
    renderApp('/approvals');
    expect(await screen.findByText(/don.t have access|not allowed|permission/i)).toBeVisible();
  });
});

describe('on a phone', () => {
  beforeEach(() => setViewportWidth(MOBILE_WIDTH));

  it('shows the queue alone, then the request alone, with a way back that keeps the view', async () => {
    const { router } = await openQueue('/approvals?q=maria');
    await waitFor(() => expect(references()).toEqual(['MVL-2026-9105', 'MVL-2026-9115']));
    expect(screen.queryByRole('region', { name: 'Selected request' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/approvals');

    await userEvent.click(row(9105));
    await heading(9105);
    expect(screen.queryByRole('list', { name: 'Approval queue' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Back to the queue' }));
    await screen.findByRole('list', { name: 'Approval queue' });
    expect(router.state.location.search).toBe('?q=maria');
  });
});
