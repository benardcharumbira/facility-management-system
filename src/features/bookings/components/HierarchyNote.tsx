import { Layers } from 'lucide-react';
import type { FacilityDetail } from '@/shared/api';
import { joinNames } from '@/shared/utils/format';

/** What this request takes with it, in plain words, where the venue is part of a hierarchy. */
export function HierarchyNote({ facility }: { facility: FacilityDetail }) {
  const { childFacilities, parentFacility, name } = facility;

  let text: string | null = null;
  if (childFacilities.length > 0) {
    text = `This request covers ${name}, which includes ${joinNames(childFacilities.map((c) => c.name))}. Booking the whole venue takes all of them.`;
  } else if (parentFacility) {
    text = `${name} is part of ${parentFacility.name}. The other spaces there stay available, but the whole of ${parentFacility.name} cannot be booked at the same time as ${name}.`;
  }
  if (!text) return null;

  return (
    <p className="flex items-start gap-2 rounded-lg border border-primary-line bg-primary-soft p-3">
      <Layers aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <span>{text}</span>
    </p>
  );
}
