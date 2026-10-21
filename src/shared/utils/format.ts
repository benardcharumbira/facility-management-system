import { DateTime } from 'luxon';

/** A window as words, in the facility's zone: never the browser's. */
export function describeWindow(startsAt: string, endsAt: string, zone: string) {
  const start = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(zone);
  const end = DateTime.fromISO(endsAt, { zone: 'utc' }).setZone(zone);
  return {
    date: start.setLocale('en').toFormat('cccc d LLLL yyyy'),
    time: `${start.toFormat('HH:mm')} to ${end.toFormat('HH:mm')}`,
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

/** "Sat 14 Nov, 08:00 to 17:00" in the given zone. */
export function compactWindow(startsAt: string, endsAt: string, zone: string): string {
  const end = DateTime.fromISO(endsAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm');
  const start = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm');
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
