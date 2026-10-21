import type { BookingOptions } from '@/shared/api';

/**
 * Names for the event type and seating arrangement a booking chose, including those an
 * administrator has since archived: a booking made with one still has to read properly.
 */
export function eventTypeName(options: BookingOptions | undefined, id: string | null): string {
  if (!options) return '';
  return [...options.eventTypes, ...options.retiredEventTypes].find((t) => t.id === id)?.name ?? '';
}

export function arrangementName(options: BookingOptions | undefined, id: string | null): string {
  if (!options) return '';
  return (
    [...options.seatingArrangements, ...options.retiredSeatingArrangements].find((s) => s.id === id)
      ?.name ?? ''
  );
}
