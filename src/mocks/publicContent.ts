/**
 * The server side behaviour the real public API must reproduce. In particular:
 *
 * - Everything here is unauthenticated: someone must be able to read the terms before registering.
 * - The featured venues are a small fixed selection, not browsing. A venue that is archived or not
 *   in the estate is left out.
 * - The terms are the currently published version, or 404 if none is published yet.
 * - The signed in user's profile holds one application owned field, a contact telephone number.
 *   Clerk owns the rest.
 *
 * Reviewers: `?mock=empty` publishes no terms and no featured venues; a telephone number of all
 * zeros fails the save as though the service were down.
 */
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import {
  CONTENT_SLUGS,
  type ContentSlug,
  type FeaturedFacility,
  type MyProfile,
  type PublishedTerms,
  type UpdateMyProfileRequest,
} from '@/shared/api';
import { addError, invalid, problem } from './adminGuard';
import { callerOf } from './bookings';
import { facilityStore } from './data/facilityStore';
import { profileStore } from './data/profileStore';
import { PUBLIC_CONTENT } from './data/publicContent';
import { termsStore } from './data/termsStore';

/** The municipality's choice of venues to show on the landing page, in order. */
export const FEATURED_IDS = ['rothdene-hall', 'lakeside-hall', 'vaal-marina-hall', 'city-hall'];

const IMAGE = { width: 640, height: 400 };

export const MAX_TELEPHONE_DIGITS = 15;
export const MIN_TELEPHONE_DIGITS = 7;

export function validateTelephone(value: unknown): { errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  if (value === null) return { errors };
  if (typeof value !== 'string') {
    addError(errors, 'telephone', 'Enter a telephone number, or leave it empty.');
    return { errors };
  }
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!/^[+()\d][\d\s()+-]*$/.test(trimmed) || digits.length < MIN_TELEPHONE_DIGITS) {
    addError(
      errors,
      'telephone',
      'Enter a telephone number using digits, spaces, + and brackets, with at least 7 digits.',
    );
  } else if (digits.length > MAX_TELEPHONE_DIGITS) {
    addError(errors, 'telephone', `Use ${MAX_TELEPHONE_DIGITS} digits or fewer.`);
  }
  return { errors };
}

export interface PublicHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  /** Publishes no terms and no featured venues. */
  empty?: () => boolean;
  fail?: () => boolean;
  ready?: () => void;
}

export function createPublicHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), empty, fail, ready }: PublicHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const prepare = async () => {
    await wait();
    ready?.();
    return fail?.() ? problem(500, 'Mock failure', 'The service is unavailable.') : null;
  };

  return [
    http.get(`${root}/public/facilities/featured`, async () => {
      const failed = await prepare();
      if (failed) return failed;
      if (empty?.()) return HttpResponse.json([] satisfies FeaturedFacility[]);
      const body: FeaturedFacility[] = FEATURED_IDS.flatMap((id) => {
        const f = facilityStore.get(id);
        if (!f || f.archived) return [];
        const summary = facilityStore.summary(f);
        return [
          {
            id: f.id,
            name: f.name,
            locality: f.locality,
            typeName: summary.type.name,
            capacity: f.capacity.maximum,
            shortDescription: f.shortDescription,
            image: { src: `/images/venues/${f.id}.svg`, ...IMAGE, alt: '' },
          },
        ];
      });
      return HttpResponse.json(body);
    }),

    http.get(`${root}/public/terms`, async () => {
      const failed = await prepare();
      if (failed) return failed;
      const current = empty?.()
        ? undefined
        : termsStore.all().find((v) => v.status === 'published');
      if (!current)
        return problem(404, 'No terms published', 'No version of the terms is published yet.');
      const body: PublishedTerms = {
        version: current.version,
        title: current.title,
        paragraphs: current.paragraphs,
        publishedAt: current.publishedAt ?? current.createdAt,
        placeholder: current.placeholder,
      };
      return HttpResponse.json(body);
    }),

    http.get(`${root}/public/content/:slug`, async ({ params }) => {
      const failed = await prepare();
      if (failed) return failed;
      const slug = String(params.slug);
      return CONTENT_SLUGS.includes(slug as ContentSlug)
        ? HttpResponse.json(PUBLIC_CONTENT[slug as ContentSlug])
        : problem(404, 'Page not found');
    }),

    http.get(`${root}/me/profile`, async ({ request }) => {
      const failed = await prepare();
      if (failed) return failed;
      return HttpResponse.json(profileStore.get(callerOf(request)) satisfies MyProfile);
    }),

    http.patch(`${root}/me/profile`, async ({ request }) => {
      const failed = await prepare();
      if (failed) return failed;
      const body = (await request.json().catch(() => ({}))) as Partial<UpdateMyProfileRequest>;
      if (body.telephone === undefined) {
        return invalid({ telephone: ['Enter a telephone number, or leave it empty.'] });
      }
      const { errors } = validateTelephone(body.telephone);
      if (Object.keys(errors).length > 0) return invalid(errors);
      const telephone = body.telephone === null ? null : body.telephone.trim() || null;
      // Reviewers: a number of all zeros stands for the service failing to save.
      if (telephone && /^[0\s()+-]+$/.test(telephone)) {
        return problem(
          503,
          'We could not save that',
          'The service is not able to save your details just now.',
        );
      }
      const saved: MyProfile = {
        telephone,
        updatedAt: now().toUTC().toISO({ suppressMilliseconds: true }),
      };
      profileStore.set(callerOf(request), saved);
      return HttpResponse.json(saved);
    }),
  ];
}
