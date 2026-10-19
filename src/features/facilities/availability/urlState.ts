import { DateTime } from 'luxon';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { addMonths, parseYearMonth, yearMonthOf, type YearMonth } from '@/shared/utils/calendar';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;

/**
 * The calendar's state in the URL: the month shown, the day whose panel is open, and the chosen
 * window as a start and end instant (UTC). A range rather than a date plus times, so a multi day
 * selection is an extension of this shape and not a rewrite.
 */
export interface AvailabilityUrlState {
  month: string | undefined;
  date: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
}

export const availabilityCodec = createParamsCodec<AvailabilityUrlState>({
  month: param.matching(YEAR_MONTH),
  date: param.matching(ISO_DATE),
  startsAt: param.matching(ISO_INSTANT),
  endsAt: param.matching(ISO_INSTANT),
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
export function bookingHref(facilityId: string, selection: Selection | null): string {
  const params = new URLSearchParams({ facilityId });
  if (selection) {
    params.set('startsAt', toInstant(selection.start));
    params.set('endsAt', toInstant(selection.end));
  }
  return `${BOOKING_PATH}?${params.toString()}`;
}
