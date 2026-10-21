import { DateTime } from 'luxon';

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
