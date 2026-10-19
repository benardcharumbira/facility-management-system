import type { Booking } from '@/shared/api';
import type { LedgerBooking } from './bookingLedger';
import { DateTime } from 'luxon';

/** In-memory bookings for the mock API. Lost on reload, like any mock. */
const bookings = new Map<string, Booking>();
let counter = 0;

export const HOLD_HOURS = 72;

export const bookingStore = {
  all: () => [...bookings.values()],
  get: (id: string) => bookings.get(id),
  set: (booking: Booking) => bookings.set(booking.id, booking),
  nextSequence: () => {
    counter += 1;
    return counter;
  },
  /** Submitted requests hold their slot, so the availability calendar shows them as held. */
  holds(): LedgerBooking[] {
    return [...bookings.values()]
      .filter((b) => b.status === 'pending' && b.submittedAt !== null)
      .map((b) => ({
        id: b.id,
        facilityId: b.facilityId,
        startsAt: DateTime.fromISO(b.startsAt, { zone: 'utc' }),
        endsAt: DateTime.fromISO(b.endsAt, { zone: 'utc' }),
        status: 'pending' as const,
        holdExpiresAt: DateTime.fromISO(b.submittedAt ?? '', { zone: 'utc' }).plus({
          hours: HOLD_HOURS,
        }),
        setupMinutes: 0,
        teardownMinutes: 0,
      }));
  },
};

export function resetBookingStore() {
  bookings.clear();
  counter = 0;
}
