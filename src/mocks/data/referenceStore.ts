/**
 * The mock's reference data: the seating arrangements and event types the booking form offers.
 * PROVISIONAL: the municipality has not supplied either list (see docs/facilities-data-gaps.md).
 * Archived entries leave the booking form and keep their names on the bookings that used them.
 */
import { slugify } from './slug';

export type ReferenceKind = 'seating_arrangement' | 'event_type';

export interface StoredReference {
  id: string;
  name: string;
  displayOrder: number;
  archived: boolean;
}

const SEATING: Array<[string, string]> = [
  ['cinema', 'Cinema'],
  ['banquet', 'Banquet'],
  ['school-room', 'School room'],
  ['u-shape', 'U-shape'],
  ['boardroom', 'Boardroom'],
  ['open-floor', 'Open floor'],
];

const EVENT_TYPES: Array<[string, string]> = [
  ['meeting', 'Meeting'],
  ['workshop', 'Workshop or training'],
  ['conference', 'Conference'],
  ['wedding', 'Wedding'],
  ['family-function', 'Birthday or family function'],
  ['memorial', 'Funeral or memorial service'],
  ['religious', 'Church or community gathering'],
  ['fundraiser', 'Fundraiser'],
  ['other', 'Other'],
];

const lists: Record<ReferenceKind, Map<string, StoredReference>> = {
  seating_arrangement: new Map(),
  event_type: new Map(),
};

function seed() {
  const fill = (kind: ReferenceKind, rows: Array<[string, string]>) => {
    lists[kind].clear();
    rows.forEach(([id, name], index) =>
      lists[kind].set(id, { id, name, displayOrder: (index + 1) * 10, archived: false }),
    );
  };
  fill('seating_arrangement', SEATING);
  fill('event_type', EVENT_TYPES);
}
seed();

const ordered = (items: StoredReference[]) =>
  [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

export const referenceStore = {
  all: (kind: ReferenceKind): StoredReference[] => ordered([...lists[kind].values()]),
  active: (kind: ReferenceKind): StoredReference[] =>
    ordered([...lists[kind].values()].filter((r) => !r.archived)),
  archived: (kind: ReferenceKind): StoredReference[] =>
    ordered([...lists[kind].values()].filter((r) => r.archived)),
  get: (kind: ReferenceKind, id: string): StoredReference | undefined => lists[kind].get(id),
  /** The name, whether or not the entry has since been archived. */
  nameOf: (kind: ReferenceKind, id: string | null): string | null =>
    (id && lists[kind].get(id)?.name) || null,
  set: (kind: ReferenceKind, entry: StoredReference) => lists[kind].set(entry.id, entry),
  newId(kind: ReferenceKind, name: string): string {
    const base = slugify(name) || kind;
    let id = base;
    for (let n = 2; lists[kind].has(id); n += 1) id = `${base}-${n}`;
    return id;
  },
  nextOrder: (kind: ReferenceKind) =>
    Math.max(0, ...[...lists[kind].values()].map((r) => r.displayOrder)) + 10,
  reset: seed,
};

export function resetReferenceStore() {
  referenceStore.reset();
}
