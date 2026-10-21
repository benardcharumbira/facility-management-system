import { z } from 'zod';
import type {
  ReferenceEntry,
  ReferenceImpactResult,
  TermsVersion,
} from '../contracts/admin-reference';
import { impactResult } from './admin-facilities';
import { id, instant, nonNegativeInt, obj } from './common';
import type { Assert, Same } from './same';

export const referenceEntry = obj({
  id,
  name: z.string(),
  displayOrder: nonNegativeInt,
  status: z.enum(['active', 'archived']),
  usage: obj({ facilities: nonNegativeInt, bookings: nonNegativeInt }),
});
export const referenceList = z.array(referenceEntry);
export const createReferenceRequest = obj({
  name: z.string(),
  displayOrder: nonNegativeInt.max(9999).optional(),
});
export const updateReferenceRequest = createReferenceRequest.partial();

export const referenceImpactResult = impactResult.extend({
  facilitiesAffected: z.array(obj({ id, name: z.string(), capacity: nonNegativeInt })),
});

const person = obj({ id, name: z.string() });
export const termsVersion = obj({
  id,
  version: z.string().meta({ example: '2026-2' }),
  title: z.string(),
  paragraphs: z.array(z.string()),
  status: z.enum(['draft', 'published', 'superseded']),
  createdAt: instant,
  createdBy: person,
  publishedAt: instant.nullable(),
  publishedBy: person.nullable(),
  supersededAt: instant.nullable(),
  bookings: nonNegativeInt,
});
export const termsList = z.array(termsVersion);
export const createTermsRequest = obj({
  title: z.string(),
  paragraphs: z.array(z.string()).max(60),
});
export const updateTermsRequest = createTermsRequest.partial();

export type _Checks = [
  Assert<Same<z.infer<typeof referenceEntry>, ReferenceEntry>>,
  Assert<Same<z.infer<typeof referenceImpactResult>, ReferenceImpactResult>>,
  Assert<Same<z.infer<typeof termsVersion>, TermsVersion>>,
];
