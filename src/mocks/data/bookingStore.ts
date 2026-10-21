import { DateTime } from 'luxon';
import type { Booking } from '@/shared/api';
import type { LedgerBooking } from './bookingLedger';

/** What is stored: everything but `actions`, which depend on "now" and are computed per response. */
export type StoredBooking = Omit<Booking, 'actions'>;

interface Entry {
  booking: StoredBooking;
  ownerId: string;
}

/** The applicant the mock signs in as, unless a token of the form `user:<id>` says otherwise. */
export const MOCK_USER_ID = 'mock-user-1';

/** In-memory bookings for the mock API. Lost on reload, like any mock. */
const entries = new Map<string, Entry>();
let counter = 0;

/** What an approver decided, kept beside the booking because the booking itself must not leak it. */
export interface StoredDecision {
  /** The work item's id: a booking id, or a reschedule request id. */
  workItemId: string;
  type: 'booking_request' | 'reschedule_request';
  bookingId: string;
  outcome: 'approved' | 'rejected';
  decidedBy: string;
  decidedAt: string;
  internalNote: string | null;
  reason: string | null;
  /** For a reschedule: what was asked, since the booking no longer carries it. */
  reschedule?: {
    proposedStartsAt: string;
    proposedEndsAt: string;
    requestedAt: string;
    previousStartsAt: string;
    previousEndsAt: string;
  };
}

const decisions = new Map<string, StoredDecision>();
/** Work items another approver "gets to first": the first decision attempt on one loses the race. */
const contested = new Set<string>();

/** Who the applicants are. The booking carries only an owner id. */
const APPLICANT_NAMES: Record<string, string> = {
  [MOCK_USER_ID]: 'Mock User',
};
export const registerApplicant = (ownerId: string, name: string) => {
  APPLICANT_NAMES[ownerId] = name;
};
export const applicantName = (ownerId: string) => APPLICANT_NAMES[ownerId] ?? 'An applicant';

export const HOLD_HOURS = 72;

export const bookingStore = {
  /** Every booking with its owner. For the back office, which sees across applicants. */
  all: (): Array<{ booking: StoredBooking; ownerId: string }> =>
    [...entries.values()].map((e) => ({ booking: e.booking, ownerId: e.ownerId })),
  decisions: (): StoredDecision[] => [...decisions.values()],
  decisionFor: (workItemId: string): StoredDecision | undefined => decisions.get(workItemId),
  recordDecision: (decision: StoredDecision) => decisions.set(decision.workItemId, decision),
  contest: (workItemId: string) => contested.add(workItemId),
  isContested: (workItemId: string) => contested.has(workItemId),
  uncontest: (workItemId: string) => contested.delete(workItemId),
  ownedBy: (ownerId: string): StoredBooking[] =>
    [...entries.values()].filter((e) => e.ownerId === ownerId).map((e) => e.booking),
  /** The booking if, and only if, it belongs to the caller. Anyone else's looks like no booking. */
  get: (id: string, ownerId: string): StoredBooking | undefined => {
    const entry = entries.get(id);
    return entry && entry.ownerId === ownerId ? entry.booking : undefined;
  },
  set: (booking: StoredBooking, ownerId: string) => {
    entries.set(booking.id, { booking, ownerId });
  },
  update: (booking: StoredBooking) => {
    const entry = entries.get(booking.id);
    if (entry) entries.set(booking.id, { ...entry, booking });
  },
  remove: (id: string) => entries.delete(id),
  nextSequence: () => {
    counter += 1;
    return counter;
  },
  /**
   * Time that is taken: approved bookings, and pending requests until their hold lapses. The
   * availability calendar shows these. `excludeId` leaves one booking out, for checking a move.
   */
  holds(
    excludeId?: string,
    bufferOf?: (facilityId: string) => { setup: number; teardown: number },
  ): LedgerBooking[] {
    return [...entries.values()]
      .map((e) => e.booking)
      .filter((b) => b.id !== excludeId)
      .flatMap((b): LedgerBooking[] => {
        const base = {
          id: b.id,
          facilityId: b.facilityId,
          startsAt: DateTime.fromISO(b.startsAt, { zone: 'utc' }),
          endsAt: DateTime.fromISO(b.endsAt, { zone: 'utc' }),
          setupMinutes: bufferOf?.(b.facilityId).setup ?? 0,
          teardownMinutes: bufferOf?.(b.facilityId).teardown ?? 0,
        };
        if (b.status === 'approved') {
          return [{ ...base, status: 'approved', holdExpiresAt: null }];
        }
        if (b.status === 'pending' && b.holdExpiresAt) {
          return [
            {
              ...base,
              status: 'pending',
              holdExpiresAt: DateTime.fromISO(b.holdExpiresAt, { zone: 'utc' }),
            },
          ];
        }
        return [];
      });
  },
};

export function resetBookingStore() {
  entries.clear();
  decisions.clear();
  contested.clear();
  counter = 0;
}
