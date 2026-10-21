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
  type ClosedBy,
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
import type { FacilitySettings } from './data/facilityStore';
import { ancestorsOf } from './data/hierarchy';
import { MOCK_AVAILABILITY_RULES } from './availabilityRules';

export { MOCK_AVAILABILITY_RULES };

/** Higher wins where intervals overlap. */
const PRIORITY: Record<AvailabilitySegmentStatus, number> = {
  closure: 5,
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
  /** For a closure: why. */
  reason?: string;
  /** Where the booking this came from really starts and ends, before any clipping to a day. */
  sourceStart?: number;
  sourceEnd?: number;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}

function activeBookings(ledger: Ledger, facilityId: string, now: DateTime) {
  return ledger.bookings.filter(
    (b) =>
      b.facilityId === facilityId &&
      (b.status === 'approved' || (b.holdExpiresAt !== null && b.holdExpiresAt > now)),
  );
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
      sourceStart: start,
      sourceEnd: end,
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
        sourceStart: b.startsAt.toMillis(),
        sourceEnd: b.endsAt.toMillis(),
      });
    }
  }
  return intervals;
}

/** Splits overlaps by priority, then merges abutting pieces of the same status and relation. */
function resolve(
  intervals: Interval[],
  windowStart: number,
  windowEnd: number,
  /** The calendar day, so a piece can say whether its booking carries on past either end of it. */
  day?: { start: number; end: number },
): Interval[] {
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
    const before = day !== undefined && (winner.sourceStart ?? start) < day.start;
    const after = day !== undefined && (winner.sourceEnd ?? end) > day.end;
    const previous = pieces[pieces.length - 1];
    if (
      previous &&
      previous.end === start &&
      previous.status === winner.status &&
      previous.related?.id === winner.related?.id &&
      previous.reason === winner.reason
    ) {
      previous.end = end;
      previous.continuesBefore ||= before;
      previous.continuesAfter ||= after;
    } else {
      pieces.push({
        start,
        end,
        status: winner.status,
        related: winner.related,
        reason: winner.reason,
        continuesBefore: before,
        continuesAfter: after,
      });
    }
  }
  return pieces;
}

const iso = (millis: number) =>
  DateTime.fromMillis(millis, { zone: 'utc' }).toISO({ suppressMilliseconds: true }) ?? '';

const toSegment = (p: Interval): AvailabilitySegment => ({
  startsAt: iso(p.start),
  endsAt: iso(p.end),
  status: p.status,
  relatedFacility: p.status === 'blocked_by_related' ? p.related : null,
  ...(p.status === 'closure' && p.reason ? { reason: p.reason } : {}),
  ...(p.continuesBefore ? { continuesBefore: true } : {}),
  ...(p.continuesAfter ? { continuesAfter: true } : {}),
});

export function computeAvailability({
  facility,
  catalogue,
  ledger,
  from,
  to,
  now,
  settings,
}: {
  facility: FacilitySummary;
  catalogue: readonly FacilitySummary[];
  ledger: Ledger;
  from: string;
  to: string;
  now: DateTime;
  /** Each facility's own hours, notice, horizon and blackouts. Without it, the fixture's defaults. */
  settings?: (facilityId: string) => FacilitySettings | undefined;
}): FacilityAvailability {
  const zone = FACILITY_TIME_ZONE;
  const own = settings?.(facility.id);
  const schedule = own?.schedule ?? scheduleFor(facility);
  const rules = own
    ? {
        minimumNoticeHours: own.minimumNoticeHours,
        maximumHorizonDays: own.maximumHorizonDays,
        minimumDurationMinutes: MOCK_AVAILABILITY_RULES.minimumDurationMinutes,
        maximumBookingDays: own.maximumBookingDays,
      }
    : MOCK_AVAILABILITY_RULES;
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

    const dayStart = day.startOf('day').toMillis();
    const dayEnd = day.plus({ days: 1 }).startOf('day').toMillis();
    const closedBy: ClosedBy | null = blackout
      ? 'blackout'
      : holiday
        ? 'holiday'
        : !hours?.opensAt || !hours.closesAt
          ? 'schedule'
          : null;

    const closedReason = holiday
      ? `Public holiday: ${holiday}`
      : blackout
        ? blackout.reason
        : !hours?.opensAt || !hours.closesAt
          ? `Not open on ${day.setLocale('en').toFormat('cccc')}s`
          : null;

    if (closedReason !== null || !hours?.opensAt || !hours.closesAt) {
      // Closed by its hours or a holiday, but wholly inside someone's multi day booking: the venue
      // is not staffed, yet the booker's property is in it, so the day is occupied in full.
      if (closedBy === 'schedule' || closedBy === 'holiday') {
        const whole = resolve(
          intervals.filter((i) => i.status !== 'buffer' && i.status !== 'closure'),
          dayStart,
          dayEnd,
          { start: dayStart, end: dayEnd },
        );
        if (
          whole.length > 0 &&
          whole.reduce((sum, p) => sum + (p.end - p.start), 0) >= dayEnd - dayStart
        ) {
          days.push({
            date,
            status: 'fully_booked',
            opensAt: null,
            closesAt: null,
            closedReason,
            closedBy,
            segments: whole.map(toSegment),
          });
          continue;
        }
      }
      days.push({
        date,
        status: 'closed',
        opensAt: null,
        closesAt: null,
        closedReason,
        closedBy,
        segments: [],
      });
      continue;
    }

    const [oh = 0, om = 0] = hours.opensAt.split(':').map(Number);
    const [ch = 0, cm = 0] = hours.closesAt.split(':').map(Number);
    const windowStart = day.set({ hour: oh, minute: om }).toMillis();
    const windowEnd = day.set({ hour: ch, minute: cm }).toMillis();

    // Blackouts set in administration: the whole operating day closes the day, part of it closes
    // that part.
    const closures = (own?.blackouts ?? []).filter(
      (b) => b.startsAt.toMillis() < windowEnd && b.endsAt.toMillis() > windowStart,
    );
    const total = closures.find(
      (b) => b.startsAt.toMillis() <= windowStart && b.endsAt.toMillis() >= windowEnd,
    );
    if (total) {
      days.push({
        date,
        status: 'closed',
        opensAt: null,
        closesAt: null,
        closedReason: total.reason,
        closedBy: 'blackout',
        segments: [],
      });
      continue;
    }
    const pieces = resolve(
      [
        ...intervals,
        ...closures.map((b) => ({
          start: b.startsAt.toMillis(),
          end: b.endsAt.toMillis(),
          status: 'closure' as const,
          related: null,
          reason: b.reason,
        })),
      ],
      windowStart,
      windowEnd,
      { start: dayStart, end: dayEnd },
    );
    const covered = pieces.reduce((sum, p) => sum + (p.end - p.start), 0);

    const segments: AvailabilitySegment[] = pieces.map(toSegment);
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

  return { facilityId: facility.id, timeZone: zone, ...rules, days };
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
  /** Each facility's own rules. */
  settings?: (facilityId: string) => FacilitySettings | undefined;
}

export function createAvailabilityHandlers(
  root: string,
  {
    delayMs,
    catalogue,
    fail,
    extraBookings,
    now = () => DateTime.now(),
    settings,
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

      const ledger = buildLedger({
        now: current,
        startedAt,
        catalogue: catalogue(),
        bufferOf: bufferOf(settings),
      });
      ledger.bookings.push(...(extraBookings?.() ?? []));
      return HttpResponse.json(
        computeAvailability({
          facility,
          catalogue: catalogue(),
          ledger,
          from,
          to,
          now: current,
          settings,
        }),
      );
    }),
  ];
}

/** A facility's set-up and clear-down time, for bookings that do not carry their own. */
export const bufferOf = (
  settings: ((facilityId: string) => FacilitySettings | undefined) | undefined,
) =>
  settings
    ? (facilityId: string) => ({
        setup: settings(facilityId)?.setupMinutes ?? 0,
        teardown: settings(facilityId)?.teardownMinutes ?? 0,
      })
    : undefined;
