import { DateTime } from 'luxon';
import type { AvailabilityDay, AvailabilitySegment, FacilityAvailability } from '@/shared/api';
import { formatClock, formatLongDate } from './calendar';

/**
 * Pure rules about availability data, shared by the calendar and the booking form so that both
 * apply exactly the same checks to a window. None of this derives blocking from the facility
 * hierarchy: segments arrive already resolved by the backend.
 */
export type Rules = Pick<
  FacilityAvailability,
  | 'timeZone'
  | 'minimumNoticeHours'
  | 'maximumHorizonDays'
  | 'minimumDurationMinutes'
  | 'maximumBookingDays'
>;

export function rulesOf(availability: FacilityAvailability): Rules {
  return {
    timeZone: availability.timeZone,
    minimumNoticeHours: availability.minimumNoticeHours,
    maximumHorizonDays: availability.maximumHorizonDays,
    minimumDurationMinutes: availability.minimumDurationMinutes,
    maximumBookingDays: availability.maximumBookingDays,
  };
}

/** The earliest instant a booking may start. */
export function earliestStart(rules: Rules, now: DateTime): DateTime {
  return now.setZone(rules.timeZone).plus({ hours: rules.minimumNoticeHours });
}

export function clockOn(date: string, time: string, zone: string): DateTime {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return DateTime.fromISO(date, { zone }).set({ hour: hours, minute: minutes });
}

export function operatingWindow(day: AvailabilityDay, zone: string) {
  if (day.opensAt === null || day.closesAt === null) return null;
  return {
    start: clockOn(day.date, day.opensAt, zone),
    end: clockOn(day.date, day.closesAt, zone),
  };
}

/** Why a segment is unavailable, in a short phrase. */
export function segmentPhrase(segment: AvailabilitySegment): string {
  switch (segment.status) {
    case 'booked':
      return 'booked';
    case 'held':
      return 'held pending a request';
    case 'buffer':
      return 'set-up or clear-down time';
    case 'closure':
      return segment.reason ? `closed: ${segment.reason}` : 'closed';
    case 'blocked_by_related':
      return `${segment.relatedFacility?.name ?? 'A related space'} is booked`;
  }
}

export interface WindowProblem {
  message: string;
  /** The segment in the way, when the problem is a clash. */
  segment?: AvailabilitySegment;
  /** For a span of several days, the day that broke it (yyyy-MM-dd in the facility zone). */
  day?: string;
}

/** A window that cannot stand on this day, and why, or null if it is fine. */
export function windowProblem(
  window: { start: DateTime; end: DateTime },
  day: AvailabilityDay | undefined,
  rules: Rules,
  now: DateTime,
): WindowProblem | null {
  const zone = rules.timeZone;
  const start = window.start.setZone(zone);
  const end = window.end.setZone(zone);
  if (!day) return { message: 'That date could not be checked.' };

  const hours = operatingWindow(day, zone);
  if (!hours) {
    return {
      message: `${formatLongDate(DateTime.fromISO(day.date, { zone }))} is closed${day.closedReason ? `: ${day.closedReason}` : ''}.`,
    };
  }
  if (start < hours.start || end > hours.end) {
    return {
      message: `The venue is open ${formatClock(hours.start)} to ${formatClock(hours.end)}, and your times fall outside that.`,
    };
  }
  if (end.diff(start, 'minutes').minutes < rules.minimumDurationMinutes) {
    return { message: `Bookings must be at least ${rules.minimumDurationMinutes} minutes.` };
  }
  if (start < earliestStart(rules, now)) {
    return {
      message: `Bookings need ${rules.minimumNoticeHours} hours notice, and your start is sooner than that.`,
    };
  }
  if (
    start >
    now
      .setZone(zone)
      .startOf('day')
      .plus({ days: rules.maximumHorizonDays + 1 })
  ) {
    return { message: `Bookings can only be made up to ${rules.maximumHorizonDays} days ahead.` };
  }
  const clash = day.segments.find(
    (s) => start.toMillis() < Date.parse(s.endsAt) && end.toMillis() > Date.parse(s.startsAt),
  );
  return clash
    ? {
        message: `That time overlaps time that is unavailable: ${segmentPhrase(clash)}.`,
        segment: clash,
      }
    : null;
}

/** The calendar dates a window touches, in the zone. An end at exactly midnight does not touch the next day. */
export function datesTouched(start: DateTime, end: DateTime, zone: string): string[] {
  const first = start.setZone(zone).startOf('day');
  const last = end.setZone(zone).minus({ milliseconds: 1 }).startOf('day');
  const dates: string[] = [];
  for (let day = first; day <= last; day = day.plus({ days: 1 })) dates.push(day.toISODate() ?? '');
  return dates.length > 0 ? dates : [first.toISODate() ?? ''];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * A window of one day or of several, and why it cannot stand, or null if it is fine. One day is
 * judged as before. Across several days the rules are:
 *
 * - Operating hours bind the start on the first day and the end on the last. Days wholly inside
 *   are occupied in full, so a venue closed on Sundays can take a Friday to Sunday wedding.
 * - A blackout blocks the whole span; so does anything already booked, held or buffered on a day
 *   the span would occupy (on the first day, from the start; on the last, up to the end).
 * - A span may cover at most the facility's `maximumBookingDays`.
 *
 * It names the day that broke it. Set-up and clear-down time sit at the outer edges only, so no
 * buffer is checked between days.
 */
export function spanProblem(
  window: { start: DateTime; end: DateTime },
  dayOf: (date: string) => AvailabilityDay | undefined,
  rules: Rules,
  now: DateTime,
): WindowProblem | null {
  const zone = rules.timeZone;
  const start = window.start.setZone(zone);
  const end = window.end.setZone(zone);
  const dates = datesTouched(start, end, zone);
  const firstDate = dates[0] ?? '';
  const lastDate = dates[dates.length - 1] ?? firstDate;
  if (dates.length === 1) return windowProblem(window, dayOf(firstDate), rules, now);

  const long = (date: string) => formatLongDate(DateTime.fromISO(date, { zone }));
  if (dates.length > rules.maximumBookingDays) {
    return {
      message:
        rules.maximumBookingDays <= 1
          ? `This venue takes bookings within a single day. Yours runs from ${long(firstDate)} to ${long(lastDate)}.`
          : `A booking here can cover at most ${plural(rules.maximumBookingDays, 'day', 'days')}. Yours covers ${dates.length}, from ${long(firstDate)} to ${long(lastDate)}.`,
    };
  }

  const first = dayOf(firstDate);
  const last = dayOf(lastDate);
  if (!first) return { message: `${long(firstDate)} could not be checked.`, day: firstDate };
  if (!last) return { message: `${long(lastDate)} could not be checked.`, day: lastDate };

  const startHours = operatingWindow(first, zone);
  if (!startHours) {
    return {
      message: `${long(firstDate)} is closed${first.closedReason ? `: ${first.closedReason}` : ''}, so a booking cannot start on it.`,
      day: firstDate,
    };
  }
  if (start < startHours.start || start >= startHours.end) {
    return {
      message: `The venue is open ${formatClock(startHours.start)} to ${formatClock(startHours.end)} on ${long(firstDate)}, and your start falls outside that.`,
      day: firstDate,
    };
  }
  const endHours = operatingWindow(last, zone);
  if (!endHours) {
    return {
      message: `${long(lastDate)} is closed${last.closedReason ? `: ${last.closedReason}` : ''}, so a booking cannot end on it.`,
      day: lastDate,
    };
  }
  if (end <= endHours.start || end > endHours.end) {
    return {
      message: `The venue is open ${formatClock(endHours.start)} to ${formatClock(endHours.end)} on ${long(lastDate)}, and your end falls outside that.`,
      day: lastDate,
    };
  }
  if (start < earliestStart(rules, now)) {
    return {
      message: `Bookings need ${rules.minimumNoticeHours} hours notice, and your start is sooner than that.`,
    };
  }
  if (
    start >
    now
      .setZone(zone)
      .startOf('day')
      .plus({ days: rules.maximumHorizonDays + 1 })
  ) {
    return { message: `Bookings can only be made up to ${rules.maximumHorizonDays} days ahead.` };
  }

  for (const date of dates) {
    const day = dayOf(date);
    if (!day) return { message: `${long(date)} could not be checked.`, day: date };
    // A blackout is the venue genuinely unavailable. Weekly hours and holidays are not: the
    // booker's property stays in the hall over a day it is not staffed.
    if (day.status === 'closed') {
      if (day.closedBy === 'schedule' || day.closedBy === 'holiday') continue;
      return {
        message: `${long(date)} is closed${day.closedReason ? `: ${day.closedReason}` : ''}, and a booking cannot run across a closure.`,
        day: date,
      };
    }
    const from = date === firstDate ? start.toMillis() : -Infinity;
    const until = date === lastDate ? end.toMillis() : Infinity;
    const clash = day.segments.find(
      (seg) => from < Date.parse(seg.endsAt) && until > Date.parse(seg.startsAt),
    );
    if (clash) {
      return {
        message: `${long(date)} is not free: ${segmentPhrase(clash)}, so a booking cannot run across it.`,
        segment: clash,
        day: date,
      };
    }
  }
  return null;
}
