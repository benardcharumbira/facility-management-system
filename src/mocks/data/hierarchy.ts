import type { FacilitySummary } from '@/shared/api';

/** The chain of containing facilities, nearest first. */
export function ancestorsOf(facility: FacilitySummary, catalogue: readonly FacilitySummary[]) {
  const chain: FacilitySummary[] = [];
  let parentId = facility.parentFacility?.id;
  while (parentId !== undefined) {
    const parent = catalogue.find((f) => f.id === parentId);
    if (!parent || chain.includes(parent)) break;
    chain.push(parent);
    parentId = parent.parentFacility?.id;
  }
  return chain;
}

export type Relationship = 'same_facility' | 'parent' | 'child';

/**
 * How `other` relates to `facility`: the same, containing it (`parent`, at any depth) or inside it
 * (`child`). Null where they share no space. The client never works this out; the server does.
 */
export function relationOf(
  facility: FacilitySummary,
  other: FacilitySummary,
  catalogue: readonly FacilitySummary[],
): Relationship | null {
  if (facility.id === other.id) return 'same_facility';
  if (ancestorsOf(facility, catalogue).some((a) => a.id === other.id)) return 'parent';
  if (ancestorsOf(other, catalogue).some((a) => a.id === facility.id)) return 'child';
  return null;
}
