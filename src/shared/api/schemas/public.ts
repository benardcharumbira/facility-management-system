import { z } from 'zod';
import {
  CONTENT_SLUGS,
  type ContentPageData,
  type FeaturedFacility,
  type PublishedTerms,
} from '../contracts/public';
import type { MyProfile, UpdateMyProfileRequest } from '../contracts/profile';
import { ROLES } from '@/shared/auth/roles';
import { id, instant, int, nonNegativeInt, obj } from './common';
import type { Assert, Same } from './same';

export const role = z.enum([
  ROLES.applicant,
  ROLES.internal,
  ROLES.facilityAdmin,
  ROLES.systemAdmin,
]);

/** `GET /me`. Roles are resolved on the server from the Clerk subject, never read from the token. */
export const me = obj({ id, email: z.string(), displayName: z.string(), role });

export const venueImage = obj({
  src: z.string(),
  width: int.min(1),
  height: int.min(1),
  alt: z.string(),
  sources: z.array(obj({ type: z.string(), srcSet: z.string() })).optional(),
});

export const featuredFacility = obj({
  id,
  name: z.string(),
  locality: z.string(),
  typeName: z.string(),
  capacity: nonNegativeInt.nullable(),
  shortDescription: z.string(),
  image: venueImage.nullable(),
});

export const contentSlug = z.enum(CONTENT_SLUGS);
export const contentStatus = z.enum(['placeholder', 'draft_for_review', 'approved']);

export const contentPage = obj({
  slug: contentSlug,
  title: z.string(),
  description: z.string(),
  status: contentStatus,
  reviewedAt: instant.nullable(),
  sections: z.array(
    obj({
      id,
      heading: z.string(),
      paragraphs: z.array(z.string()),
      items: z.array(z.string()).optional(),
    }),
  ),
});

export const publishedTerms = obj({
  version: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
  publishedAt: instant,
  placeholder: z.boolean(),
});

export const myProfile = obj({ telephone: z.string().nullable(), updatedAt: instant.nullable() });
export const updateMyProfileRequest = obj({ telephone: z.string().nullable() });

export type _Checks = [
  Assert<Same<z.infer<typeof featuredFacility>, FeaturedFacility>>,
  Assert<Same<z.infer<typeof contentPage>, ContentPageData>>,
  Assert<Same<z.infer<typeof publishedTerms>, PublishedTerms>>,
  Assert<Same<z.infer<typeof myProfile>, MyProfile>>,
  Assert<Same<z.infer<typeof updateMyProfileRequest>, UpdateMyProfileRequest>>,
];
