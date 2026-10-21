import { Layers } from 'lucide-react';
import type { DecisionContext } from '@/shared/api';
import { joinNames } from '@/shared/utils/format';

/**
 * What approving this takes with it, in words, from the related facilities the server names. The
 * screen reads the list; it never walks the hierarchy itself.
 */
export function HierarchyConsequence({
  facilityName,
  affected,
}: {
  facilityName: string;
  affected: DecisionContext['affectedFacilities'];
}) {
  const inside = affected.filter((f) => f.relationship === 'child').map((f) => f.name);
  const containing = affected.filter((f) => f.relationship === 'parent').map((f) => f.name);
  if (inside.length === 0 && containing.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-primary-line bg-primary-soft p-3">
      <Layers aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex flex-col gap-1">
        {inside.length > 0 && (
          <p>
            Approving this takes {facilityName} and therefore {joinNames(inside)}.
          </p>
        )}
        {containing.length > 0 && (
          <p>
            {facilityName} is part of {joinNames(containing)}. While it is booked,{' '}
            {joinNames(containing)} cannot be booked as a whole.
          </p>
        )}
      </div>
    </div>
  );
}
