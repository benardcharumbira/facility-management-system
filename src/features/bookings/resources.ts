import type { BookingOptions, BookingResourceOption } from '@/shared/api';

/**
 * Every resource the booking form knows, including those since archived. An archived resource
 * cannot be requested, but a booking that asked for it still has to read properly.
 */
export function allResources(options: BookingOptions | undefined): BookingResourceOption[] {
  return options ? [...options.resources, ...options.retiredResources] : [];
}

/** "Chairs × 40", or just "Stage" for something that is present or not rather than counted. */
export function describeRequest(name: string, quantity: number, quantified: boolean): string {
  return quantified ? `${name} × ${quantity}` : name;
}
