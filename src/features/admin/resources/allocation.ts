import type { AllocationChange, AllocationValue } from '@/shared/api';

/** Unsaved edits to the grid, keyed by facility and resource. Only cells that differ from the saved value. */
export type Edits = Record<string, AllocationValue>;
export type Base = ReadonlyMap<string, AllocationValue>;

export const keyOf = (facilityId: string, resourceId: string) => `${facilityId}|${resourceId}`;

export function baseOf(
  allocations: Array<{ facilityId: string; resourceId: string; value: AllocationValue }>,
): Base {
  return new Map(allocations.map((a) => [keyOf(a.facilityId, a.resourceId), a.value]));
}

/** What a cell shows: the unsaved edit if there is one, else what is saved. */
export function valueAt(
  edits: Edits,
  base: Base,
  facilityId: string,
  resourceId: string,
): AllocationValue {
  const key = keyOf(facilityId, resourceId);
  return key in edits ? (edits[key] as AllocationValue) : (base.get(key) ?? false);
}

/** Sets a cell. Setting it back to its saved value is no longer a change. */
export function withEdit(
  edits: Edits,
  base: Base,
  facilityId: string,
  resourceId: string,
  value: AllocationValue,
): Edits {
  const key = keyOf(facilityId, resourceId);
  const next = { ...edits };
  if (base.get(key) === value) delete next[key];
  else next[key] = value;
  return next;
}

export interface Resource {
  id: string;
  quantified: boolean;
}

/** One resource across the facilities given: the same count, or available or not. */
export function fillRow(
  edits: Edits,
  base: Base,
  resource: Resource,
  facilityIds: string[],
  value: AllocationValue,
): Edits {
  const kind = resource.quantified ? Number(value) : Boolean(value);
  return facilityIds.reduce((all, id) => withEdit(all, base, id, resource.id, kind), edits);
}

/**
 * One facility across the resources given. Counted resources get the number, the others get
 * available or not, since one value cannot mean both.
 */
export function fillColumn(
  edits: Edits,
  base: Base,
  facilityId: string,
  resources: Resource[],
  { count, available }: { count: number; available: boolean },
): Edits {
  return resources.reduce(
    (all, r) => withEdit(all, base, facilityId, r.id, r.quantified ? count : available),
    edits,
  );
}

/** One facility's values copied to another, for the resources given. */
export function copyColumn(
  edits: Edits,
  base: Base,
  from: string,
  to: string,
  resources: Resource[],
): Edits {
  return resources.reduce(
    (all, r) => withEdit(all, base, to, r.id, valueAt(edits, base, from, r.id)),
    edits,
  );
}

/** The batch to send: every edit as a facility, resource and value. */
export function toChanges(edits: Edits): AllocationChange[] {
  return Object.entries(edits).map(([key, value]) => {
    const [facilityId = '', resourceId = ''] = key.split('|');
    return { facilityId, resourceId, value };
  });
}
