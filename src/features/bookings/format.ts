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

/**
 * The calendar URL for a facility with this window already selected, so changing the time
 * returns to the same place rather than starting over. Carries the draft along so the next
 * "Request booking" continues it instead of starting another.
 */
export function calendarHref(args: {
  facilityId: string;
  startsAt?: string;
  endsAt?: string;
  zone?: string;
  draft?: string;
}): string {
  const params = new URLSearchParams();
  if (args.startsAt && args.endsAt) {
    const date = DateTime.fromISO(args.startsAt, { zone: 'utc' })
      .setZone(args.zone ?? 'utc')
      .toISODate();
    if (date) {
      params.set('month', date.slice(0, 7));
      params.set('date', date);
    }
    params.set('startsAt', args.startsAt);
    params.set('endsAt', args.endsAt);
  }
  if (args.draft) params.set('draft', args.draft);
  const query = params.toString();
  return `/facilities/${encodeURIComponent(args.facilityId)}${query ? `?${query}` : ''}`;
}
