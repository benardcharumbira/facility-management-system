import { ShieldAlert } from 'lucide-react';
import type { UserImpactResult } from '@/shared/api';
import { joinNames } from '@/shared/utils/format';

const plural = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

/**
 * The consequence of taking someone off their facilities, in specific terms: which facilities
 * are left with nobody designated and how many pending requests have nobody to decide them.
 * Shown inside the impact dialog, above the requests themselves.
 */
export function StrandedDetails({ name, impact }: { name: string; impact: UserImpactResult }) {
  const left = impact.facilitiesLeftWithoutApprover;
  const removed = impact.designationsRemoved;
  const unrouted = impact.unroutedPendingRequests;
  return (
    <div className="flex flex-col gap-2 text-ink">
      {removed.length > 0 && (
        <p>
          {name} would no longer be designated to approve for{' '}
          {joinNames(removed.map((f) => f.name))}.
        </p>
      )}
      {left.length > 0 && (
        <p className="flex gap-2 font-medium text-danger">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            This leaves {joinNames(left.map((f) => f.name))} with no designated approver
            {unrouted > 0
              ? `, and ${plural(unrouted, 'pending request', 'pending requests')} with nobody to decide ${unrouted === 1 ? 'it' : 'them'}`
              : ''}
            .
          </span>
        </p>
      )}
      {left.length > 0 && (
        <p className="text-sm text-muted">
          Requests for {left.length === 1 ? 'it' : 'them'} reach nobody until someone is designated.
          Nothing is cancelled or moved.
        </p>
      )}
    </div>
  );
}

/** Whether a change reaches anything that needs a person to read it first. */
export const strandsAnything = (impact: UserImpactResult) =>
  impact.facilitiesLeftWithoutApprover.length > 0 ||
  impact.unroutedPendingRequests > 0 ||
  impact.totalAffected > 0;
