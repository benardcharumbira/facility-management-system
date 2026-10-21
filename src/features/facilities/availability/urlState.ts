import { DateTime } from 'luxon';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { addMonths, parseYearMonth, yearMonthOf, type YearMonth } from '@/shared/utils/calendar';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;

/**
 * The calendar's state in the URL: the view and the month or week shown, the day whose panel is
 * open (or the first and last day, for a span), and the chosen window as a start and end instant
 * (UTC). A range rather than a date plus times, so a multi day selection was an extension of this
 * shape and not a rewrite: only `dateTo` is new for it.
 */
export type CalendarView = 'month' | 'week';
export const CALENDAR_VIEWS: readonly CalendarView[] = ['month', 'week'];

export interface AvailabilityUrlState {
  view: CalendarView;
  month: string | undefined;
  /** Any date in the week to show. The week runs Monday to Sunday. */
  week: string | undefined;
  date: string | undefined;
  /** The last day of a span whose first day is `date`. Absent for a single day. */
  dateTo: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
  /** A booking draft being continued, carried through so "Request booking" resumes it. */
  draft: string | undefined;
  /** A booking whose date is being changed: the calendar is then choosing its new time. */
  reschedule: string | undefined;
}

export const availabilityCodec = createParamsCodec<AvailabilityUrlState>({
  view: param.oneOf(CALENDAR_VIEWS, 'month'),
  month: param.matching(YEAR_MONTH),
  week: param.matching(ISO_DATE),
  date: param.matching(ISO_DATE),
  dateTo: param.matching(ISO_DATE),
  startsAt: param.matching(ISO_INSTANT),
  endsAt: param.matching(ISO_INSTANT),
  draft: param.matching(/^[\w-]+$/),
  reschedule: param.matching(/^[\w-]+$/),
});

export interface Selection {
  start: DateTime;
  end: DateTime;
}

/** The chosen window, if both instants are present, valid and in order. */
export function selectionOf(state: AvailabilityUrlState): Selection | null {
  if (!state.startsAt || !state.endsAt) return null;
  const start = DateTime.fromISO(state.startsAt, { zone: 'utc' });
  const end = DateTime.fromISO(state.endsAt, { zone: 'utc' });
  return start.isValid && end.isValid && end > start ? { start, end } : null;
}

export function toInstant(value: DateTime): string {
  return value.toUTC().toISO({ suppressMilliseconds: true }) ?? '';
}

/** The month to show: the URL's, else the chosen day's, else the browser's current month. */
export function requestedMonth(state: AvailabilityUrlState): YearMonth {
  return (
    (state.month && parseYearMonth(state.month)) ||
    (state.date && parseYearMonth(state.date.slice(0, 7))) ||
    // Only the first load, before the facility's zone is known, falls back to the browser's date.
    yearMonthOf(DateTime.now())
  );
}

export { addMonths };

const BOOKING_PATH = '/bookings/new';

/** The hand off to the booking request: facility and, when chosen, the window as UTC instants. */
export function bookingHref(
  facilityId: string,
  selection: Selection | null,
  draft?: string,
): string {
  const params = new URLSearchParams({ facilityId });
  if (selection) {
    params.set('startsAt', toInstant(selection.start));
    params.set('endsAt', toInstant(selection.end));
  }
  if (draft) params.set('draft', draft);
  return `${BOOKING_PATH}?${params.toString()}`;
}

/** Where choosing a new time for an existing booking leads: back to it, with the proposal. */
export function rescheduleHref(bookingId: string, selection: Selection): string {
  const params = new URLSearchParams({
    proposedStartsAt: toInstant(selection.start),
    proposedEndsAt: toInstant(selection.end),
  });
  return `/bookings/${encodeURIComponent(bookingId)}?${params.toString()}`;
}

/** The Monday of the week to show: the URL's, else the chosen day's, else the browser's today. */
export function requestedWeek(state: AvailabilityUrlState, zone?: string): DateTime {
  const base = state.week ?? state.date ?? state.startsAt?.slice(0, 10);
  const day = base
    ? DateTime.fromISO(base, { zone: zone ?? 'utc' })
    : DateTime.now().setZone(zone ?? 'utc');
  const valid = day.isValid ? day : DateTime.now().setZone(zone ?? 'utc');
  return valid.startOf('day').minus({ days: valid.weekday - 1 });
}

/** The days a chosen span covers, first to last, as dates in the facility zone. */
export function selectionDates(selection: Selection, zone: string): [string, string] {
  const first = selection.start.setZone(zone).toISODate() ?? '';
  const last = selection.end.setZone(zone).minus({ milliseconds: 1 }).toISODate() ?? first;
  return [first, last];
}
