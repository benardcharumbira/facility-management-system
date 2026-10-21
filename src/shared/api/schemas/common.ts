/**
 * Building blocks every schema shares: the instants, dates and identifiers of the API, the one
 * collection envelope, and the problem document. See api/BEHAVIOUR.md for the rules behind them.
 *
 * Objects are strict: a response that carries a field the contract does not describe fails
 * validation, so the mock cannot quietly grow past the contract.
 */
import { z } from 'zod';

/** A strict object: unknown keys are an error. */
export const obj = z.strictObject;

/** A UTC instant, ISO 8601, with a `Z` and no offset: `2026-11-14T06:00:00Z`. */
export const instant = z.iso
  .datetime()
  .meta({
    description: 'A UTC instant, ISO 8601, always ending in Z.',
    example: '2026-11-14T06:00:00Z',
  });

/** A calendar date with no time: `2026-11-14`. In the facility's time zone unless stated. */
export const isoDate = z.iso
  .date()
  .meta({
    description: 'A calendar date, yyyy-MM-dd, in the facility time zone.',
    example: '2026-11-14',
  });

/** A 24 hour wall clock time in the facility's time zone: `08:00`. */
export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .meta({ description: 'HH:mm, 24 hour, in the facility time zone.', example: '08:00' });

/** An opaque identifier. Stable for the life of the record; never reused. */
export const id = z.string().min(1).meta({ description: 'An opaque, stable identifier.' });

export const int = z.number().int();
export const nonNegativeInt = z.number().int().min(0);

/** An IANA time zone name, such as `Africa/Johannesburg`. */
export const timeZone = z
  .string()
  .meta({ description: 'An IANA time zone name.', example: 'Africa/Johannesburg' });

export const idName = obj({ id, name: z.string() });

/** The one collection envelope. `totalPages` is 0 when there are no items. */
export const paginated = <T extends z.ZodType>(item: T) =>
  obj({
    items: z.array(item),
    page: int.min(1),
    pageSize: int.min(1),
    totalItems: nonNegativeInt,
    totalPages: nonNegativeInt,
  });

/** Parameters every collection endpoint accepts. */
export const pageParams = {
  page: int.min(1).optional().meta({ description: '1 based. Default 1.' }),
  pageSize: int
    .min(1)
    .max(100)
    .optional()
    .meta({ description: 'Default per endpoint, at most 100.' }),
};

/** A query parameter that may repeat (`a=1&a=2`), parsed into an array. */
export const repeated = <T extends z.ZodType>(item: T) => z.array(item);

/** Field level validation errors, keyed by field name. */
export const fieldErrors = z.record(z.string(), z.array(z.string()));

export const emptyBody = z.undefined();
