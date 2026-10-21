/**
 * Contract for resource administration. This file is the specification handed to the backend: the
 * MSW handlers implement it and the client is written against it.
 *
 * ```
 * GET    /api/admin/resources                     the catalogue, including archived (filters, sort, envelope)
 * POST   /api/admin/resources
 * GET    /api/admin/resources/{id}
 * PATCH  /api/admin/resources/{id}
 * POST   /api/admin/resources/{id}/impact         preview a change to the catalogue entry (an addition)
 * POST   /api/admin/resources/{id}/archive
 * POST   /api/admin/resources/{id}/restore
 * GET    /api/admin/resource-allocations          the whole matrix, optionally narrowed
 * PUT    /api/admin/resource-allocations          a batch of changes, applied atomically
 * POST   /api/admin/resource-allocations/impact   preview a batch of pending changes
 * GET    /api/admin/facilities/{id}/resources     one facility's allocations
 * PUT    /api/admin/facilities/{id}/resources     one facility's allocations, applied atomically
 * ```
 *
 * **Two concepts.** The *catalogue* is what kinds of resource exist across the municipality: one
 * entry for "urn", defined once. An *allocation* is how many of one a given facility holds. Changing
 * the catalogue changes the vocabulary everywhere (the booking form, the browse filters); changing
 * an allocation changes what one venue can offer.
 *
 * **Quantified or not.** A catalogue entry is `quantified` or not. A quantified resource (chairs,
 * cups, an urn) is allocated as a whole number. An unquantified one (a stage, a podium) is allocated
 * as available or not, and is requested on a booking as a quantity of 1.
 *
 * **Atomic batches.** A batch of changes is applied entirely or not at all. The server validates
 * every change first and refuses the whole batch, naming the changes at fault, if any is invalid.
 *
 * **Impact.** Reducing a quantity below what an existing booking asked for, withdrawing an
 * unquantified resource a booking asked for, changing whether a resource is quantified, and
 * archiving it all reach bookings that already exist. They use the same impact check as facility
 * administration (`ImpactResult`), which names each booking and the resource involved and decides
 * nothing. Only approved and pending bookings that have not yet ended are considered.
 *
 * **No hard delete.** Resources appear in historical bookings, so they are archived. An archived
 * resource is absent from new bookings, from the allocation matrix and from every facility's
 * resources, and still has a name on the bookings that requested it.
 *
 * **Permissions.** System administrators and facility administrators; anyone else gets 403.
 */
import type { Paginated } from '@/shared/types/pagination';
import type { AdminFacilityStatus, ImpactResult } from './admin-facilities';

/** A fixed vocabulary, matching the booking form's grouping. */
export type ResourceCategory = 'venue' | 'kitchen';
export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = ['venue', 'kitchen'];

export type ResourceStatus = 'active' | 'archived';
export const RESOURCE_STATUSES: readonly ResourceStatus[] = ['active', 'archived'];

/** The most of one resource a single facility can be recorded as holding. */
export const MAX_ALLOCATION = 5000;

/** A number for a quantified resource, available or not for an unquantified one. */
export type AllocationValue = number | boolean;

export interface AdminResourceRow {
  id: string;
  name: string;
  category: ResourceCategory;
  quantified: boolean;
  description: string | null;
  status: ResourceStatus;
  /** Facilities that hold at least one (or have it available). */
  facilitiesHolding: number;
}

export const RESOURCE_SORTS = ['name', 'category', '-facilitiesHolding'] as const;
export type ResourceSort = (typeof RESOURCE_SORTS)[number];

/**
 * `GET /api/admin/resources`. All optional. `q` matches name and description (every word). Archived
 * resources are left out unless `status` includes `archived`. Groups combine with AND, values within
 * a group with OR. Default sort is `category` (venue, then kitchen), then name.
 */
export interface AdminResourceListParams {
  q?: string;
  category?: ResourceCategory[];
  status?: ResourceStatus[];
  sort?: ResourceSort;
  page?: number;
  pageSize?: number;
}

export type AdminResourceList = Paginated<AdminResourceRow>;

export interface AdminResource extends AdminResourceRow {
  /** Approved and pending bookings that have not ended and that asked for it. */
  futureBookings: number;
  /** The facilities that hold it, and how much. */
  holders: Array<{ facility: { id: string; name: string }; value: AllocationValue }>;
}

export interface CreateResourceRequest {
  name: string;
  category: ResourceCategory;
  quantified: boolean;
  description: string | null;
}
export type UpdateResourceRequest = Partial<CreateResourceRequest>;

/** What is about to be done to a catalogue entry. */
export type ResourceProposedChange =
  /** Edits that reach nothing: the name, the description. */
  | { kind: 'details' }
  /**
   * Switching to unquantified discards every allocated number (a facility that held any is left
   * available). Switching to quantified leaves every facility at zero.
   */
  | { kind: 'quantified'; quantified: boolean }
  | { kind: 'archive' };

/** The impact of a catalogue change: the bookings it reaches, and the allocations it overwrites. */
export interface ResourceImpactResult extends ImpactResult {
  /** Allocations that would be discarded, or reset to zero. */
  allocationsAffected: number;
  facilitiesAffected: number;
}

export interface AllocationChange {
  facilityId: string;
  resourceId: string;
  value: AllocationValue;
}

export interface AllocationQuery {
  facilityId?: string[];
  category?: ResourceCategory[];
}

/**
 * `GET /api/admin/resource-allocations`. Every active resource against every facility that is not
 * archived (narrowed by the query), with one value per cell.
 */
export interface AllocationMatrix {
  facilities: Array<{ id: string; name: string; status: AdminFacilityStatus }>;
  resources: Array<{
    id: string;
    name: string;
    category: ResourceCategory;
    quantified: boolean;
  }>;
  allocations: AllocationChange[];
}

/** `PUT /api/admin/resource-allocations`, and the body of its impact preview. */
export interface BatchAllocationRequest {
  changes: AllocationChange[];
}

export interface FacilityAllocations {
  facility: { id: string; name: string };
  resources: Array<{
    id: string;
    name: string;
    category: ResourceCategory;
    quantified: boolean;
    value: AllocationValue;
  }>;
}

/** `PUT /api/admin/facilities/{id}/resources`. */
export interface SetFacilityAllocationsRequest {
  values: Array<{ resourceId: string; value: AllocationValue }>;
}
