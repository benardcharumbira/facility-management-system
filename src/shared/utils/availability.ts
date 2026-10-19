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
  'timeZone' | 'minimumNoticeHours' | 'maximumHorizonDays' | 'minimumDurationMinutes'
>;

export function rulesOf(availability: FacilityAvailability): Rules {
  return {
    timeZone: availability.timeZone,
    minimumNoticeHours: availability.minimumNoticeHours,
    maximumHorizonDays: availability.maximumHorizonDays,
    minimumDurationMinutes: availability.minimumDurationMinutes,
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
    case 'blocked_by_related':
      return `${segment.relatedFacility?.name ?? 'A related space'} is booked`;
  }
}

export interface WindowProblem {
  message: string;
  /** The segment in the way, when the problem is a clash. */
  segment?: AvailabilitySegment;
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
