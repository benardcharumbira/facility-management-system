/**
 * Fictional booking ledger behind the mock availability endpoint. PROVISIONAL: nothing here is a
 * real booking. It is generated relative to "now" so the calendar always has something to show
 * across the current month and the two after it.
 *
 * Deliberate scenarios (week 0 is the Monday of the current week):
 * - Week 1: a busy week at Vaal Marina Hall; a pending hold on Loch Wing (Wednesday) that expires.
 * - Week 2: City Hall booked all day on the Friday (its three spaces are blocked by it), and
 *   Mitchell Wing booked 10:00 to 15:00 on the Thursday (City Hall is blocked, Loch Wing is not).
 *   Weekdays, because the committee room is only open on weekdays in the provisional hours.
 * - Week 3: completely free for every venue.
 * - Week 4: Rothdene Hall booked on the Saturday with set-up the day before and clear-down the
 *   day after.
 * - Week 5: Vaal Marina Hall closed for maintenance on the Tuesday and Wednesday.
 * - South African public holidays close every venue.
 * Everything else is deterministic pseudo random filler.
 */
import { DateTime } from 'luxon';
import type { FacilitySummary } from '@/shared/api';
import { scheduleFor } from './facilityDetail';

export const FACILITY_TIME_ZONE = 'Africa/Johannesburg';

export interface LedgerBooking {
  id: string;
  facilityId: string;
  startsAt: DateTime;
  endsAt: DateTime;
  status: 'approved' | 'pending';
  /** Pending requests hold the time until this instant, then it is released. */
  holdExpiresAt: DateTime | null;
  setupMinutes: number;
  teardownMinutes: number;
}

export interface Blackout {
  /** Null closes every facility. */
  facilityId: string | null;
  /** Inclusive ISO dates in the facility time zone. */
  from: string;
  to: string;
  reason: string;
}

export interface Ledger {
  bookings: LedgerBooking[];
  blackouts: Blackout[];
}

/** Fixed date South African public holidays. A holiday on a Sunday is observed on the Monday. */
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 3, day: 21, name: 'Human Rights Day' },
  { month: 4, day: 27, name: 'Freedom Day' },
  { month: 5, day: 1, name: "Workers' Day" },
  { month: 6, day: 16, name: 'Youth Day' },
  { month: 8, day: 9, name: "National Women's Day" },
  { month: 9, day: 24, name: 'Heritage Day' },
  { month: 12, day: 16, name: 'Day of Reconciliation' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Day of Goodwill' },
];

export function publicHolidayOn(date: DateTime): string | null {
  for (const holiday of FIXED_HOLIDAYS) {
    const actual = DateTime.fromObject(
      { year: date.year, month: holiday.month, day: holiday.day },
      { zone: FACILITY_TIME_ZONE },
    );
    const observed = actual.weekday === 7 ? actual.plus({ days: 1 }) : actual;
    if (observed.hasSame(date, 'day')) return holiday.name;
  }
  return null;
}

const at = (day: DateTime, time: string): DateTime => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return day.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
};

/** Small deterministic PRNG so the same venue gets the same filler every time. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS: Array<[string, string]> = [
  ['09:00', '13:00'],
  ['13:00', '17:00'],
  ['18:00', '22:00'],
];
const WEEKS = 18;
const FREE_WEEK = 3;
/** Weeks where a scenario owns the venue, so filler does not interfere. */
const RESERVED_WEEKS: Record<string, number[]> = {
  'city-hall': [2],
  'mitchell-wing': [2],
  'loch-wing': [1, 2],
  'city-hall-committee-room': [2],
  'rothdene-hall': [4],
  'vaal-marina-hall': [1],
  'vaal-marina-board-room': [1],
};

export function buildLedger({
  now,
  startedAt,
  catalogue,
}: {
  now: DateTime;
  startedAt: DateTime;
  catalogue: readonly FacilitySummary[];
}): Ledger {
  const today = now.setZone(FACILITY_TIME_ZONE).startOf('day');
  const week0 = today.startOf('week');
  const day = (week: number, weekday: number) => week0.plus({ weeks: week, days: weekday - 1 });
  const has = (id: string) => catalogue.some((f) => f.id === id);

  const bookings: LedgerBooking[] = [];
  let counter = 0;
  const add = (
    facilityId: string,
    date: DateTime,
    from: string,
    to: string,
    extra: Partial<LedgerBooking> = {},
  ) => {
    if (!has(facilityId)) return;
    counter += 1;
    bookings.push({
      id: `booking-${counter}`,
      facilityId,
      startsAt: at(date, from),
      endsAt: at(date, to),
      status: 'approved',
      holdExpiresAt: null,
      setupMinutes: 0,
      teardownMinutes: 0,
      ...extra,
    });
  };

  // Scenarios.
  add('city-hall', day(2, 5), '07:00', '23:00');
  add('mitchell-wing', day(2, 4), '10:00', '15:00');
  add('rothdene-hall', day(4, 6), '10:00', '16:00', {
    setupMinutes: 18 * 60,
    teardownMinutes: 18 * 60,
  });
  add('loch-wing', day(1, 3), '10:00', '14:00', {
    status: 'pending',
    holdExpiresAt: startedAt.plus({ hours: 3 }),
  });
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    add(
      'vaal-marina-hall',
      day(1, weekday),
      weekday % 2 === 0 ? '09:00' : '13:00',
      weekday % 2 === 0 ? '13:00' : '21:00',
      {
        setupMinutes: 30,
        teardownMinutes: 30,
      },
    );
  }

  // Filler.
  for (const facility of catalogue) {
    const rng = seeded(facility.id);
    const hall = ['hall', 'civic-hall', 'hall-wing'].includes(facility.type.id);
    const schedule = scheduleFor(facility);
    const reserved = RESERVED_WEEKS[facility.id] ?? [];
    for (let week = 0; week < WEEKS; week += 1) {
      if (week === FREE_WEEK || reserved.includes(week)) continue;
      const count = rng() < 0.35 ? 0 : rng() < 0.6 ? 1 : 2;
      const used = new Set<number>();
      for (let n = 0; n < count; n += 1) {
        const weekday = 1 + Math.floor(rng() * 7);
        const hours = schedule.find((d) => d.dayOfWeek === weekday);
        if (used.has(weekday) || !hours?.opensAt || !hours.closesAt) continue;
        used.add(weekday);
        const slots = SLOTS.filter(([from, to]) => from >= hours.opensAt! && to <= hours.closesAt!);
        const slot = slots[Math.floor(rng() * slots.length)];
        if (!slot) continue;
        const pending = rng() < 0.15;
        add(facility.id, day(week, weekday), slot[0], slot[1], {
          status: pending ? 'pending' : 'approved',
          holdExpiresAt: pending ? startedAt.plus({ days: 2 }) : null,
          setupMinutes: hall ? 30 : 0,
          teardownMinutes: hall ? 30 : 0,
        });
      }
    }
  }

  const blackouts: Blackout[] = has('vaal-marina-hall')
    ? [
        {
          facilityId: 'vaal-marina-hall',
          from: day(5, 2).toISODate() ?? '',
          to: day(5, 3).toISODate() ?? '',
          reason: 'Maintenance',
        },
      ]
    : [];

  return { bookings, blackouts };
}
