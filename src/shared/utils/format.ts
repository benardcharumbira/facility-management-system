import { DateTime } from 'luxon';

const NUMBER_WORDS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/** "three days" for small numbers, "12 days" beyond. */
export const daysInWords = (n: number): string =>
  `${n <= 10 ? NUMBER_WORDS[n] : n} ${n === 1 ? 'day' : 'days'}`;

/**
 * A window as words, in the facility's zone: never the browser's. Within a day it is a date and
 * "09:00 to 12:00". Across several it is one booking read as a range: the two dates, the two times
 * (each on its own day), how many days it covers, and the whole of it in one sentence.
 */
export function describeWindow(startsAt: string, endsAt: string, zone: string) {
  const start = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(zone);
  const end = DateTime.fromISO(endsAt, { zone: 'utc' }).setZone(zone);
  const lastDay = end.minus({ milliseconds: 1 }).startOf('day');
  const days = Math.round(lastDay.diff(start.startOf('day'), 'days').days) + 1;
  const long = (t: DateTime) => t.setLocale('en').toFormat('cccc d LLLL');
  const withYear = (t: DateTime) => t.setLocale('en').toFormat('cccc d LLLL yyyy');
  if (days <= 1) {
    const date = withYear(start);
    const time = `${start.toFormat('HH:mm')} to ${end.toFormat('HH:mm')}`;
    return { date, time, days: 1, span: false, length: '', text: `${date}, ${time}` };
  }
  return {
    // The year once, at the end, unless the span crosses into a new one.
    date:
      start.year === end.year
        ? `${long(start)} to ${withYear(end)}`
        : `${withYear(start)} to ${withYear(end)}`,
    time: `${start.toFormat('HH:mm')} on the first day to ${end.toFormat('HH:mm')} on the last day`,
    days,
    span: true,
    length: daysInWords(days),
    text: `${long(start)} ${start.toFormat('HH:mm')} to ${long(end)} ${end.toFormat('HH:mm')}, ${daysInWords(days)}`,
  };
}

/** "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** How long ago something was, in plain words: "less than an hour", "5 hours", "3 days". */
export function elapsed(since: string, now: DateTime): string {
  const hours = now.diff(DateTime.fromISO(since, { zone: 'utc' }), 'hours').hours;
  if (hours < 1) return 'less than an hour';
  if (hours < 48) {
    const whole = Math.floor(hours);
    return `${whole} ${whole === 1 ? 'hour' : 'hours'}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} days`;
}

/** "26 October" or "26 October 2025", in the given zone. */
export function shortDate(instant: string, zone: string): string {
  const date = DateTime.fromISO(instant, { zone: 'utc' }).setZone(zone).setLocale('en');
  return date.toFormat('d LLLL yyyy');
}

/** "26 October 2026, 14:05" in the given zone. */
export function dateAndTime(instant: string, zone: string): string {
  const date = DateTime.fromISO(instant, { zone: 'utc' }).setZone(zone).setLocale('en');
  return `${date.toFormat('d LLLL yyyy')}, ${date.toFormat('HH:mm')}`;
}

/** "Sat 14 Nov", in the given zone. For dense lists. */
export function compactDate(instant: string, zone: string): string {
  return DateTime.fromISO(instant, { zone: 'utc' })
    .setZone(zone)
    .setLocale('en')
    .toFormat('ccc d LLL');
}

/**
 * "Sat 14 Nov, 08:00 to 17:00" in the given zone. For dense lists. Across days: "Fri 13 Nov, 14:00
 * to Sun 15 Nov, 12:00".
 */
export function compactWindow(startsAt: string, endsAt: string, zone: string): string {
  const startZoned = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(zone);
  const endZoned = DateTime.fromISO(endsAt, { zone: 'utc' }).setZone(zone);
  const start = startZoned.toFormat('HH:mm');
  const end = endZoned.toFormat('HH:mm');
  const lastDay = endZoned.minus({ milliseconds: 1 });
  if (!startZoned.hasSame(lastDay, 'day')) {
    return `${compactDate(startsAt, zone)}, ${start} to ${compactDate(endsAt, zone)}, ${end}`;
  }
  return `${compactDate(startsAt, zone)}, ${start} to ${end}`;
}

/** A length of time in plain words: "less than an hour", "5 hours", "3 days". */
export function durationText(hours: number): string {
  if (hours < 1) return 'less than an hour';
  if (hours < 48) {
    const whole = Math.floor(hours);
    return `${whole} ${whole === 1 ? 'hour' : 'hours'}`;
  }
  return `${Math.floor(hours / 24)} days`;
}
