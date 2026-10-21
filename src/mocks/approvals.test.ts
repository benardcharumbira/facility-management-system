import { beforeEach, describe, expect, it } from 'vitest';
import { sendsInvalidRequests } from '@/test/contract';
import {
  ACTION_NOT_ALLOWED_PROBLEM_TYPE,
  ALREADY_DECIDED_PROBLEM_TYPE,
  createApiClient,
  isApiProblem,
  type ApiProblem,
  type ApprovalCounts,
  type ApprovalDetail,
  type ApprovalListItem,
  type Booking,
} from '@/shared/api';
import type { Paginated } from '@/shared/types/pagination';
import { FIXED_NOW } from '@/test/clock';
import { seedApprovals } from './data/approvalSeeds';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
/** The default mock approver: City Hall and its spaces, Rothdene Hall and Lakeside Hall. */
const approver = as(null);

beforeEach(() => seedApprovals(FIXED_NOW));

const queue = (query: Record<string, string | string[]> = {}, client = approver) =>
  client.get<Paginated<ApprovalListItem>>('/approvals', { query });
const ids = (page: Paginated<ApprovalListItem>) => page.items.map((i) => i.id);
const detail = (id: string, client = approver) => client.get<ApprovalDetail>(`/approvals/${id}`);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => {
      if (!isApiProblem(error)) throw error;
      return error as ApiProblem;
    },
  );
const approve = (id: string, note?: string, client = approver) =>
  client.post<ApprovalDetail>(`/bookings/${id}/approve`, { body: { note } });
const reject = (id: string, reason: string, client = approver) =>
  client.post<ApprovalDetail>(`/bookings/${id}/reject`, { body: { reason } });

describe('GET /approvals', () => {
  it('lists pending items only, longest waiting first, for the approver’s facilities', async () => {
    const page = await queue();
    expect(page.totalItems).toBe(12);
    expect(ids(page)).toEqual([
      'appr-9101',
      'rs-appr-9109',
      'appr-9110',
      'appr-9102',
      'appr-9116',
      'appr-9106',
      'appr-9104',
      'appr-9103',
      'appr-9105',
      'rs-appr-9108',
      'appr-9107',
      'appr-9115',
    ]);
    expect(page.items.every((i) => i.status === 'pending')).toBe(true);
  });

  it('never shows facilities the approver is not designated against', async () => {
    const facilities = new Set(
      (await queue({ status: ['pending', 'approved', 'rejected'] })).items.map(
        (i) => i.facility.id,
      ),
    );
    expect(facilities).not.toContain('vaal-marina-hall');
    expect(facilities).not.toContain('activity-room');
  });

  it('scopes by identity: another approver sees their own, a system administrator sees all', async () => {
    expect(ids(await queue({}, as('user:approver-vaal')))).toEqual(['appr-9112']);
    expect((await queue({}, as('user:mock-sysadmin'))).totalItems).toBe(14);
    expect((await queue({}, as('user:approver-empty'))).totalItems).toBe(0);
    // Not designated against anything, so sees nothing.
    expect((await queue({}, as('user:nobody'))).totalItems).toBe(0);
  });

  it('cannot be widened with a parameter', async () => {
    const page = await queue({ facilityId: ['vaal-marina-hall'] });
    expect(page.totalItems).toBe(0);
  });

  it('separates the two kinds of work and lets decided items be reviewed', async () => {
    expect(ids(await queue({ type: 'reschedule_request' }))).toEqual([
      'rs-appr-9109',
      'rs-appr-9108',
    ]);
    const decided = await queue({ status: ['approved', 'rejected'], type: 'booking_request' });
    expect(ids(decided)).toEqual(
      expect.arrayContaining(['appr-9108', 'appr-9109', 'appr-9111', 'appr-9114', 'appr-9117']),
    );
    expect(decided.items.every((i) => i.status !== 'pending')).toBe(true);
  });

  it('searches reference and applicant name, and sorts by event date or facility', async () => {
    expect(ids(await queue({ q: 'johan' }))).toEqual(['appr-9102']);
    expect(ids(await queue({ q: '9105' }))).toEqual(['appr-9105']);
    const byDate = await queue({ sort: 'eventDate' });
    expect(byDate.items[0]?.id).toBe('appr-9107');
    const byFacility = (await queue({ sort: 'facility' })).items.map((i) => i.facility.name);
    expect(byFacility).toEqual([...byFacility].sort((a, b) => a.localeCompare(b)));
  });

  it('marks items with competition, and what cannot be approved', async () => {
    const page = await queue();
    const by = Object.fromEntries(page.items.map((i) => [i.id, i]));
    expect(by['appr-9101']?.competingCount).toBe(2);
    expect(by['appr-9102']?.competingCount).toBe(1);
    expect(by['appr-9104']?.competingCount).toBe(1);
    expect(by['appr-9116']?.competingCount).toBe(0);
    expect(by['appr-9110']?.approvable).toBe(false);
    expect(by['appr-9101']?.approvable).toBe(true);
  });
});

describe('GET /approvals/counts', () => {
  it('counts what is pending for the caller, by kind and by facility', async () => {
    const counts = await approver.get<ApprovalCounts>('/approvals/counts');
    expect(counts).toMatchObject({ pending: 12, bookingRequests: 10, rescheduleRequests: 2 });
    expect(counts.facilities.find((f) => f.id === 'city-hall')?.pending).toBe(1);
    expect(counts.facilities.find((f) => f.id === 'rothdene-hall')?.pending).toBe(4);
    expect(counts.facilities.map((f) => f.id)).not.toContain('vaal-marina-hall');
    expect((await as('user:approver-empty').get<ApprovalCounts>('/approvals/counts')).pending).toBe(
      0,
    );
  });
});

describe('competition', () => {
  it('names a request for the same venue and time, with its reference and applicant', async () => {
    const { context } = await detail('appr-9104');
    expect(context.competingRequests).toHaveLength(1);
    expect(context.competingRequests[0]).toMatchObject({
      workItemId: 'appr-9105',
      reference: 'MVL-2026-9105',
      applicantName: 'Maria van der Merwe',
      relationship: 'same_facility',
      facility: { id: 'rothdene-hall' },
      inYourQueue: true,
    });
    expect(context.competingRequests[0]?.overlap).toEqual({
      startsAt: expect.any(String),
      endsAt: expect.any(String),
    });
  });

  it('shows a parent and a child each other, with the relationship from the viewer’s side', async () => {
    const wing = await detail('appr-9102');
    expect(wing.context.competingRequests).toMatchObject([
      { reference: 'MVL-2026-9101', relationship: 'parent', facility: { name: 'City Hall' } },
    ]);

    const hall = await detail('appr-9101');
    expect(hall.context.competingRequests).toMatchObject([
      { reference: 'MVL-2026-9102', relationship: 'child', facility: { name: 'Mitchell Wing' } },
      { reference: 'MVL-2026-9103', relationship: 'child', facility: { name: 'Loch Wing' } },
    ]);
  });

  it('does not make two wings of the same building compete', async () => {
    const mitchell = await detail('appr-9102');
    expect(mitchell.context.competingRequests.map((c) => c.reference)).not.toContain(
      'MVL-2026-9103',
    );
  });

  it('says in data what approving takes with it, so the screen never walks the hierarchy', async () => {
    const hall = await detail('appr-9101');
    expect(hall.context.affectedFacilities).toEqual(
      expect.arrayContaining([
        { id: 'mitchell-wing', name: 'Mitchell Wing', relationship: 'child' },
        { id: 'loch-wing', name: 'Loch Wing', relationship: 'child' },
        { id: 'city-hall-committee-room', name: 'City Hall Committee Room', relationship: 'child' },
      ]),
    );
    const wing = await detail('appr-9102');
    expect(wing.context.affectedFacilities).toEqual([
      { id: 'city-hall', name: 'City Hall', relationship: 'parent' },
    ]);
  });

  it('leaves rivals pending but impossible to approve once one is approved, and they can still be rejected', async () => {
    await approve('appr-9101');

    const wing = await detail('appr-9102');
    expect(wing.status).toBe('pending');
    expect(wing.actions.approve.allowed).toBe(false);
    expect(wing.actions.approve.blockedReason).toMatch(/MVL-2026-9101.*already been approved/);
    expect(wing.actions.reject.allowed).toBe(true);
    expect(wing.context.blockedBy).toMatchObject([
      { reference: 'MVL-2026-9101', relationship: 'parent' },
    ]);

    const failed = await failure(approve('appr-9102'));
    expect(failed.status).toBe(409);
    expect(failed.type).toBe(ACTION_NOT_ALLOWED_PROBLEM_TYPE);

    const rejected = await reject('appr-9102', 'City Hall is taken that day.');
    expect(rejected.status).toBe('rejected');
  });

  it('reports a pending booking whose time an approved one already holds', async () => {
    const stuck = await detail('appr-9110');
    expect(stuck.actions.approve.allowed).toBe(false);
    expect(stuck.context.blockedBy).toMatchObject([
      { reference: 'MVL-2026-9111', relationship: 'parent' },
    ]);
  });

  it('counts a reschedule request’s proposed window, not its current one', async () => {
    const move = await detail('rs-appr-9108');
    expect(move.type).toBe('reschedule_request');
    expect(move.currentWindow).not.toBeNull();
    expect(move.startsAt).not.toBe(move.currentWindow?.startsAt);
    expect(move.context.competingRequests).toEqual([]);
  });
});

describe('decisions', () => {
  it('approves, keeps the internal note internal, and tells the applicant only that it is approved', async () => {
    const decided = await approve('appr-9116', 'Checked the roster; the caretaker is free.');
    expect(decided).toMatchObject({
      status: 'approved',
      decision: {
        outcome: 'approved',
        decidedBy: 'Nomsa Dlamini',
        internalNote: 'Checked the roster; the caretaker is free.',
      },
    });

    const theirs = await as('user:applicant-lerato').get<Booking>('/bookings/appr-9116');
    expect(theirs.status).toBe('approved');
    expect(JSON.stringify(theirs)).not.toContain('caretaker');
  });

  it('refuses to reject without a reason', async () => {
    sendsInvalidRequests();
    for (const reason of ['', '   \n  ']) {
      const failed = await failure(reject('appr-9116', reason));
      expect(failed.status).toBe(422);
      expect(failed.errors.reason?.[0]).toMatch(/Give a reason/);
    }
    expect((await detail('appr-9116')).status).toBe('pending');
  });

  it('sends a rejection reason to the applicant exactly as written', async () => {
    const reason = '  We cannot offer that date.\n\nTry "Friday" instead — 100% sure.  ';
    await reject('appr-9116', reason);
    const theirs = await as('user:applicant-lerato').get<Booking>('/bookings/appr-9116');
    expect(theirs.status).toBe('rejected');
    expect(theirs.rejectionReason).toBe(reason);
  });

  it('answers 409 with who decided and when when someone got there first', async () => {
    await approve('appr-9105');
    const again = await failure(reject('appr-9105', 'Too late.'));
    expect(again.status).toBe(409);
    expect(again.type).toBe(ALREADY_DECIDED_PROBLEM_TYPE);
    expect(again.extensions.decision).toMatchObject({
      outcome: 'approved',
      decidedBy: 'Nomsa Dlamini',
      decidedAt: expect.any(String),
    });
  });

  it('loses a contested request to the other approver, once', async () => {
    const lost = await failure(approve('appr-9115'));
    expect(lost.status).toBe(409);
    expect(lost.type).toBe(ALREADY_DECIDED_PROBLEM_TYPE);
    expect(lost.extensions.decision).toMatchObject({
      outcome: 'approved',
      decidedBy: 'Pieter van Wyk',
    });
    expect((await detail('appr-9115')).status).toBe('approved');
  });

  it('moves a booking when a change of date is approved, and records it', async () => {
    const before = await detail('rs-appr-9108');
    const decided = await approver.post<ApprovalDetail>(
      '/reschedule-requests/rs-appr-9108/approve',
      { body: {} },
    );
    expect(decided.status).toBe('approved');

    const theirs = await as('user:applicant-ruth').get<Booking>('/bookings/appr-9108');
    expect(theirs.startsAt).toBe(before.startsAt);
    expect(theirs.endsAt).toBe(before.endsAt);
    expect(theirs.rescheduleRequest).toBeNull();
    expect(theirs.history.at(-1)?.type).toBe('reschedule_approved');

    const reviewed = await queue({ status: 'approved', type: 'reschedule_request' });
    expect(ids(reviewed)).toEqual(['rs-appr-9108']);
    expect(reviewed.items[0]?.currentWindow?.startsAt).not.toBe(before.startsAt);
  });

  it('leaves a booking where it is when a change of date is rejected, with the reason', async () => {
    const before = await detail('rs-appr-9109');
    const reason = 'The hall is closed for repairs that week.';
    await approver.post('/reschedule-requests/rs-appr-9109/reject', { body: { reason } });

    const theirs = await as('user:applicant-sipho').get<Booking>('/bookings/appr-9109');
    expect(theirs.status).toBe('approved');
    expect(theirs.startsAt).toBe(before.currentWindow?.startsAt);
    expect(theirs.rescheduleRequest).toBeNull();
    expect(theirs.history.at(-1)).toMatchObject({ type: 'reschedule_declined', note: reason });
  });

  it('needs a reason to reject a change of date too', async () => {
    const failed = await failure(
      approver.post('/reschedule-requests/rs-appr-9109/reject', { body: { reason: ' ' } }),
    );
    expect(failed.status).toBe(422);
  });
});

describe('access', () => {
  it('answers 404 for an item outside the caller’s facilities, and cannot be decided either', async () => {
    expect((await failure(detail('appr-9112'))).status).toBe(404);
    expect((await failure(approve('appr-9112'))).status).toBe(404);
    expect((await failure(reject('appr-9112', 'No'))).status).toBe(404);
    expect((await failure(detail('appr-9112', as('user:approver-empty')))).status).toBe(404);
    expect((await detail('appr-9112', as('user:approver-vaal'))).reference).toBe('MVL-2026-9112');
  });

  it('answers 404 for something that does not exist', async () => {
    expect((await failure(detail('nothing'))).status).toBe(404);
  });

  it('serves the applicant’s documents to an approver who may see the request', async () => {
    const response = await fetch(
      `${TEST_API_BASE_URL}/approvals/appr-9101/documents/doc-1-catering-plan.pdf`,
    );
    expect(response.status).toBe(200);
    const outside = await fetch(`${TEST_API_BASE_URL}/approvals/appr-9112/documents/doc-1-x.pdf`);
    expect(outside.status).toBe(404);
  });
});

describe('decision context', () => {
  it('compares expected attendees with the capacity for the chosen seating arrangement', async () => {
    const hall = await detail('appr-9106');
    expect(hall.context.capacity).toEqual({
      expectedAttendees: 400,
      arrangement: 'Cinema',
      limit: 180,
    });
    expect(hall.context.capacityWarning).toMatch(/400 people are expected.*holds 180/);
    expect((await detail('appr-9116')).context.capacityWarning).toBeNull();
  });

  it('warns when more is asked for than the venue holds', async () => {
    expect((await detail('appr-9106')).context.resourceWarning).toMatch(
      /Chairs: 400 requested, 180 held/,
    );
    expect((await detail('appr-9116')).context.resourceWarning).toBeNull();
  });

  it('counts the applicant’s earlier approved bookings at this facility', async () => {
    expect((await detail('appr-9107')).context.applicantPreviousBookingsAtFacility).toBe(1);
    expect((await detail('appr-9116')).context.applicantPreviousBookingsAtFacility).toBe(0);
  });

  it('supplies the turnaround target, and leaves it null where there is none', async () => {
    expect((await detail('appr-9101')).context.turnaroundTargetHours).toBe(120);
    expect((await detail('appr-9107')).context.turnaroundTargetHours).toBeNull();
  });
});
