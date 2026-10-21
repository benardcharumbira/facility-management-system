/**
 * The server side behaviour the real resource administration API must reproduce. In particular:
 *
 * - The catalogue (what kinds of resource exist) and the allocation (how many a facility holds)
 *   are separate. Quantified resources are allocated as whole numbers, the others as available or
 *   not, and a value of the wrong kind is refused.
 * - A batch of allocation changes is applied entirely or not at all. Every change is validated
 *   first, and if the batch fails while being applied everything is put back.
 * - Nothing is hard deleted. Archiving removes a resource from new bookings, from the matrix and
 *   from every facility's resources, and keeps its name on the bookings that asked for it.
 * - `impact` names the bookings a change would reach and decides nothing.
 *
 * Reviewers: the Bantu Bonke Hall's stock is locked for a stocktake, so a batch that includes it
 * fails part way through applying and is rolled back.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  MAX_ALLOCATION,
  RESOURCE_CATEGORIES,
  RESOURCE_SORTS,
  RESOURCE_STATUSES,
  type AdminResource,
  type AdminResourceList,
  type AdminResourceListParams,
  type AdminResourceRow,
  type AllocationChange,
  type AllocationMatrix,
  type CreateResourceRequest,
  type FacilityAllocations,
  type ResourceCategory,
  type ResourceProposedChange,
  type ResourceSort,
  type ResourceStatus,
  type SetFacilityAllocationsRequest,
  type UpdateResourceRequest,
} from '@/shared/api';
import { PROBLEM_TYPES } from '@/shared/api/contracts/problem-types';
import { addError, invalid, problem, requireAdmin, type Errors } from './adminGuard';
import { batchImpact, catalogueImpact } from './data/resourceImpact';
import { facilityStore } from './data/facilityStore';
import { resourceStore, type StoredResource } from './data/resourceStore';

/** Its stock is being counted, so it cannot be changed. A reviewer trigger for a failed batch. */
export const STOCKTAKE_FACILITY = 'bantu-bonke-hall';

const MAX_NAME = 60;
const MAX_DESCRIPTION = 300;

class BadQuery extends Error {}

const facilitiesHolding = (resourceId: string) =>
  resourceStore
    .holders(resourceId)
    .filter((h) => facilityStore.get(h.facilityId) && !facilityStore.get(h.facilityId)?.archived)
    .length;

const toRow = (r: StoredResource): AdminResourceRow => ({
  id: r.id,
  name: r.name,
  category: r.category,
  quantified: r.quantified,
  description: r.description,
  status: r.archived ? 'archived' : 'active',
  facilitiesHolding: facilitiesHolding(r.id),
});

function toDetail(r: StoredResource, now: DateTime): AdminResource {
  const asked = facilityStore
    .liveBookings(now)
    .filter(({ booking }) => booking.resources.some((x) => x.resourceId === r.id)).length;
  return {
    ...toRow(r),
    futureBookings: asked,
    holders: resourceStore
      .holders(r.id)
      .flatMap((h) => {
        const facility = facilityStore.get(h.facilityId);
        return facility && !facility.archived
          ? [{ facility: { id: facility.id, name: facility.name }, value: h.value }]
          : [];
      })
      .sort((a, b) => a.facility.name.localeCompare(b.facility.name)),
  };
}

export function parseResourceListParams(search: URLSearchParams): AdminResourceListParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const categories = search.getAll('category');
  if (categories.some((c) => !RESOURCE_CATEGORIES.includes(c as ResourceCategory))) {
    throw new BadQuery(`"category" must be one of: ${RESOURCE_CATEGORIES.join(', ')}.`);
  }
  const statuses = search.getAll('status');
  if (statuses.some((s) => !RESOURCE_STATUSES.includes(s as ResourceStatus))) {
    throw new BadQuery(`"status" must be one of: ${RESOURCE_STATUSES.join(', ')}.`);
  }
  const sort = search.get('sort');
  if (sort !== null && !RESOURCE_SORTS.includes(sort as ResourceSort)) {
    throw new BadQuery(`"sort" must be one of: ${RESOURCE_SORTS.join(', ')}.`);
  }
  return {
    q: search.get('q') ?? undefined,
    category: categories as ResourceCategory[],
    status: statuses as ResourceStatus[],
    sort: (sort as ResourceSort | null) ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

export function listResources(params: AdminResourceListParams): AdminResourceList {
  const wanted = params.status?.length ? params.status : (['active'] as ResourceStatus[]);
  const words = (params.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const order = (r: AdminResourceRow) => RESOURCE_CATEGORIES.indexOf(r.category);
  const rows = resourceStore
    .all()
    .map(toRow)
    .filter((r) => wanted.includes(r.status))
    .filter((r) => !params.category?.length || params.category.includes(r.category))
    .filter((r) => {
      if (words.length === 0) return true;
      const haystack = `${r.name} ${r.description ?? ''}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  const sort = params.sort ?? 'category';
  rows.sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name)
      : sort === '-facilitiesHolding'
        ? b.facilitiesHolding - a.facilitiesHolding || a.name.localeCompare(b.name)
        : order(a) - order(b) || a.name.localeCompare(b.name),
  );
  const size = Math.min(100, Math.max(1, params.pageSize ?? 100));
  const page = Math.max(1, params.page ?? 1);
  return {
    items: rows.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

// --- validation ---------------------------------------------------------------------------------

function validateResource(
  body: Partial<CreateResourceRequest>,
  existing: StoredResource | undefined,
): Errors {
  const errors: Errors = {};
  if (body.name !== undefined || !existing) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') addError(errors, 'name', 'Enter the name of the resource.');
    else if (name.length > MAX_NAME)
      addError(errors, 'name', `Use ${MAX_NAME} characters or fewer.`);
    else {
      const clash = resourceStore
        .all()
        .find((r) => r.id !== existing?.id && r.name.toLowerCase() === name.toLowerCase());
      if (clash) addError(errors, 'name', `There is already a resource called ${clash.name}.`);
    }
  }
  if (
    (body.category !== undefined || !existing) &&
    !RESOURCE_CATEGORIES.includes(body.category as ResourceCategory)
  ) {
    addError(errors, 'category', 'Choose venue or kitchen.');
  }
  if ((body.quantified !== undefined || !existing) && typeof body.quantified !== 'boolean') {
    addError(errors, 'quantified', 'Say whether it is counted.');
  }
  if (typeof body.description === 'string' && body.description.length > MAX_DESCRIPTION) {
    addError(errors, 'description', `Use ${MAX_DESCRIPTION} characters or fewer.`);
  }
  return errors;
}

/** Every change checked against the catalogue and the estate, before anything is applied. */
export function validateChanges(changes: unknown): Errors {
  const errors: Errors = {};
  if (!Array.isArray(changes)) {
    addError(errors, 'changes', 'Send a list of changes.');
    return errors;
  }
  (changes as Array<Partial<AllocationChange>>).forEach((change, index) => {
    const at = `changes.${index}`;
    const facility = change.facilityId ? facilityStore.get(change.facilityId) : undefined;
    const resource = change.resourceId ? resourceStore.get(change.resourceId) : undefined;
    if (!facility) addError(errors, at, 'That facility does not exist.');
    else if (facility.archived) addError(errors, at, `${facility.name} is archived.`);
    if (!resource) addError(errors, at, 'That resource does not exist.');
    else if (resource.archived) addError(errors, at, `${resource.name} is archived.`);
    if (resource && !resource.archived) {
      if (resource.quantified) {
        const v = change.value;
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_ALLOCATION) {
          addError(
            errors,
            at,
            `${resource.name} is counted: use a whole number from 0 to ${MAX_ALLOCATION}.`,
          );
        }
      } else if (typeof change.value !== 'boolean') {
        addError(errors, at, `${resource.name} is not counted: it is available or not.`);
      }
    }
  });
  return errors;
}

/**
 * Applies a batch atomically. If anything goes wrong part way through, every cell is put back.
 */
export function applyChanges(
  changes: AllocationChange[],
): { ok: true } | { ok: false; message: string } {
  const before = resourceStore.snapshot();
  try {
    for (const change of changes) {
      if (change.facilityId === STOCKTAKE_FACILITY) {
        throw new Error(
          `${facilityStore.get(change.facilityId)?.name ?? 'This facility'}'s stock is locked while a stocktake is under way. Nothing in this batch was saved.`,
        );
      }
      resourceStore.setValue(change.facilityId, change.resourceId, change.value);
    }
    return { ok: true };
  } catch (failure) {
    resourceStore.restore(before);
    return { ok: false, message: failure instanceof Error ? failure.message : 'The save failed.' };
  }
}

// --- handlers -----------------------------------------------------------------------------------

export interface AdminResourceHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  fail?: () => boolean;
  ready?: () => void;
}

export function createAdminResourceHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), fail, ready }: AdminResourceHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());

  const admin =
    (
      handle: (context: {
        request: Request;
        params: Record<string, unknown>;
      }) => Response | Promise<Response>,
    ) =>
    async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      await wait();
      ready?.();
      const refused = requireAdmin(request, 'resources');
      if (refused) return refused;
      if (fail?.()) return problem(500, 'Mock failure', 'The resources service is unavailable.');
      return handle({ request, params });
    };

  const withResource = (
    handle: (r: StoredResource, request: Request) => Response | Promise<Response>,
  ) =>
    admin(({ request, params }) => {
      const resource = resourceStore.get(String(params.id));
      return resource ? handle(resource, request) : problem(404, 'Resource not found');
    });

  const editable = (r: StoredResource) =>
    r.archived ? problem(409, 'Resource is archived', 'Restore it before changing it.') : null;

  const batchOf = async (request: Request): Promise<AllocationChange[] | Response> => {
    const body = (await request.json().catch(() => ({}))) as { changes?: unknown };
    const errors = validateChanges(body.changes);
    return Object.keys(errors).length > 0 ? invalid(errors) : (body.changes as AllocationChange[]);
  };

  const facilityAllocations = (facilityId: string): FacilityAllocations | null => {
    const facility = facilityStore.get(facilityId);
    if (!facility) return null;
    return {
      facility: { id: facility.id, name: facility.name },
      resources: resourceStore.active().map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        quantified: r.quantified,
        value: resourceStore.valueOf(facilityId, r.id),
      })),
    };
  };

  return [
    http.get(
      `${root}/admin/resources`,
      admin(({ request }) => {
        try {
          return HttpResponse.json(
            listResources(parseResourceListParams(new URL(request.url).searchParams)),
          );
        } catch (error) {
          if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
          throw error;
        }
      }),
    ),

    http.post(
      `${root}/admin/resources`,
      admin(async ({ request }) => {
        const body = (await request.json()) as Partial<CreateResourceRequest>;
        const errors = validateResource(body, undefined);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const resource: StoredResource = {
          id: resourceStore.newId(body.name ?? ''),
          name: (body.name ?? '').trim(),
          category: body.category as ResourceCategory,
          quantified: body.quantified as boolean,
          description: body.description?.trim() ? body.description.trim() : null,
          archived: false,
        };
        resourceStore.set(resource);
        return HttpResponse.json(toDetail(resource, now()), { status: 201 });
      }),
    ),

    http.get(
      `${root}/admin/resources/:id`,
      withResource((resource) => HttpResponse.json(toDetail(resource, now()))),
    ),

    http.patch(
      `${root}/admin/resources/:id`,
      withResource(async (resource, request) => {
        const locked = editable(resource);
        if (locked) return locked;
        const body = (await request.json()) as UpdateResourceRequest;
        const errors = validateResource(body, resource);
        if (Object.keys(errors).length > 0) return invalid(errors);

        const updated: StoredResource = {
          ...resource,
          name: body.name?.trim() ?? resource.name,
          category: body.category ?? resource.category,
          quantified: body.quantified ?? resource.quantified,
          description:
            body.description === undefined
              ? resource.description
              : body.description?.trim()
                ? body.description.trim()
                : null,
        };
        // Changing whether it is counted rewrites what every facility holds.
        if (updated.quantified !== resource.quantified) {
          for (const holder of resourceStore.holders(resource.id)) {
            resourceStore.setValue(holder.facilityId, resource.id, updated.quantified ? 0 : true);
          }
        }
        resourceStore.set(updated);
        return HttpResponse.json(toDetail(updated, now()));
      }),
    ),

    http.post(
      `${root}/admin/resources/:id/impact`,
      withResource(async (resource, request) => {
        const change = (await request.json()) as ResourceProposedChange;
        return HttpResponse.json(catalogueImpact(resource.id, change, now()));
      }),
    ),

    http.post(
      `${root}/admin/resources/:id/archive`,
      withResource((resource) => {
        if (resource.archived) return problem(409, 'Already archived');
        const archived = { ...resource, archived: true };
        resourceStore.set(archived);
        return HttpResponse.json(toDetail(archived, now()));
      }),
    ),

    http.post(
      `${root}/admin/resources/:id/restore`,
      withResource((resource) => {
        if (!resource.archived) return problem(409, 'Not archived');
        const restored = { ...resource, archived: false };
        resourceStore.set(restored);
        return HttpResponse.json(toDetail(restored, now()));
      }),
    ),

    // --- the matrix -----------------------------------------------------------------------------
    http.get(
      `${root}/admin/resource-allocations`,
      admin(({ request }) => {
        const search = new URL(request.url).searchParams;
        const wantedFacilities = search.getAll('facilityId');
        const wantedCategories = search.getAll('category');
        const facilities = facilityStore
          .all()
          .filter((f) => !f.archived)
          .filter((f) => wantedFacilities.length === 0 || wantedFacilities.includes(f.id))
          .sort((a, b) => a.name.localeCompare(b.name));
        const resources = resourceStore
          .active()
          .filter((r) => wantedCategories.length === 0 || wantedCategories.includes(r.category));
        const body: AllocationMatrix = {
          facilities: facilities.map((f) => ({
            id: f.id,
            name: f.name,
            status: facilityStore.statusOf(f),
          })),
          resources: resources.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            quantified: r.quantified,
          })),
          allocations: facilities.flatMap((f) =>
            resources.map((r) => ({
              facilityId: f.id,
              resourceId: r.id,
              value: resourceStore.valueOf(f.id, r.id),
            })),
          ),
        };
        return HttpResponse.json(body);
      }),
    ),

    http.post(
      `${root}/admin/resource-allocations/impact`,
      admin(async ({ request }) => {
        const changes = await batchOf(request);
        return changes instanceof Response
          ? changes
          : HttpResponse.json(batchImpact(changes, now()));
      }),
    ),

    http.put(
      `${root}/admin/resource-allocations`,
      admin(async ({ request }) => {
        const changes = await batchOf(request);
        if (changes instanceof Response) return changes;
        const result = applyChanges(changes);
        return result.ok
          ? HttpResponse.json({ applied: changes.length })
          : problem(409, 'The batch was not saved', result.message, {
              type: PROBLEM_TYPES.batchNotSaved,
            });
      }),
    ),

    // --- one facility ---------------------------------------------------------------------------
    http.get(
      `${root}/admin/facilities/:id/resources`,
      admin(({ params }) => {
        const found = facilityAllocations(String(params.id));
        return found ? HttpResponse.json(found) : problem(404, 'Facility not found');
      }),
    ),

    http.put(
      `${root}/admin/facilities/:id/resources`,
      admin(async ({ request, params }) => {
        const facility = facilityStore.get(String(params.id));
        if (!facility) return problem(404, 'Facility not found');
        const body = (await request
          .json()
          .catch(() => ({}))) as Partial<SetFacilityAllocationsRequest>;
        const changes: AllocationChange[] = (Array.isArray(body.values) ? body.values : []).map(
          (v) => ({ facilityId: facility.id, resourceId: v.resourceId, value: v.value }),
        );
        const errors = validateChanges(changes);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const result = applyChanges(changes);
        return result.ok
          ? HttpResponse.json(facilityAllocations(facility.id))
          : problem(409, 'The changes were not saved', result.message, {
              type: PROBLEM_TYPES.batchNotSaved,
            });
      }),
    ),
  ];
}
