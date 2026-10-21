/**
 * The server side behaviour the real facility administration API must reproduce. In particular:
 *
 * - Only system and facility administrators may use it; anyone else is refused with 403.
 * - The hierarchy can never become a cycle. The edit screen does not offer the option, and the
 *   server refuses it anyway.
 * - A facility needs an approver to be active. A new one starts unavailable.
 * - Nothing is hard deleted. Archiving keeps the history and takes the facility out of the public
 *   estate and out of new bookings; restoring brings it back unavailable.
 * - `impact` names the bookings a change would reach. It decides nothing.
 * - What an administrator saves replaces the fixture's provisional values for that field.
 */
import { DateTime } from 'luxon';
import { HttpResponse, http, delay } from 'msw';
import {
  ADMIN_FACILITY_SORTS,
  ADMIN_FACILITY_STATUSES,
  IMAGE_RULES,
  type AdminBlackout,
  type AdminFacility,
  type AdminFacilityList,
  type AdminFacilityListParams,
  type AdminFacilityRow,
  type AdminFacilitySort,
  type AdminFacilityStatus,
  type CreateBlackoutRequest,
  type CreateFacilityRequest,
  type CreateFacilityTypeRequest,
  type FacilityCapacity,
  type FacilitySchedule,
  type FacilityStructure,
  type FacilityType,
  type ProposedChange,
  type UpdateFacilityRequest,
  type UpdateImageRequest,
} from '@/shared/api';
import { FACILITY_TIME_ZONE } from './data/bookingLedger';
import { referenceStore } from './data/referenceStore';
import { computeImpact } from './data/facilityImpact';
import { facilityStore, type StoredFacility } from './data/facilityStore';
import { designationsOf, recordDesignationChange } from './data/designations';
import { approverCandidates, userIdOf } from './data/staff';
import { userStore } from './data/userStore';
import { addError as add, invalid, problem, requireAdmin, type Errors } from './adminGuard';

const MAX_NAME = 80;
const MAX_SHORT = 160;
const MAX_DESCRIPTION = 4000;
const MAX_REASON = 200;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

const notFound = () => problem(404, 'Facility not found');

const iso = (value: string) => DateTime.fromISO(value, { zone: 'utc' });
const validInstant = (value: unknown): value is string =>
  typeof value === 'string' && iso(value).isValid;
const arrangementName = (id: string | null) => referenceStore.nameOf('seating_arrangement', id);

// --- projections --------------------------------------------------------------------------------

function blackoutState(startsAt: string, endsAt: string, now: DateTime): AdminBlackout['state'] {
  if (iso(endsAt) <= now) return 'past';
  return iso(startsAt) <= now ? 'current' : 'future';
}

function futureBookingCount(id: string, now: DateTime): number {
  return facilityStore.liveBookings(now).filter((l) => l.booking.facilityId === id).length;
}

const blackoutActive = (id: string, now: DateTime) =>
  facilityStore.effectiveBlackouts(id).some((b) => iso(b.startsAt) <= now && now < iso(b.endsAt));

function toRow(f: StoredFacility, now: DateTime, depth = 0): AdminFacilityRow {
  const parent = f.parentId ? facilityStore.get(f.parentId) : undefined;
  return {
    id: f.id,
    name: f.name,
    code: f.code,
    type: { id: f.typeId, name: facilityStore.type(f.typeId)?.name ?? f.typeId },
    locality: f.locality,
    status: facilityStore.statusOf(f),
    parentFacility: parent ? { id: parent.id, name: parent.name } : null,
    childCount: facilityStore.childrenOf(f.id).length,
    depth,
    futureBookings: futureBookingCount(f.id, now),
    blackoutActive: blackoutActive(f.id, now),
    approverCount: f.approverIds.length,
  };
}

function toDetail(f: StoredFacility, now: DateTime): AdminFacility {
  const type = facilityStore.type(f.typeId);
  const parent = f.parentId ? facilityStore.get(f.parentId) : undefined;
  const inside = new Set(facilityStore.descendantsOf(f.id).map((d) => d.id));
  return {
    id: f.id,
    name: f.name,
    timeZone: FACILITY_TIME_ZONE,
    code: f.code,
    type: {
      id: f.typeId,
      name: type?.name ?? f.typeId,
      capacityApplies: type?.capacityApplies ?? true,
    },
    locality: f.locality,
    shortDescription: f.shortDescription,
    description: f.description,
    status: facilityStore.statusOf(f),
    parentFacility: parent ? { id: parent.id, name: parent.name } : null,
    children: facilityStore
      .childrenOf(f.id)
      .map((c) => ({ id: c.id, name: c.name, status: facilityStore.statusOf(c) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    eligibleParents: facilityStore
      .all()
      .filter((c) => c.id !== f.id && !inside.has(c.id) && !c.archived)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    images: f.images,
    schedule: f.schedule,
    capacity: f.capacity,
    approvers: f.approverIds.flatMap((id) => {
      const member = userStore.get(id);
      return member ? [{ id, name: member.name, email: member.email }] : [];
    }),
    futureBookings: futureBookingCount(f.id, now),
    provisionalFields: [...new Set([...f.baseProvisional, ...f.detailProvisional])].filter(
      (field) => !f.cleared.has(field),
    ),
  };
}

// --- the list -----------------------------------------------------------------------------------

class BadQuery extends Error {}

export function parseAdminListParams(search: URLSearchParams): AdminFacilityListParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const statuses = search.getAll('status');
  for (const status of statuses) {
    if (!ADMIN_FACILITY_STATUSES.includes(status as AdminFacilityStatus)) {
      throw new BadQuery(`"status" must be one of: ${ADMIN_FACILITY_STATUSES.join(', ')}.`);
    }
  }
  const sort = search.get('sort');
  if (sort !== null && !ADMIN_FACILITY_SORTS.includes(sort as AdminFacilitySort)) {
    throw new BadQuery(`"sort" must be one of: ${ADMIN_FACILITY_SORTS.join(', ')}.`);
  }
  return {
    q: search.get('q') ?? undefined,
    type: search.getAll('type'),
    locality: search.getAll('locality'),
    status: statuses as AdminFacilityStatus[],
    structure: search.getAll('structure') as FacilityStructure[],
    sort: (sort as AdminFacilitySort | null) ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

const structureOf = (f: StoredFacility): FacilityStructure =>
  facilityStore.childrenOf(f.id).length > 0 ? 'parent' : f.parentId ? 'child' : 'standalone';

export function listFacilities(params: AdminFacilityListParams, now: DateTime): AdminFacilityList {
  const wanted = params.status?.length ? params.status : (['active', 'unavailable'] as const);
  const words = (params.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);

  const matches = facilityStore
    .all()
    .filter((f) => (wanted as readonly string[]).includes(facilityStore.statusOf(f)))
    .filter((f) => !params.type?.length || params.type.includes(f.typeId))
    .filter((f) => !params.locality?.length || params.locality.includes(f.locality))
    .filter((f) => {
      if (!params.structure?.length) return true;
      const kind = structureOf(f);
      // A mid-level space is both a child and a parent.
      return (
        params.structure.includes(kind) ||
        (kind === 'parent' && !!f.parentId && params.structure.includes('child'))
      );
    })
    .filter((f) => {
      if (words.length === 0) return true;
      const haystack = `${f.name} ${f.code} ${f.locality}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });

  const byName = (a: StoredFacility, b: StoredFacility) => a.name.localeCompare(b.name);
  const rows: AdminFacilityRow[] = [];
  const sort = params.sort ?? 'hierarchy';

  if (sort === 'hierarchy') {
    // Each parent followed by its children. A child whose parent is not in the result stands alone.
    const present = new Set(matches.map((f) => f.id));
    const place = (f: StoredFacility, depth: number) => {
      rows.push(toRow(f, now, depth));
      for (const child of matches.filter((c) => c.parentId === f.id).sort(byName)) {
        place(child, depth + 1);
      }
    };
    for (const root of matches
      .filter((f) => !f.parentId || !present.has(f.parentId))
      .sort(byName)) {
      place(root, 0);
    }
  } else {
    const all = matches.map((f) => toRow(f, now));
    const compare: Record<string, (a: AdminFacilityRow, b: AdminFacilityRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      type: (a, b) => a.type.name.localeCompare(b.type.name) || a.name.localeCompare(b.name),
      locality: (a, b) => a.locality.localeCompare(b.locality) || a.name.localeCompare(b.name),
      status: (a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name),
      '-futureBookings': (a, b) =>
        b.futureBookings - a.futureBookings || a.name.localeCompare(b.name),
    };
    rows.push(...all.sort(compare[sort] ?? compare.name!));
  }

  const size = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * size;
  const live = facilityStore.all().filter((f) => !f.archived);
  return {
    items: rows.slice(start, start + size),
    page,
    pageSize: size,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / size),
    withoutApprover: live.filter((f) => f.approverIds.length === 0).length,
    localities: [...new Set(facilityStore.all().map((f) => f.locality))].sort(),
  };
}

// --- validation ---------------------------------------------------------------------------------

function validateDetails(
  body: Partial<CreateFacilityRequest & UpdateFacilityRequest>,
  existing: StoredFacility | undefined,
): Errors {
  const errors: Errors = {};
  const text = (
    field: 'name' | 'code' | 'locality' | 'shortDescription',
    max: number,
    label: string,
  ) => {
    const value = body[field];
    if (value === undefined && existing) return;
    if (typeof value !== 'string' || value.trim() === '') add(errors, field, `Enter the ${label}.`);
    else if (value.length > max) add(errors, field, `Use ${max} characters or fewer.`);
  };
  text('name', MAX_NAME, 'name');
  text('code', 40, 'code');
  text('locality', 80, 'locality');
  text('shortDescription', MAX_SHORT, 'short description');

  if (typeof body.code === 'string' && body.code.trim() !== '') {
    const clash = facilityStore
      .all()
      .find(
        (f) => f.id !== existing?.id && f.code.toLowerCase() === body.code?.trim().toLowerCase(),
      );
    if (clash) add(errors, 'code', `${clash.name} already uses this code.`);
  }
  if (body.typeId !== undefined || !existing) {
    if (!body.typeId || !facilityStore.type(body.typeId)) add(errors, 'typeId', 'Choose a type.');
  }
  if (typeof body.description === 'string' && body.description.length > MAX_DESCRIPTION) {
    add(errors, 'description', `Use ${MAX_DESCRIPTION} characters or fewer.`);
  }
  return errors;
}

/** A parent that is the facility itself, anything inside it, archived or unknown is refused. */
function validateParent(facilityId: string | undefined, parentId: string | null): Errors {
  const errors: Errors = {};
  if (parentId === null) return errors;
  const parent = facilityStore.get(parentId);
  if (!parent) add(errors, 'parentFacilityId', 'Choose a facility that exists.');
  else if (parent.archived) add(errors, 'parentFacilityId', `${parent.name} is archived.`);
  else if (facilityId !== undefined) {
    if (parentId === facilityId) {
      add(errors, 'parentFacilityId', 'A facility cannot be part of itself.');
    } else if (facilityStore.descendantsOf(facilityId).some((d) => d.id === parentId)) {
      add(
        errors,
        'parentFacilityId',
        `${parent.name} is inside this facility, so it cannot also contain it.`,
      );
    }
  }
  return errors;
}

function validateSchedule(body: unknown): Errors {
  const errors: Errors = {};
  const schedule = body as Partial<FacilitySchedule> | null;
  if (!schedule || !Array.isArray(schedule.days) || schedule.days.length !== 7) {
    add(errors, 'days', 'Give hours for all seven days.');
    return errors;
  }
  schedule.days.forEach((day, index) => {
    const label = `days.${index}`;
    if (day.dayOfWeek !== index + 1) add(errors, label, 'Days run from Monday to Sunday.');
    const open = day.opensAt;
    const close = day.closesAt;
    if ((open === null) !== (close === null)) {
      add(errors, label, 'Give both an opening and a closing time, or mark the day closed.');
    } else if (open !== null && close !== null) {
      if (!HH_MM.test(open) || !HH_MM.test(close)) add(errors, label, 'Use times like 08:00.');
      else if (close <= open) add(errors, label, 'Closing time must be after opening time.');
    }
  });
  const whole = (field: keyof FacilitySchedule, min: number, label: string) => {
    const value = schedule[field];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      add(errors, field, `${label} must be a whole number, ${min} or more.`);
    }
  };
  whole('setupMinutes', 0, 'Set-up time');
  whole('teardownMinutes', 0, 'Clear-down time');
  whole('minimumNoticeHours', 0, 'Minimum notice');
  whole('maximumHorizonDays', 1, 'Booking horizon');
  return errors;
}

function validateCapacity(body: unknown, facility: StoredFacility): Errors {
  const errors: Errors = {};
  const capacity = body as Partial<FacilityCapacity> | null;
  if (!capacity || !Array.isArray(capacity.byArrangement)) {
    add(errors, 'byArrangement', 'Give the capacity for each seating arrangement.');
    return errors;
  }
  const applies = facilityStore.type(facility.typeId)?.capacityApplies ?? true;
  if (!applies && (capacity.maximum !== null || capacity.byArrangement.length > 0)) {
    add(errors, 'maximum', 'Capacity does not apply to this type of facility.');
  }
  if (
    capacity.maximum !== null &&
    (typeof capacity.maximum !== 'number' ||
      !Number.isInteger(capacity.maximum) ||
      capacity.maximum < 1)
  ) {
    add(errors, 'maximum', 'Enter a whole number of people, 1 or more.');
  }
  const seen = new Set<string>();
  capacity.byArrangement.forEach((row, index) => {
    const name = typeof row.arrangement === 'string' ? row.arrangement.trim() : '';
    if (name === '') add(errors, `byArrangement.${index}`, 'Choose a seating arrangement.');
    else if (
      !referenceStore
        .active('seating_arrangement')
        .some((r) => r.name.toLowerCase() === name.toLowerCase()) &&
      !facility.capacity.byArrangement.some(
        (c) => c.arrangement.toLowerCase() === name.toLowerCase(),
      )
    ) {
      add(
        errors,
        `byArrangement.${index}`,
        `${name} is not a seating arrangement that can be chosen.`,
      );
    } else if (seen.has(name.toLowerCase())) {
      add(errors, `byArrangement.${index}`, `${name} is listed twice.`);
    }
    seen.add(name.toLowerCase());
    if (!Number.isInteger(row.capacity) || row.capacity < 1) {
      add(errors, `byArrangement.${index}`, 'Enter a whole number of people, 1 or more.');
    } else if (
      capacity.maximum !== null &&
      capacity.maximum !== undefined &&
      row.capacity > capacity.maximum
    ) {
      add(
        errors,
        `byArrangement.${index}`,
        `${name} cannot seat more than the maximum of ${capacity.maximum}.`,
      );
    }
  });
  return errors;
}

// --- handlers -----------------------------------------------------------------------------------

export interface AdminHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  fail?: () => boolean;
  /** Called before every request, so the estate is the right fixture. */
  ready?: () => void;
}

/** base64 of some bytes, in a browser or in Node. */
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function createAdminFacilityHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), fail, ready }: AdminHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());

  /** Every admin endpoint: refuse the wrong people, fail on demand, find the facility. */
  const admin =
    (
      handle: (context: {
        request: Request;
        facility: StoredFacility;
        params: Record<string, unknown>;
      }) => Response | Promise<Response>,
      { needsFacility = true }: { needsFacility?: boolean } = {},
    ) =>
    async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      await wait();
      ready?.();
      const refused = requireAdmin(request, 'facilities');
      if (refused) return refused;
      if (fail?.()) return problem(500, 'Mock failure', 'The facilities service is unavailable.');
      const facility = needsFacility ? facilityStore.get(String(params.id)) : undefined;
      if (needsFacility && !facility) return notFound();
      return handle({ request, facility: facility as StoredFacility, params });
    };

  const editable = (facility: StoredFacility) =>
    facility.archived
      ? problem(409, 'Facility is archived', 'Restore it before changing it.')
      : null;

  return [
    // --- facility types -------------------------------------------------------------------------
    http.get(
      `${root}/admin/facility-types`,
      admin(
        () =>
          HttpResponse.json(
            facilityStore
              .types()
              .map((t): FacilityType => ({
                ...t,
                facilityCount: facilityStore.all().filter((f) => f.typeId === t.id).length,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          ),
        { needsFacility: false },
      ),
    ),

    http.post(
      `${root}/admin/facility-types`,
      admin(
        async ({ request }) => {
          const body = (await request.json()) as Partial<CreateFacilityTypeRequest>;
          const name = body.name?.trim() ?? '';
          if (name === '') return invalid({ name: ['Enter a name for the type.'] });
          if (facilityStore.types().some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            return invalid({ name: [`There is already a type called ${name}.`] });
          }
          const type = {
            id: facilityStore.newFacilityId(name),
            name,
            capacityApplies: body.capacityApplies !== false,
          };
          facilityStore.setType(type);
          return HttpResponse.json({ ...type, facilityCount: 0 }, { status: 201 });
        },
        { needsFacility: false },
      ),
    ),

    http.patch(
      `${root}/admin/facility-types/:id`,
      admin(
        async ({ request, params }) => {
          const type = facilityStore.type(String(params.id));
          if (!type) return problem(404, 'Facility type not found');
          const body = (await request.json()) as Partial<CreateFacilityTypeRequest>;
          const name = body.name === undefined ? type.name : body.name.trim();
          if (name === '') return invalid({ name: ['Enter a name for the type.'] });
          if (
            facilityStore
              .types()
              .some((t) => t.id !== type.id && t.name.toLowerCase() === name.toLowerCase())
          ) {
            return invalid({ name: [`There is already a type called ${name}.`] });
          }
          const updated = {
            ...type,
            name,
            capacityApplies: body.capacityApplies ?? type.capacityApplies,
          };
          facilityStore.setType(updated);
          return HttpResponse.json({
            ...updated,
            facilityCount: facilityStore.all().filter((f) => f.typeId === type.id).length,
          });
        },
        { needsFacility: false },
      ),
    ),

    http.get(
      `${root}/admin/approver-candidates`,
      admin(() => HttpResponse.json(approverCandidates()), { needsFacility: false }),
    ),

    // --- facilities -----------------------------------------------------------------------------
    http.get(
      `${root}/admin/facilities`,
      admin(
        ({ request }) => {
          try {
            const params = parseAdminListParams(new URL(request.url).searchParams);
            return HttpResponse.json(listFacilities(params, now()));
          } catch (error) {
            if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
            throw error;
          }
        },
        { needsFacility: false },
      ),
    ),

    http.post(
      `${root}/admin/facilities`,
      admin(
        async ({ request }) => {
          const body = (await request.json()) as Partial<CreateFacilityRequest>;
          const errors = {
            ...validateDetails(body, undefined),
            ...validateParent(undefined, body.parentFacilityId ?? null),
          };
          if (Object.keys(errors).length > 0) return invalid(errors);

          const f: StoredFacility = {
            id: facilityStore.newFacilityId(body.name ?? ''),
            name: (body.name ?? '').trim(),
            code: (body.code ?? '').trim(),
            typeId: body.typeId ?? '',
            locality: (body.locality ?? '').trim(),
            shortDescription: (body.shortDescription ?? '').trim(),
            description: body.description ?? '',
            // Nobody approves for it yet, so it cannot be active.
            status: 'unavailable',
            archived: false,
            parentId: body.parentFacilityId ?? null,
            images: [],
            schedule: {
              days: Array.from({ length: 7 }, (_, i) => ({
                dayOfWeek: i + 1,
                opensAt: i < 5 ? '08:00' : null,
                closesAt: i < 5 ? '16:30' : null,
              })),
              setupMinutes: 0,
              teardownMinutes: 0,
              minimumNoticeHours: 48,
              maximumHorizonDays: 90,
            },
            capacity: { maximum: null, byArrangement: [] },
            approverIds: [],
            blackouts: [],
            baseProvisional: [],
            // Resources and notes are invented until the resources slice replaces them.
            detailProvisional: ['resources', 'bookingNotes', 'managedBy'],
            cleared: new Set(),
          };
          facilityStore.set(f);
          return HttpResponse.json(toDetail(f, now()), { status: 201 });
        },
        { needsFacility: false },
      ),
    ),

    http.get(
      `${root}/admin/facilities/:id`,
      admin(({ facility }) => HttpResponse.json(toDetail(facility, now()))),
    ),

    http.patch(
      `${root}/admin/facilities/:id`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const body = (await request.json()) as UpdateFacilityRequest;
        const errors: Errors = validateDetails(body, facility);
        if (body.parentFacilityId !== undefined) {
          Object.assign(errors, validateParent(facility.id, body.parentFacilityId));
        }
        if (
          body.status !== undefined &&
          body.status !== 'active' &&
          body.status !== 'unavailable'
        ) {
          add(errors, 'status', 'Choose active or unavailable.');
        }
        if (body.status === 'active' && facility.approverIds.length === 0) {
          add(
            errors,
            'status',
            'Designate at least one approver before activating this facility. Until then requests for it would reach nobody.',
          );
        }
        if (Object.keys(errors).length > 0) return invalid(errors);

        const updated: StoredFacility = {
          ...facility,
          name: body.name?.trim() ?? facility.name,
          code: body.code?.trim() ?? facility.code,
          typeId: body.typeId ?? facility.typeId,
          locality: body.locality?.trim() ?? facility.locality,
          shortDescription: body.shortDescription?.trim() ?? facility.shortDescription,
          description: body.description ?? facility.description,
          status: body.status ?? facility.status,
          parentId: body.parentFacilityId === undefined ? facility.parentId : body.parentFacilityId,
          cleared: new Set(facility.cleared),
        };
        const touched = (...fields: Array<keyof UpdateFacilityRequest>) =>
          fields.some((field) => body[field] !== undefined);
        if (touched('code', 'typeId', 'locality', 'shortDescription', 'description', 'status')) {
          facilityStore.confirm(updated, [
            'code',
            'type',
            'locality',
            'shortDescription',
            'description',
            'status',
          ]);
        }
        if (touched('parentFacilityId')) {
          facilityStore.confirm(updated, [
            'parentFacility',
            'childFacilities',
            'siblingFacilities',
          ]);
        }
        facilityStore.set(updated);
        return HttpResponse.json(toDetail(updated, now()));
      }),
    ),

    // What a proposed change would reach. Decides nothing.
    http.post(
      `${root}/admin/facilities/:id/impact`,
      admin(async ({ request, facility }) => {
        const change = (await request.json()) as ProposedChange;
        if (change.kind === 'hierarchy') {
          const errors = validateParent(facility.id, change.parentFacilityId);
          if (Object.keys(errors).length > 0) return invalid(errors);
        }
        if (change.kind === 'schedule') {
          const errors = validateSchedule(change.schedule);
          if (Object.keys(errors).length > 0) return invalid(errors);
        }
        if (change.kind === 'blackout') {
          const errors = validateBlackout(change.blackout, now());
          if (Object.keys(errors).length > 0) return invalid(errors);
        }
        if (change.kind === 'capacity') {
          const errors = validateCapacity(change.capacity, facility);
          if (Object.keys(errors).length > 0) return invalid(errors);
        }
        return HttpResponse.json(computeImpact(facility.id, change, now(), arrangementName));
      }),
    ),

    http.post(
      `${root}/admin/facilities/:id/archive`,
      admin(({ facility }) => {
        if (facility.archived) return problem(409, 'Already archived');
        const inside = facilityStore.childrenOf(facility.id).filter((c) => !c.archived);
        if (inside.length > 0) {
          return problem(
            409,
            'It still contains other facilities',
            `Archive or move ${inside.map((c) => c.name).join(', ')} first.`,
          );
        }
        facilityStore.set({ ...facility, archived: true });
        return HttpResponse.json(toDetail({ ...facility, archived: true }, now()));
      }),
    ),

    http.post(
      `${root}/admin/facilities/:id/restore`,
      admin(({ facility }) => {
        if (!facility.archived) return problem(409, 'Not archived');
        const parent = facility.parentId ? facilityStore.get(facility.parentId) : undefined;
        if (parent?.archived) {
          return problem(409, 'Its parent is archived', `Restore ${parent.name} first.`);
        }
        // It comes back unavailable: reopening it is a decision of its own.
        const restored: StoredFacility = { ...facility, archived: false, status: 'unavailable' };
        facilityStore.set(restored);
        return HttpResponse.json(toDetail(restored, now()));
      }),
    ),

    // --- schedule -------------------------------------------------------------------------------
    http.put(
      `${root}/admin/facilities/:id/schedule`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const body = (await request.json()) as FacilitySchedule;
        const errors = validateSchedule(body);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const updated: StoredFacility = {
          ...facility,
          schedule: {
            days: body.days.map((d) => ({
              dayOfWeek: d.dayOfWeek,
              opensAt: d.opensAt,
              closesAt: d.closesAt,
            })),
            setupMinutes: body.setupMinutes,
            teardownMinutes: body.teardownMinutes,
            minimumNoticeHours: body.minimumNoticeHours,
            maximumHorizonDays: body.maximumHorizonDays,
          },
          cleared: new Set(facility.cleared),
        };
        facilityStore.confirm(updated, ['operatingSchedule']);
        facilityStore.set(updated);
        return HttpResponse.json(updated.schedule);
      }),
    ),

    // --- blackouts ------------------------------------------------------------------------------
    http.get(
      `${root}/admin/facilities/:id/blackouts`,
      admin(({ facility }) => {
        const current = now();
        const list = facilityStore.effectiveBlackouts(facility.id).map((b): AdminBlackout => ({
          id: b.id,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          allDay: b.allDay,
          reason: b.reason,
          inheritedFrom: b.from.id === facility.id ? null : { id: b.from.id, name: b.from.name },
          state: blackoutState(b.startsAt, b.endsAt, current),
        }));
        return HttpResponse.json(list.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      }),
    ),

    http.post(
      `${root}/admin/facilities/:id/blackouts`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const body = (await request.json()) as CreateBlackoutRequest;
        const errors = validateBlackout(body, now());
        if (Object.keys(errors).length > 0) return invalid(errors);
        const blackout = {
          id: facilityStore.nextId('bo'),
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          allDay: body.allDay,
          reason: body.reason.trim(),
        };
        facilityStore.set({ ...facility, blackouts: [...facility.blackouts, blackout] });
        return HttpResponse.json(
          {
            ...blackout,
            inheritedFrom: null,
            state: blackoutState(blackout.startsAt, blackout.endsAt, now()),
          } satisfies AdminBlackout,
          { status: 201 },
        );
      }),
    ),

    http.delete(
      `${root}/admin/facilities/:id/blackouts/:blackoutId`,
      admin(({ facility, params }) => {
        const found = facility.blackouts.find((b) => b.id === params.blackoutId);
        if (!found) return problem(404, 'Blackout not found');
        if (blackoutState(found.startsAt, found.endsAt, now()) !== 'future') {
          return problem(
            409,
            'That blackout has already started',
            'Only a blackout that has not started yet can be deleted. One that has started is history.',
          );
        }
        facilityStore.set({
          ...facility,
          blackouts: facility.blackouts.filter((b) => b.id !== found.id),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // --- images ---------------------------------------------------------------------------------
    http.post(
      `${root}/admin/facilities/:id/images`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const form = await request.formData();
        const entry = form.get('file');
        const caption = String(form.get('caption') ?? '').trim();
        const errors: Errors = {};
        if (caption === '') {
          add(
            errors,
            'caption',
            'Describe the image. This text is read aloud to people who cannot see it.',
          );
        }
        // Duck typed: the server's File and the test environment's are different classes.
        if (entry === null || typeof entry === 'string')
          add(errors, 'file', 'Choose an image to upload.');
        if (Object.keys(errors).length > 0) return invalid(errors);

        const file = entry as unknown as File;
        const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
        const accepted = IMAGE_RULES.acceptedTypes.find((t) => t.extension === extension);
        if (!accepted) return invalid({ file: [`${file.name} is not an accepted image type.`] });
        if (file.size > IMAGE_RULES.maxFileSizeBytes) {
          return invalid({ file: [`${file.name} is larger than the size limit.`] });
        }
        if (facility.images.length >= IMAGE_RULES.maxImages) {
          return invalid({
            file: [`A facility can have at most ${IMAGE_RULES.maxImages} images.`],
          });
        }
        if (file.name.toLowerCase().includes('fail')) {
          return problem(500, 'Upload failed', 'The image could not be stored. Please try again.');
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const image = {
          id: facilityStore.nextId('img'),
          url: `data:${accepted.contentType};base64,${base64(bytes)}`,
          caption,
          isPrimary: facility.images.length === 0,
        };
        facilityStore.set({ ...facility, images: [...facility.images, image] });
        return HttpResponse.json(image, { status: 201 });
      }),
    ),

    http.patch(
      `${root}/admin/facilities/:id/images/:imageId`,
      admin(async ({ request, facility, params }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const image = facility.images.find((i) => i.id === params.imageId);
        if (!image) return problem(404, 'Image not found');
        const body = (await request.json()) as UpdateImageRequest;
        if (body.caption !== undefined && body.caption.trim() === '') {
          return invalid({
            caption: ['Describe the image. It cannot be left without a description.'],
          });
        }
        let images = facility.images.map((i) =>
          i.id === image.id ? { ...i, caption: body.caption?.trim() ?? i.caption } : i,
        );
        if (body.isPrimary) images = images.map((i) => ({ ...i, isPrimary: i.id === image.id }));
        if (body.position !== undefined) {
          const moving = images.find((i) => i.id === image.id);
          if (moving) {
            const rest = images.filter((i) => i.id !== image.id);
            const at = Math.min(Math.max(0, body.position), rest.length);
            images = [...rest.slice(0, at), moving, ...rest.slice(at)];
          }
        }
        facilityStore.set({ ...facility, images });
        return HttpResponse.json(images.find((i) => i.id === image.id));
      }),
    ),

    http.delete(
      `${root}/admin/facilities/:id/images/:imageId`,
      admin(({ facility, params }) => {
        const locked = editable(facility);
        if (locked) return locked;
        if (!facility.images.some((i) => i.id === params.imageId))
          return problem(404, 'Image not found');
        const images = facility.images.filter((i) => i.id !== params.imageId);
        // If the primary image went, the first remaining one takes over.
        const first = images[0];
        if (first && !images.some((i) => i.isPrimary)) first.isPrimary = true;
        facilityStore.set({ ...facility, images });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // --- capacity and approvers -----------------------------------------------------------------
    http.put(
      `${root}/admin/facilities/:id/capacity`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const body = (await request.json()) as FacilityCapacity;
        const errors = validateCapacity(body, facility);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const updated: StoredFacility = {
          ...facility,
          capacity: {
            maximum: body.maximum,
            byArrangement: body.byArrangement.map((c) => ({
              arrangement: c.arrangement.trim(),
              capacity: c.capacity,
            })),
          },
          cleared: new Set(facility.cleared),
        };
        facilityStore.confirm(updated, ['capacity', 'capacityByArrangement']);
        facilityStore.set(updated);
        return HttpResponse.json(updated.capacity);
      }),
    ),

    http.put(
      `${root}/admin/facilities/:id/approvers`,
      admin(async ({ request, facility }) => {
        const locked = editable(facility);
        if (locked) return locked;
        const body = (await request.json()) as { userIds?: unknown };
        const ids = Array.isArray(body.userIds) ? [...new Set(body.userIds.map(String))] : null;
        const known = new Set(approverCandidates().map((c) => c.id));
        if (!ids || ids.some((id) => !known.has(id))) {
          return invalid({ userIds: ['Choose from the people who can approve bookings.'] });
        }
        if (ids.length === 0 && facility.status === 'active') {
          return invalid({
            userIds: [
              'An active facility needs at least one approver, or requests for it reach nobody. Make it unavailable first.',
            ],
          });
        }
        const before = facility.approverIds;
        const updated = { ...facility, approverIds: ids };
        facilityStore.set(updated);
        // The same relationship is edited from the user side, so each user it touches has it recorded.
        for (const userId of new Set([...before, ...ids])) {
          const was = designationsOf(userId).map((f) => f.id);
          recordDesignationChange(
            userId,
            before.includes(userId) === ids.includes(userId)
              ? was
              : ids.includes(userId)
                ? was.filter((id) => id !== facility.id)
                : [...was, facility.id],
            was,
            userIdOf(request),
            now(),
            `Changed from ${facility.name}`,
          );
        }
        return HttpResponse.json(toDetail(updated, now()).approvers);
      }),
    ),
  ];

  function validateBlackout(body: Partial<CreateBlackoutRequest>, current: DateTime): Errors {
    const errors: Errors = {};
    if (!validInstant(body.startsAt) || !validInstant(body.endsAt)) {
      add(errors, 'startsAt', 'Choose when the closure starts and ends.');
      return errors;
    }
    if (iso(body.endsAt) <= iso(body.startsAt))
      add(errors, 'endsAt', 'The end must be after the start.');
    if (iso(body.endsAt) <= current)
      add(errors, 'startsAt', 'A closure cannot be wholly in the past.');
    if (typeof body.reason !== 'string' || body.reason.trim() === '') {
      add(errors, 'reason', 'Say why, in a sentence the public will understand.');
    } else if (body.reason.length > MAX_REASON) {
      add(errors, 'reason', `Use ${MAX_REASON} characters or fewer.`);
    }
    return errors;
  }
}
