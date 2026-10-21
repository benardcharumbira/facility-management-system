/**
 * The mock's facility estate. Seeded from the fixture, then changed through the admin API, and
 * read by every public facility endpoint, the availability engine and the booking handlers, so a
 * change made in administration shows everywhere. Lost on reload, like any mock.
 */
import { DateTime } from 'luxon';
import type {
  AdminFacilityImage,
  AdminFacilityStatus,
  FacilityCapacity,
  FacilityDetail,
  FacilitySchedule,
  FacilitySummary,
  OperatingDay,
} from '@/shared/api';
import { MOCK_AVAILABILITY_RULES } from '../availabilityRules';
import { bookingStore } from './bookingStore';
import { deriveDetail } from './facilityDetail';
import { REAL_FACILITIES } from './facilities.real';
import { resourceStore } from './resourceStore';
import { slugify } from './slug';

export interface StoredBlackout {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason: string;
}

export interface StoredType {
  id: string;
  name: string;
  capacityApplies: boolean;
}

export interface StoredFacility {
  id: string;
  name: string;
  code: string;
  typeId: string;
  locality: string;
  shortDescription: string;
  description: string;
  status: 'active' | 'unavailable';
  archived: boolean;
  parentId: string | null;
  images: AdminFacilityImage[];
  schedule: FacilitySchedule;
  capacity: FacilityCapacity;
  approverIds: string[];
  blackouts: StoredBlackout[];
  /** What the fixture called provisional, and which of it an administrator has since replaced. */
  baseProvisional: string[];
  detailProvisional: string[];
  cleared: Set<string>;
}

/** What the availability engine needs to know about one facility. */
export interface FacilitySettings {
  schedule: OperatingDay[];
  setupMinutes: number;
  teardownMinutes: number;
  minimumNoticeHours: number;
  maximumHorizonDays: number;
  /** This facility's own blackouts and those inherited from its parents. */
  blackouts: Array<{ startsAt: DateTime; endsAt: DateTime; reason: string }>;
}

/**
 * Who approves for what, in the fixture. PROVISIONAL. The Activity Room, Bantu Bonke Hall and the
 * Council Chambers deliberately have nobody, so the "no approver" problem is visible.
 */
const DEFAULT_APPROVERS: Record<string, string[]> = {
  'city-hall': ['mock-approver-1'],
  'mitchell-wing': ['mock-approver-1'],
  'loch-wing': ['mock-approver-1'],
  'city-hall-committee-room': ['mock-approver-1', 'approver-partial'],
  'rothdene-hall': ['mock-approver-1'],
  'lakeside-hall': ['mock-approver-1'],
  'vaal-marina-hall': ['approver-vaal'],
  'vaal-marina-board-room': ['approver-vaal'],
  'sicelo-hall': ['approver-empty'],
};

const facilities = new Map<string, StoredFacility>();
const types = new Map<string, StoredType>();
let seededWith = '';
let counter = 0;

function seedType(id: string, name: string, capacityApplies = true) {
  if (!types.has(id)) types.set(id, { id, name, capacityApplies });
}

function seedFacility(summary: FacilitySummary, catalogue: readonly FacilitySummary[]) {
  const detail = deriveDetail(summary, catalogue);
  seedType(summary.type.id, summary.type.name);
  facilities.set(summary.id, {
    id: summary.id,
    name: summary.name,
    code: summary.code,
    typeId: summary.type.id,
    locality: summary.locality,
    shortDescription: summary.shortDescription,
    description: detail.description,
    status: summary.status,
    archived: false,
    parentId: summary.parentFacility?.id ?? null,
    images: [],
    schedule: {
      days: detail.operatingSchedule.map((d) => ({ ...d })),
      // No buffer until an administrator sets one.
      setupMinutes: 0,
      teardownMinutes: 0,
      minimumNoticeHours: MOCK_AVAILABILITY_RULES.minimumNoticeHours,
      maximumHorizonDays: MOCK_AVAILABILITY_RULES.maximumHorizonDays,
    },
    capacity: {
      maximum: summary.capacity,
      byArrangement: (detail.capacityByArrangement ?? []).map((c) => ({ ...c })),
    },
    approverIds: [...(DEFAULT_APPROVERS[summary.id] ?? [])],
    blackouts: [],
    baseProvisional: [...(summary.provisionalFields ?? [])],
    detailProvisional: [...detail.provisionalFields],
    cleared: new Set(),
  });
}

export const facilityStore = {
  /** Replaces the estate with a fixture. Called when the handlers are created, and on reset. */
  seed(catalogue: readonly FacilitySummary[], name = 'real') {
    seededWith = name;
    facilities.clear();
    types.clear();
    counter = 0;
    for (const summary of catalogue) seedFacility(summary, catalogue);
    resourceStore.seed(catalogue);
    seedType('open-space', 'Open space', false);
  },
  /**
   * Makes sure the estate is the named fixture, seeding it if another was loaded. Each set of
   * handlers calls this before it reads, so two sets built for different fixtures do not trample
   * each other's estate.
   */
  ensure(name: string, catalogue: readonly FacilitySummary[]) {
    if (seededWith !== name) this.seed(catalogue, name);
  },
  /** Back to the confirmed Midvaal venues, undoing every change. */
  reset() {
    this.seed(REAL_FACILITIES, 'real');
  },

  all: (): StoredFacility[] => [...facilities.values()],
  get: (id: string): StoredFacility | undefined => facilities.get(id),
  set: (facility: StoredFacility) => facilities.set(facility.id, facility),
  types: (): StoredType[] => [...types.values()],
  type: (id: string): StoredType | undefined => types.get(id),
  setType: (type: StoredType) => types.set(type.id, type),
  nextId: (prefix: string) => {
    counter += 1;
    return `${prefix}-${counter}`;
  },

  /** An id for a new facility: its name as a slug, made unique. */
  newFacilityId(name: string): string {
    const base = slugify(name) || 'facility';
    let id = base;
    for (let n = 2; facilities.has(id); n += 1) id = `${base}-${n}`;
    return id;
  },

  childrenOf: (id: string) => [...facilities.values()].filter((f) => f.parentId === id),

  /** Everything inside a facility, at any depth. */
  descendantsOf(id: string): StoredFacility[] {
    const found: StoredFacility[] = [];
    const walk = (parent: string) => {
      for (const child of this.childrenOf(parent)) {
        if (found.includes(child)) continue;
        found.push(child);
        walk(child.id);
      }
    };
    walk(id);
    return found;
  },

  /** The containing facilities, nearest first. */
  ancestorsOf(id: string): StoredFacility[] {
    const chain: StoredFacility[] = [];
    let parent = facilities.get(id)?.parentId;
    while (parent) {
      const found = facilities.get(parent);
      if (!found || chain.includes(found)) break;
      chain.push(found);
      parent = found.parentId;
    }
    return chain;
  },

  statusOf(f: StoredFacility): AdminFacilityStatus {
    return f.archived ? 'archived' : f.status;
  },

  /** What the public sees of a facility, projected from the store. */
  summary(f: StoredFacility): FacilitySummary {
    const parent = f.parentId ? facilities.get(f.parentId) : undefined;
    const primary = f.images.find((i) => i.isPrimary) ?? f.images[0];
    const type = types.get(f.typeId);
    return {
      id: f.id,
      name: f.name,
      code: f.code,
      type: { id: f.typeId, name: type?.name ?? f.typeId },
      parentFacility: parent ? { id: parent.id, name: parent.name } : null,
      capacity: f.capacity.maximum,
      locality: f.locality,
      shortDescription: f.shortDescription,
      primaryImageUrl: primary?.url ?? null,
      amenities: resourceStore.amenitiesOf(f.id),
      status: f.status,
      provisionalFields: f.baseProvisional.filter((field) => !f.cleared.has(field)),
    };
  },

  /** The public estate: archived facilities are gone. */
  publicCatalogue(): FacilitySummary[] {
    return [...facilities.values()].filter((f) => !f.archived).map((f) => this.summary(f));
  },
  /** Every facility, archived included, for looking up the facility of a booking that already exists. */
  allSummaries(): FacilitySummary[] {
    return [...facilities.values()].map((f) => this.summary(f));
  },

  /** The public detail: derived resources and notes, with what administration owns laid over. */
  publicDetail(id: string): FacilityDetail | undefined {
    const f = facilities.get(id);
    if (!f || f.archived) return undefined;
    const catalogue = this.publicCatalogue();
    const summary = this.summary(f);
    const base = deriveDetail(summary, catalogue);
    const primary = f.images.find((i) => i.isPrimary);
    const ordered = primary ? [primary, ...f.images.filter((i) => i !== primary)] : f.images;
    return {
      ...base,
      description: f.description,
      resources: resourceStore.detailResources(f.id),
      images: ordered.map((i) => ({ url: i.url, caption: i.caption })),
      capacityByArrangement: f.capacity.byArrangement.length > 0 ? f.capacity.byArrangement : null,
      operatingSchedule: f.schedule.days,
      provisionalFields: f.detailProvisional.filter((field) => !f.cleared.has(field)),
    };
  },

  /** Marks fields as now real data rather than the fixture's placeholders. */
  confirm(f: StoredFacility, fields: string[]) {
    for (const field of fields) f.cleared.add(field);
  },

  /** Blackouts in effect for a facility: its own, and a parent's, which apply to its children. */
  effectiveBlackouts(id: string): Array<StoredBlackout & { from: StoredFacility }> {
    const chain = [facilities.get(id), ...this.ancestorsOf(id)].filter(
      (f): f is StoredFacility => f !== undefined,
    );
    return chain.flatMap((f) => f.blackouts.map((b) => ({ ...b, from: f })));
  },

  settingsOf(id: string): FacilitySettings | undefined {
    const f = facilities.get(id);
    if (!f) return undefined;
    return {
      schedule: f.schedule.days,
      setupMinutes: f.schedule.setupMinutes,
      teardownMinutes: f.schedule.teardownMinutes,
      minimumNoticeHours: f.schedule.minimumNoticeHours,
      maximumHorizonDays: f.schedule.maximumHorizonDays,
      blackouts: this.effectiveBlackouts(id).map((b) => ({
        startsAt: DateTime.fromISO(b.startsAt, { zone: 'utc' }),
        endsAt: DateTime.fromISO(b.endsAt, { zone: 'utc' }),
        reason: b.reason,
      })),
    };
  },

  /** Approved and pending bookings that have not yet ended. */
  liveBookings(now: DateTime) {
    return bookingStore
      .all()
      .filter(
        ({ booking }) =>
          (booking.status === 'approved' || booking.status === 'pending') &&
          DateTime.fromISO(booking.endsAt, { zone: 'utc' }) > now,
      );
  },
};

export function resetFacilityStore() {
  facilityStore.reset();
}
