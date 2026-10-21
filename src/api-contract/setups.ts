/**
 * Brings the mock to a state worth showing: the cases the contract has to make clear because they
 * are awkward, such as a fortnight that contains every kind of unavailable time.
 */
import { DateTime } from 'luxon';
import { bookingStore, type StoredBooking } from '@/mocks/data/bookingStore';

export interface CallInit {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  as?: string;
  rawBody?: string;
  contentType?: string;
}
export interface CallResult {
  status: number;
  contentType: string;
  body: unknown;
}
export type Caller = (init: CallInit) => Promise<CallResult>;

const FACILITY_ADMIN = 'mock-approver-1';
const ZONE = 'Africa/Johannesburg';
const at = (date: string, time: string) =>
  DateTime.fromISO(`${date}T${time}`, { zone: ZONE })
    .toUTC()
    .toISO({ suppressMilliseconds: true }) as string;

async function must(call: Caller, init: CallInit, status: number): Promise<unknown> {
  const result = await call(init);
  if (result.status !== status) {
    throw new Error(
      `Setup ${init.method} ${init.path}: expected ${status}, got ${result.status}: ${JSON.stringify(result.body).slice(0, 300)}`,
    );
  }
  return result.body;
}

const FILLED = {
  eventTypeId: 'wedding',
  description: 'A wedding reception with a sit-down lunch.',
  attendeeCount: 80,
  seatingArrangementId: 'banquet',
  resources: [{ resourceId: 'chairs', quantity: 80 }],
  acceptedTermsVersion: '2026-1',
};

/** An approved booking placed straight into the store, as an earlier decision would have left it. */
function approvedBooking(
  id: string,
  facilityId: string,
  name: string,
  startsAt: string,
  endsAt: string,
  owner = 'applicant-001',
) {
  const booking: StoredBooking = {
    id,
    reference: `MVL-2026-${id.slice(-4).padStart(5, '0')}`,
    status: 'approved',
    facilityId,
    startsAt,
    endsAt,
    eventTypeId: 'meeting',
    description: 'A committee meeting',
    attendeeCount: 20,
    seatingArrangementId: 'boardroom',
    resources: [],
    acceptedTermsVersion: '2026-1',
    facility: { id: facilityId, name, timeZone: ZONE },
    documents: [],
    updatedAt: '2026-10-20T08:00:00Z',
    submittedAt: '2026-10-19T08:00:00Z',
    holdExpiresAt: null,
    decidedAt: '2026-10-20T08:00:00Z',
    rejectionReason: null,
    cancellation: null,
    history: [],
    rescheduleRequest: null,
  };
  bookingStore.set(booking, owner);
}

export const SETUPS: Record<string, (call: Caller) => Promise<Record<string, string>>> = {
  /**
   * Loch Wing over a fortnight: held (a pending request), booked (an approved one), buffer (around
   * both), blocked by a related facility (City Hall is booked on the Friday), part of a day closed,
   * and a whole day closed.
   */
  async allSegmentStatuses(call) {
    const hours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i + 1,
      opensAt: '07:00',
      closesAt: '23:00',
    }));
    await must(
      call,
      {
        method: 'put',
        path: '/admin/facilities/loch-wing/schedule',
        as: FACILITY_ADMIN,
        body: {
          days: hours,
          setupMinutes: 30,
          teardownMinutes: 30,
          minimumNoticeHours: 48,
          maximumHorizonDays: 90,
          maximumBookingDays: 7,
        },
      },
      200,
    );
    approvedBooking(
      'bk-ex-0001',
      'loch-wing',
      'Loch Wing',
      at('2026-11-17', '11:00'),
      at('2026-11-17', '13:00'),
    );
    await must(
      call,
      {
        method: 'post',
        path: '/admin/facilities/loch-wing/blackouts',
        as: FACILITY_ADMIN,
        body: {
          startsAt: at('2026-11-12', '15:00'),
          endsAt: at('2026-11-12', '17:00'),
          allDay: false,
          reason: 'Water supply cut',
        },
      },
      201,
    );
    await must(
      call,
      {
        method: 'post',
        path: '/admin/facilities/loch-wing/blackouts',
        as: FACILITY_ADMIN,
        body: {
          startsAt: at('2026-11-22', '00:00'),
          endsAt: at('2026-11-23', '00:00'),
          allDay: true,
          reason: 'Civic function',
        },
      },
      201,
    );
    return {};
  },

  /** A draft that looks free when saved, but whose Friday is taken by City Hall: a span in a wing. */
  async conflictingDraft(call) {
    const draft = (await must(
      call,
      {
        method: 'post',
        path: '/bookings',
        body: {
          facilityId: 'mitchell-wing',
          startsAt: at('2026-11-19', '16:00'),
          endsAt: at('2026-11-21', '12:00'),
        },
      },
      201,
    )) as { id: string };
    await must(call, { method: 'patch', path: `/bookings/${draft.id}`, body: FILLED }, 200);
    return { conflictDraftId: draft.id };
  },

  /** A draft with only its window: nothing else filled in. */
  async emptyDraft(call) {
    const draft = (await must(
      call,
      {
        method: 'post',
        path: '/bookings',
        body: {
          facilityId: 'lakeside-hall',
          startsAt: at('2026-11-24', '09:00'),
          endsAt: at('2026-11-24', '12:00'),
        },
      },
      201,
    )) as { id: string };
    return { emptyDraftId: draft.id };
  },

  /** An approved booking of the default applicant, far enough ahead to be moved. */
  async approvedBooking() {
    approvedBooking(
      'bk-ex-0002',
      'lakeside-hall',
      'Lakeside Hall',
      at('2026-12-08', '09:00'),
      at('2026-12-08', '12:00'),
      'mock-user-1',
    );
    return { approvedBookingId: 'bk-ex-0002' };
  },

  /** The id of a document on a seeded booking. */
  async seedDocument(call) {
    const booking = (await must(call, { method: 'get', path: '/bookings/seed-approved' }, 200)) as {
      documents: Array<{ id: string }>;
    };
    const first = booking.documents[0];
    if (!first) throw new Error('The seeded approved booking has no document.');
    return { seedDocumentId: first.id };
  },
};
