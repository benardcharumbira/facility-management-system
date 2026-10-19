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

export const HOLD_HOURS = 72;

export const bookingStore = {
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
  holds(excludeId?: string): LedgerBooking[] {
    return [...entries.values()]
      .map((e) => e.booking)
      .filter((b) => b.id !== excludeId)
      .flatMap((b): LedgerBooking[] => {
        const base = {
          id: b.id,
          facilityId: b.facilityId,
          startsAt: DateTime.fromISO(b.startsAt, { zone: 'utc' }),
          endsAt: DateTime.fromISO(b.endsAt, { zone: 'utc' }),
          setupMinutes: 0,
          teardownMinutes: 0,
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
  counter = 0;
}
