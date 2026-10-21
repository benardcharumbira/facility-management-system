/**
 * Contract for reference data: the vocabularies the booking form and the administration screens
 * depend on. This file is the specification handed to the backend.
 *
 * ```
 * GET    /api/admin/seating-arrangements
 * POST   /api/admin/seating-arrangements
 * PATCH  /api/admin/seating-arrangements/{id}
 * POST   /api/admin/seating-arrangements/{id}/impact    preview archiving (an addition)
 * POST   /api/admin/seating-arrangements/{id}/archive
 * POST   /api/admin/seating-arrangements/{id}/restore   (an addition)
 *
 * GET    /api/admin/event-types                         the same, without the impact check
 * POST   /api/admin/event-types
 * PATCH  /api/admin/event-types/{id}
 * POST   /api/admin/event-types/{id}/archive
 * POST   /api/admin/event-types/{id}/restore
 *
 * GET    /api/admin/terms                               every version, newest first
 * POST   /api/admin/terms                               a new draft
 * PATCH  /api/admin/terms/{id}                          a draft only
 * POST   /api/admin/terms/{id}/publish
 *
 * GET    /api/public/terms                              public: the published version (see public.ts)
 * ```
 *
 * **System administrators only** on every `admin` route.
 *
 * **Archive, never delete.** Bookings and capacity figures refer to these by id. An archived entry
 * is absent from the booking form and the capacity editor and keeps its name wherever it was used.
 *
 * **Seating arrangements.** Facilities record a capacity per arrangement. Archiving one that has
 * figures against it runs the impact check: the figures stop being offered, and the approved and
 * pending bookings that chose it are named. Nothing is changed in those bookings.
 *
 * **Event types** drive the booking form and reporting. They affect nothing else today: not routing
 * and not eligibility. Whether they should is a question for the client.
 *
 * **Terms.** A version is `draft`, `published` or `superseded`. Only a draft can be edited. Publishing
 * makes it the current version and supersedes the previous one in the same step. A published
 * version is immutable: correcting it means publishing a new one. A booking records the version
 * current at the moment of submission; a submission that carries another version is refused (422,
 * field `termsAccepted`), so the version recorded is always the one the applicant was shown.
 */
import type { ImpactResult } from './admin-facilities';

export type ReferenceStatus = 'active' | 'archived';
export const REFERENCE_STATUSES: readonly ReferenceStatus[] = ['active', 'archived'];

export interface ReferenceEntry {
  id: string;
  name: string;
  /** Ascending. Ties by name. */
  displayOrder: number;
  status: ReferenceStatus;
  /** Where it is in use. `facilities` counts capacity figures (seating arrangements only). */
  usage: { facilities: number; bookings: number };
}

export interface CreateReferenceRequest {
  name: string;
  displayOrder?: number;
}
export type UpdateReferenceRequest = Partial<CreateReferenceRequest>;

/** `GET` the vocabularies. Archived entries are included, and marked. */
export type ReferenceList = ReferenceEntry[];

/**
 * What archiving a seating arrangement reaches: the facilities that hold a capacity figure for it
 * (the figure stops being offered), and, as `affectedBookings` (reason `arrangement_archived`),
 * the approved and pending bookings that chose it, which are left as they are.
 */
export interface ReferenceImpactResult extends ImpactResult {
  facilitiesAffected: Array<{ id: string; name: string; capacity: number }>;
}

export type TermsStatus = 'draft' | 'published' | 'superseded';

export interface TermsVersion {
  id: string;
  /** The label bookings record, such as "2026-2". Assigned when the draft is created. */
  version: string;
  title: string;
  paragraphs: string[];
  status: TermsStatus;
  createdAt: string;
  createdBy: { id: string; name: string };
  publishedAt: string | null;
  publishedBy: { id: string; name: string } | null;
  supersededAt: string | null;
  /** Bookings that recorded this version. */
  bookings: number;
}

export interface CreateTermsRequest {
  title: string;
  paragraphs: string[];
}
export type UpdateTermsRequest = Partial<CreateTermsRequest>;

export const MAX_TERMS_PARAGRAPHS = 60;
export const MAX_TERMS_PARAGRAPH_LENGTH = 2000;
