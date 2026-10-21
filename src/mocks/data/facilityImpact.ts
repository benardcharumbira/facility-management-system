/**
 * What a proposed change to a facility would touch among the bookings that already exist. The
 * server side behaviour the real impact endpoint must reproduce. It decides nothing, cancels
 * nothing and tells nobody; it only names what the change reaches.
 *
 * Considered: approved and pending bookings that have not yet ended.
 */
import { DateTime } from 'luxon';
import type {
  FacilityCapacity,
  FacilitySchedule,
  ImpactedBooking,
  ImpactReason,
  ImpactResult,
  OperatingDay,
  ProposedChange,
} from '@/shared/api';
import { FACILITY_TIME_ZONE } from './bookingLedger';
import { applicantName, type StoredBooking } from './bookingStore';
import { facilityStore } from './facilityStore';

interface Live {
  booking: StoredBooking;
  ownerId: string;
}

interface Buffers {
  setup: number;
  teardown: number;
}

/** Maps a facility to its parent, so a proposed change can be tried against a changed hierarchy. */
type ParentOf = (facilityId: string) => string | null;

const iso = (value: string) => DateTime.fromISO(value, { zone: 'utc' });

function toImpacted(
  live: Live,
  reason: ImpactReason,
  conflictsWith: Live | null = null,
): ImpactedBooking {
  const { booking } = live;
  return {
    bookingId: booking.id,
    reference: booking.reference,
    applicantName: applicantName(live.ownerId),
    facility: {
      id: booking.facility.id,
      name: booking.facility.name,
      timeZone: booking.facility.timeZone,
    },
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    status: booking.status,
    reason,
    conflictsWith: conflictsWith
      ? {
          bookingId: conflictsWith.booking.id,
          reference: conflictsWith.booking.reference,
          facility: {
            id: conflictsWith.booking.facility.id,
            name: conflictsWith.booking.facility.name,
          },
        }
      : null,
  };
}

// --- hours --------------------------------------------------------------------------------------

const minutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Whether a booking sits inside the operating hours, day by day, in the facility's zone. */
export function withinHours(days: OperatingDay[], startsAt: string, endsAt: string): boolean {
  const start = iso(startsAt).setZone(FACILITY_TIME_ZONE);
  const end = iso(endsAt).setZone(FACILITY_TIME_ZONE);
  for (let day = start.startOf('day'); day < end; day = day.plus({ days: 1 })) {
    const hours = days.find((d) => d.dayOfWeek === day.weekday);
    if (!hours?.opensAt || !hours.closesAt) return false;
    const from = DateTime.max(start, day);
    const to = DateTime.min(end, day.plus({ days: 1 }));
    const fromMinutes = from.diff(day, 'minutes').minutes;
    const toMinutes = to.diff(day, 'minutes').minutes;
    if (fromMinutes < minutes(hours.opensAt) || toMinutes > minutes(hours.closesAt)) return false;
  }
  return true;
}

// --- conflicts ----------------------------------------------------------------------------------

function sharesSpace(a: string, b: string, parentOf: ParentOf): boolean {
  if (a === b) return true;
  const containing = (id: string) => {
    const chain: string[] = [];
    for (let up = parentOf(id); up && !chain.includes(up); up = parentOf(up)) chain.push(up);
    return chain;
  };
  return containing(a).includes(b) || containing(b).includes(a);
}

interface Span {
  start: number;
  end: number;
}
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;
const rawSpan = (b: StoredBooking): Span => ({
  start: iso(b.startsAt).toMillis(),
  end: iso(b.endsAt).toMillis(),
});
const expanded = (b: StoredBooking, buffers: Buffers): Span => {
  const raw = rawSpan(b);
  return { start: raw.start - buffers.setup * 60_000, end: raw.end + buffers.teardown * 60_000 };
};

/**
 * Two bookings clash when one's time overlaps the other's time plus its set-up and clear-down, in
 * the same facility or in facilities that share a building.
 */
function clash(a: Live, b: Live, parentOf: ParentOf, bufferOf: (id: string) => Buffers): boolean {
  if (!sharesSpace(a.booking.facilityId, b.booking.facilityId, parentOf)) return false;
  return (
    overlaps(rawSpan(a.booking), expanded(b.booking, bufferOf(b.booking.facilityId))) ||
    overlaps(rawSpan(b.booking), expanded(a.booking, bufferOf(a.booking.facilityId)))
  );
}

const submittedOrder = (a: Live, b: Live) =>
  (a.booking.submittedAt ?? a.booking.startsAt).localeCompare(
    b.booking.submittedAt ?? b.booking.startsAt,
  ) || a.booking.id.localeCompare(b.booking.id);

/**
 * Clashes that exist under the proposed arrangement and did not before. The later booking of each
 * pair is the one named as affected: the earlier one was there first.
 */
function newConflicts(
  live: Live[],
  before: { parentOf: ParentOf; bufferOf: (id: string) => Buffers },
  after: { parentOf: ParentOf; bufferOf: (id: string) => Buffers },
): ImpactedBooking[] {
  const found = new Map<string, ImpactedBooking>();
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (!a || !b) continue;
      if (clash(a, b, before.parentOf, before.bufferOf)) continue;
      if (!clash(a, b, after.parentOf, after.bufferOf)) continue;
      const [earlier, later] = submittedOrder(a, b) <= 0 ? [a, b] : [b, a];
      if (!found.has(later.booking.id)) {
        found.set(later.booking.id, toImpacted(later, 'new_conflict', earlier));
      }
    }
  }
  return [...found.values()];
}

// --- capacity -----------------------------------------------------------------------------------

function limitFor(capacity: FacilityCapacity, arrangement: string | null): number | null {
  const row = arrangement
    ? capacity.byArrangement.find((c) => c.arrangement.toLowerCase() === arrangement.toLowerCase())
    : undefined;
  return row ? row.capacity : capacity.maximum;
}

// --- the check ----------------------------------------------------------------------------------

export function computeImpact(
  facilityId: string,
  change: ProposedChange,
  now: DateTime,
  arrangementName: (id: string | null) => string | null,
): ImpactResult {
  const facility = facilityStore.get(facilityId);
  const live: Live[] = facilityStore.liveBookings(now);
  const here = live.filter((l) => l.booking.facilityId === facilityId);
  const affected: ImpactedBooking[] = [];

  const currentParent: ParentOf = (id) => facilityStore.get(id)?.parentId ?? null;
  const currentBuffers = (id: string): Buffers => {
    const f = facilityStore.get(id);
    return { setup: f?.schedule.setupMinutes ?? 0, teardown: f?.schedule.teardownMinutes ?? 0 };
  };

  switch (change.kind) {
    case 'details':
      break;

    case 'status':
      if (change.status === 'unavailable' && facility?.status !== 'unavailable') {
        affected.push(...here.map((l) => toImpacted(l, 'facility_unavailable')));
      }
      break;

    case 'archive':
      affected.push(...here.map((l) => toImpacted(l, 'facility_unavailable')));
      break;

    case 'blackout': {
      const range: Span = {
        start: iso(change.blackout.startsAt).toMillis(),
        end: iso(change.blackout.endsAt).toMillis(),
      };
      // A blackout on a facility applies to everything inside it.
      const covered = new Set([
        facilityId,
        ...facilityStore.descendantsOf(facilityId).map((f) => f.id),
      ]);
      affected.push(
        ...live
          .filter((l) => covered.has(l.booking.facilityId) && overlaps(rawSpan(l.booking), range))
          .map((l) => toImpacted(l, 'inside_blackout')),
      );
      break;
    }

    case 'schedule': {
      const next: FacilitySchedule = change.schedule;
      const outside = here.filter(
        (l) =>
          facility &&
          withinHours(facility.schedule.days, l.booking.startsAt, l.booking.endsAt) &&
          !withinHours(next.days, l.booking.startsAt, l.booking.endsAt),
      );
      affected.push(...outside.map((l) => toImpacted(l, 'outside_operating_hours')));
      const withBuffers = (id: string): Buffers =>
        id === facilityId
          ? { setup: next.setupMinutes, teardown: next.teardownMinutes }
          : currentBuffers(id);
      for (const item of newConflicts(
        live,
        { parentOf: currentParent, bufferOf: currentBuffers },
        { parentOf: currentParent, bufferOf: withBuffers },
      )) {
        if (!affected.some((a) => a.bookingId === item.bookingId)) affected.push(item);
      }
      break;
    }

    case 'hierarchy': {
      const moved: ParentOf = (id) =>
        id === facilityId ? change.parentFacilityId : currentParent(id);
      affected.push(
        ...newConflicts(
          live,
          { parentOf: currentParent, bufferOf: currentBuffers },
          { parentOf: moved, bufferOf: currentBuffers },
        ),
      );
      break;
    }

    case 'capacity': {
      if (!facility) break;
      for (const l of here) {
        const arrangement = arrangementName(l.booking.seatingArrangementId);
        const attendees = l.booking.attendeeCount;
        if (attendees === null) continue;
        const before = limitFor(facility.capacity, arrangement);
        const after = limitFor(change.capacity, arrangement);
        const wasOver = before !== null && attendees > before;
        const nowOver = after !== null && attendees > after;
        if (nowOver && !wasOver) affected.push(toImpacted(l, 'over_capacity'));
      }
      break;
    }
  }

  affected.sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.reference.localeCompare(b.reference),
  );
  return { affectedBookings: affected, totalAffected: affected.length };
}
