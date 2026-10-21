/**
 * The mock's resource catalogue and every facility's allocation of it. Seeded from the fixture (the
 * nineteen resources in section 8.4 of the requirements document, and what each venue holds), then
 * changed through the admin API, and read by the booking form's options, each facility's public
 * resources, its amenities in the browse filters and the approval queue's context.
 */
import type {
  AllocationValue,
  BookingResourceOption,
  FacilityResource,
  FacilitySummary,
  ResourceCategory,
} from '@/shared/api';
import { KITCHEN_ITEMS, UNCOUNTED_VENUE_RESOURCES, deriveDetail } from './facilityDetail';
import { slugify } from './slug';

export interface StoredResource {
  id: string;
  name: string;
  category: ResourceCategory;
  quantified: boolean;
  description: string | null;
  archived: boolean;
}

/**
 * Section 8.4 of the Business Requirements Document v2.0: the resources the booking form captures.
 * The names are confirmed; whether each is counted, and the rest, is inferred. Both "Dining forks"
 * and "Forks" are listed there, so both are seeded and the question is raised, not resolved.
 */
const VENUE: Array<[string, string]> = [
  ['tables', 'Tables'],
  ['chairs', 'Chairs'],
  ['stage', 'Stage'],
  ['podium', 'Podium'],
  ['sound-system', 'Sound system'],
];

const catalogue = new Map<string, StoredResource>();
/** facility id, then resource id, then how much. */
const allocations = new Map<string, Map<string, AllocationValue>>();

export const seedCatalogue = (): StoredResource[] => [
  ...VENUE.map(([id, name]) => ({
    id,
    name,
    category: 'venue' as const,
    quantified: !UNCOUNTED_VENUE_RESOURCES.has(id),
    description: null,
    archived: false,
  })),
  ...KITCHEN_ITEMS.map((item) => ({
    id: `kitchen-${item.id}`,
    name: item.name,
    category: 'kitchen' as const,
    quantified: true,
    description: null,
    archived: false,
  })),
];

/** What a stored value means for a resource: a count, or present or not. */
function normalise(resource: StoredResource | undefined, value: AllocationValue | undefined) {
  if (resource?.quantified) return typeof value === 'number' ? value : value ? 1 : 0;
  return typeof value === 'number' ? value > 0 : (value ?? false);
}

export const resourceStore = {
  /** Replaces everything: the catalogue from the requirements, the allocations from the fixture. */
  seed(summaries: readonly FacilitySummary[]) {
    catalogue.clear();
    allocations.clear();
    for (const resource of seedCatalogue()) catalogue.set(resource.id, resource);
    for (const summary of summaries) {
      const held = new Map<string, AllocationValue>();
      for (const r of deriveDetail(summary, summaries).resources) {
        held.set(r.id, r.quantified ? (r.quantity ?? 0) : true);
      }
      allocations.set(summary.id, held);
    }
  },

  all: (): StoredResource[] => [...catalogue.values()],
  active: (): StoredResource[] => [...catalogue.values()].filter((r) => !r.archived),
  get: (id: string): StoredResource | undefined => catalogue.get(id),
  set: (resource: StoredResource) => catalogue.set(resource.id, resource),

  newId(name: string): string {
    const base = slugify(name) || 'resource';
    let id = base;
    for (let n = 2; catalogue.has(id); n += 1) id = `${base}-${n}`;
    return id;
  },

  /** How much one facility holds of one resource: a number, or present or not. */
  valueOf(facilityId: string, resourceId: string): AllocationValue {
    return normalise(catalogue.get(resourceId), allocations.get(facilityId)?.get(resourceId));
  },
  setValue(facilityId: string, resourceId: string, value: AllocationValue) {
    const held = allocations.get(facilityId) ?? new Map<string, AllocationValue>();
    held.set(resourceId, value);
    allocations.set(facilityId, held);
  },
  /** A snapshot, so a batch that fails can put everything back. */
  snapshot(): Map<string, Map<string, AllocationValue>> {
    return new Map([...allocations].map(([facility, held]) => [facility, new Map(held)]));
  },
  restore(snapshot: Map<string, Map<string, AllocationValue>>) {
    allocations.clear();
    for (const [facility, held] of snapshot) allocations.set(facility, new Map(held));
  },

  isHeld(facilityId: string, resourceId: string): boolean {
    const value = this.valueOf(facilityId, resourceId);
    return typeof value === 'number' ? value > 0 : value;
  },

  /** The facilities that hold a resource, and how much. */
  holders(resourceId: string): Array<{ facilityId: string; value: AllocationValue }> {
    return [...allocations.keys()]
      .filter((facilityId) => this.isHeld(facilityId, resourceId))
      .map((facilityId) => ({ facilityId, value: this.valueOf(facilityId, resourceId) }));
  },

  /** What the booking form may offer: active resources only. */
  options(): BookingResourceOption[] {
    return this.active().map(({ id, name, category, quantified }) => ({
      id,
      name,
      category,
      quantified,
    }));
  },
  /** Archived resources, so earlier bookings that asked for them still read properly. */
  retired(): BookingResourceOption[] {
    return this.all()
      .filter((r) => r.archived)
      .map(({ id, name, category, quantified }) => ({ id, name, category, quantified }));
  },

  /** A facility's public resources: the active ones it holds. A resource that is simply present counts as 1. */
  detailResources(facilityId: string): FacilityResource[] {
    return this.active()
      .filter((r) => this.isHeld(facilityId, r.id))
      .map((r) => {
        const value = this.valueOf(facilityId, r.id);
        return {
          id: r.id,
          name: r.name,
          category: r.category,
          quantity: typeof value === 'number' ? value : 1,
          quantified: r.quantified,
        };
      });
  },

  /**
   * The amenities browse can filter by: the venue resources a facility holds, and "Kitchen" if it
   * holds any kitchen resource. The vocabulary therefore follows the catalogue.
   */
  amenitiesOf(facilityId: string): Array<{ id: string; name: string }> {
    const active = this.active();
    const venue = active
      .filter((r) => r.category === 'venue' && this.isHeld(facilityId, r.id))
      .map((r) => ({ id: r.id, name: r.name }));
    const kitchen = active.some((r) => r.category === 'kitchen' && this.isHeld(facilityId, r.id));
    return kitchen ? [...venue, { id: 'kitchen', name: 'Kitchen' }] : venue;
  },
};
