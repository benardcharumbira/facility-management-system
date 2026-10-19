import { DateTime } from 'luxon';

/**
 * Booked windows are timezone aware on the backend. Convention for the whole app:
 * the API speaks ISO 8601 instants with an offset; the UI works in DateTime values that
 * carry an explicit zone (the facility's zone, not the browser's) and never in Date.
 */
export function fromApiInstant(iso: string, zone: string): DateTime<true> {
  const parsed = DateTime.fromISO(iso, { setZone: false }).setZone(zone);
  if (!parsed.isValid) throw new Error(`Invalid ISO instant: ${iso}`);
  return parsed;
}

export function toApiInstant(value: DateTime): string {
  const iso = value.toUTC().toISO();
  if (iso === null) throw new Error('Cannot serialise an invalid DateTime');
  return iso;
}
