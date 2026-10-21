import { DateTime } from 'luxon';

const ZONE = 'Africa/Johannesburg';

/** "1 February 2026", in the municipality's zone. */
export const dateOnly = (instant: string): string =>
  DateTime.fromISO(instant, { zone: 'utc' }).setZone(ZONE).setLocale('en').toFormat('d LLLL yyyy');
