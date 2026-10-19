import { DateTime } from 'luxon';

/**
 * Calendar arithmetic on whole dates. A month is `{ year, month }` (month 1 to 12) and a day is an
 * ISO date string: neither carries a zone. Days become DateTime values only through an explicit
 * zone, so nothing here depends on the browser's local zone.
 */
export interface YearMonth {
  year: number;
  month: number;
}

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseYearMonth(value: string): YearMonth | undefined {
  const match = YEAR_MONTH.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : undefined;
}

export function formatYearMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function yearMonthOf(date: DateTime): YearMonth {
  return { year: date.year, month: date.month };
}

/** The first of the month, as a day in `zone`. */
export function firstOfMonth(ym: YearMonth, zone: string): DateTime<true> {
  const day = DateTime.fromObject({ year: ym.year, month: ym.month, day: 1 }, { zone });
  if (!day.isValid) throw new Error(`Invalid month ${formatYearMonth(ym)} in ${zone}`);
  return day;
}

export const GRID_WEEKS = 6;
export const DAYS_PER_WEEK = 7;

/**
 * Always six Monday-first weeks (42 days), so the grid never changes height between months. The
 * days before the 1st and after the last belong to the adjacent months.
 */
export function monthGridDays(ym: YearMonth, zone: string): DateTime<true>[] {
  const first = firstOfMonth(ym, zone);
  const start = first.minus({ days: first.weekday - 1 });
  return Array.from(
    { length: GRID_WEEKS * DAYS_PER_WEEK },
    (_, i) => start.plus({ days: i }).startOf('day') as DateTime<true>,
  );
}

/** Inclusive ISO date range of the grid for a month, as sent to the availability endpoint. */
export function monthGridRange(ym: YearMonth, zone: string): { from: string; to: string } {
  const days = monthGridDays(ym, zone);
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) throw new Error('Empty grid');
  return { from: first.toISODate(), to: last.toISODate() };
}

/** 24 hour "HH:mm" in the DateTime's own zone. */
export function formatClock(value: DateTime): string {
  return value.toFormat('HH:mm');
}

/** "Saturday 14 November", in English whatever the browser's locale. */
export function formatLongDate(value: DateTime): string {
  return value.setLocale('en').toFormat('cccc d LLLL');
}
