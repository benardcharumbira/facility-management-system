/**
 * The server side behaviour the real availability engine must reproduce: operating hours,
 * closures, booking and buffer expansion, hierarchy resolution, overlap resolution and merging.
 * The client renders the result and does none of this itself.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  AVAILABILITY_MAX_SPAN_DAYS,
  type AvailabilityDay,
  type AvailabilitySegment,
  type AvailabilitySegmentStatus,
  type FacilityAvailability,
  type FacilitySummary,
  type RelatedFacility,
} from '@/shared/api';
import {
  FACILITY_TIME_ZONE,
  buildLedger,
  publicHolidayOn,
  type Ledger,
  type LedgerBooking,
} from './data/bookingLedger';
import { scheduleFor } from './data/facilityDetail';

export const MOCK_AVAILABILITY_RULES = {
  minimumNoticeHours: 48,
  maximumHorizonDays: 90,
  minimumDurationMinutes: 60,
} as const;

/** Higher wins where intervals overlap. */
const PRIORITY: Record<AvailabilitySegmentStatus, number> = {
  booked: 4,
  held: 3,
  blocked_by_related: 2,
  buffer: 1,
};

interface Interval {
  start: number;
  end: number;
  status: AvailabilitySegmentStatus;
  related: RelatedFacility | null;
}

function activeBookings(ledger: Ledger, facilityId: string, now: DateTime) {
  return ledger.bookings.filter(
    (b) =>
      b.facilityId === facilityId &&
      (b.status === 'approved' || (b.holdExpiresAt !== null && b.holdExpiresAt > now)),
  );
}

function ancestorsOf(facility: FacilitySummary, catalogue: readonly FacilitySummary[]) {
  const chain: FacilitySummary[] = [];
  let parentId = facility.parentFacility?.id;
  while (parentId !== undefined) {
    const parent = catalogue.find((f) => f.id === parentId);
    if (!parent || chain.includes(parent)) break;
    chain.push(parent);
    parentId = parent.parentFacility?.id;
  }
  return chain;
}

function intervalsFor(
  facility: FacilitySummary,
  catalogue: readonly FacilitySummary[],
  ledger: Ledger,
  now: DateTime,
): Interval[] {
  const intervals: Interval[] = [];

  for (const b of activeBookings(ledger, facility.id, now)) {
    const start = b.startsAt.toMillis();
    const end = b.endsAt.toMillis();
    intervals.push({
      start,
      end,
      status: b.status === 'approved' ? 'booked' : 'held',
      related: null,
    });
    if (b.setupMinutes > 0) {
      intervals.push({
        start: start - b.setupMinutes * 60_000,
        end: start,
        status: 'buffer',
        related: null,
      });
    }
    if (b.teardownMinutes > 0) {
      intervals.push({
        start: end,
        end: end + b.teardownMinutes * 60_000,
        status: 'buffer',
        related: null,
      });
    }
  }

  // Anything booked in the same building, in either direction, takes this space too, including
  // that booking's set-up and clear-down time.
  const ancestors = ancestorsOf(facility, catalogue);
  const descendants = catalogue.filter((f) =>
    ancestorsOf(f, catalogue).some((a) => a.id === facility.id),
  );
  const related: Array<[FacilitySummary, 'parent' | 'child']> = [
    ...ancestors.map((f) => [f, 'parent'] as [FacilitySummary, 'parent']),
    ...descendants.map((f) => [f, 'child'] as [FacilitySummary, 'child']),
  ];
  for (const [other, relationship] of related) {
    for (const b of activeBookings(ledger, other.id, now)) {
      intervals.push({
        start: b.startsAt.toMillis() - b.setupMinutes * 60_000,
        end: b.endsAt.toMillis() + b.teardownMinutes * 60_000,
        status: 'blocked_by_related',
        related: { id: other.id, name: other.name, relationship },
      });
    }
  }
  return intervals;
}

/** Splits overlaps by priority, then merges abutting pieces of the same status and relation. */
function resolve(intervals: Interval[], windowStart: number, windowEnd: number): Interval[] {
  const clipped = intervals
    .map((i) => ({ ...i, start: Math.max(i.start, windowStart), end: Math.min(i.end, windowEnd) }))
    .filter((i) => i.end > i.start);
  const points = [
    ...new Set([windowStart, windowEnd, ...clipped.flatMap((i) => [i.start, i.end])]),
  ].sort((a, b) => a - b);

  const pieces: Interval[] = [];
  for (let n = 0; n < points.length - 1; n += 1) {
    const start = points[n];
    const end = points[n + 1];
    if (start === undefined || end === undefined) continue;
    const covering = clipped
      .filter((i) => i.start <= start && i.end >= end)
      .sort(
        (a, b) =>
          PRIORITY[b.status] - PRIORITY[a.status] ||
          (a.related?.id ?? '').localeCompare(b.related?.id ?? ''),
      );
    const winner = covering[0];
    if (!winner) continue;
    const previous = pieces[pieces.length - 1];
    if (
      previous &&
      previous.end === start &&
      previous.status === winner.status &&
      previous.related?.id === winner.related?.id
    ) {
      previous.end = end;
    } else {
      pieces.push({ start, end, status: winner.status, related: winner.related });
    }
  }
  return pieces;
}

const iso = (millis: number) =>
  DateTime.fromMillis(millis, { zone: 'utc' }).toISO({ suppressMilliseconds: true }) ?? '';

export function computeAvailability({
  facility,
  catalogue,
  ledger,
  from,
  to,
  now,
}: {
  facility: FacilitySummary;
  catalogue: readonly FacilitySummary[];
  ledger: Ledger;
  from: string;
  to: string;
  now: DateTime;
}): FacilityAvailability {
  const zone = FACILITY_TIME_ZONE;
  const schedule = scheduleFor(facility);
  const intervals = intervalsFor(facility, catalogue, ledger, now);
  const days: AvailabilityDay[] = [];

  const last = DateTime.fromISO(to, { zone });
  for (let day = DateTime.fromISO(from, { zone }); day <= last; day = day.plus({ days: 1 })) {
    const date = day.toISODate() ?? '';
    const hours = schedule.find((d) => d.dayOfWeek === day.weekday);
    const holiday = publicHolidayOn(day);
    const blackout = ledger.blackouts.find(
      (b) =>
        (b.facilityId === null || b.facilityId === facility.id) && b.from <= date && date <= b.to,
    );

    const closedReason = holiday
      ? `Public holiday: ${holiday}`
      : blackout
        ? blackout.reason
        : !hours?.opensAt || !hours.closesAt
          ? `Not open on ${day.setLocale('en').toFormat('cccc')}s`
          : null;

    if (closedReason !== null || !hours?.opensAt || !hours.closesAt) {
      days.push({
        date,
        status: 'closed',
        opensAt: null,
        closesAt: null,
        closedReason,
        segments: [],
      });
      continue;
    }

    const [oh = 0, om = 0] = hours.opensAt.split(':').map(Number);
    const [ch = 0, cm = 0] = hours.closesAt.split(':').map(Number);
    const windowStart = day.set({ hour: oh, minute: om }).toMillis();
    const windowEnd = day.set({ hour: ch, minute: cm }).toMillis();
    const pieces = resolve(intervals, windowStart, windowEnd);
    const covered = pieces.reduce((sum, p) => sum + (p.end - p.start), 0);

    const segments: AvailabilitySegment[] = pieces.map((p) => ({
      startsAt: iso(p.start),
      endsAt: iso(p.end),
      status: p.status,
      relatedFacility: p.status === 'blocked_by_related' ? p.related : null,
    }));
    days.push({
      date,
      status:
        covered === 0
          ? 'available'
          : covered >= windowEnd - windowStart
            ? 'fully_booked'
            : 'partially_booked',
      opensAt: hours.opensAt,
      closesAt: hours.closesAt,
      closedReason: null,
      segments,
    });
  }

  return { facilityId: facility.id, timeZone: zone, ...MOCK_AVAILABILITY_RULES, days };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function problem(status: number, title: string, detail?: string) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

export interface AvailabilityHandlerOptions {
  delayMs: number;
  catalogue: () => readonly FacilitySummary[];
  fail?: () => boolean;
  /** Requests that already hold time, from the booking store. */
  extraBookings?: () => LedgerBooking[];
  /** The current instant. Injectable so tests can pin the calendar. */
  now?: () => DateTime;
}

export function createAvailabilityHandlers(
  root: string,
  {
    delayMs,
    catalogue,
    fail,
    extraBookings,
    now = () => DateTime.now(),
  }: AvailabilityHandlerOptions,
) {
  let startedAt: DateTime | undefined;

  return [
    http.get(`${root}/facilities/:id/availability`, async ({ params, request }) => {
      if (delayMs > 0) await delay(delayMs);
      if (fail?.()) return problem(500, 'Mock failure', 'The availability service is unavailable.');

      const current = now();
      startedAt ??= current;

      const facility = catalogue().find((f) => f.id === params.id);
      if (!facility) return problem(404, 'Facility not found', 'No facility exists with that id.');

      const search = new URL(request.url).searchParams;
      const from = search.get('from') ?? '';
      const to = search.get('to') ?? '';
      if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return problem(400, 'Invalid query', '"from" and "to" must be ISO dates (YYYY-MM-DD).');
      }
      const start = DateTime.fromISO(from, { zone: FACILITY_TIME_ZONE });
      const end = DateTime.fromISO(to, { zone: FACILITY_TIME_ZONE });
      if (!start.isValid || !end.isValid || end < start) {
        return problem(
          400,
          'Invalid query',
          '"from" and "to" must be valid dates, with "to" not before "from".',
        );
      }
      if (end.diff(start, 'days').days + 1 > AVAILABILITY_MAX_SPAN_DAYS) {
        return problem(
          400,
          'Invalid query',
          `The range may span at most ${AVAILABILITY_MAX_SPAN_DAYS} days.`,
        );
      }

      const ledger = buildLedger({ now: current, startedAt, catalogue: catalogue() });
      ledger.bookings.push(...(extraBookings?.() ?? []));
      return HttpResponse.json(
        computeAvailability({ facility, catalogue: catalogue(), ledger, from, to, now: current }),
      );
    }),
  ];
}
