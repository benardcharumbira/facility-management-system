import { Ban, CornerDownRight, Layers, ShieldAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import type { AdminFacilityRow } from '@/shared/api';
import { Badge } from '@/shared/components';
import { AdminStatusBadge } from '../status';

/** Indentation by depth, as fixed classes so Tailwind can see them. */
const INDENT = ['', 'ml-6', 'ml-12', 'ml-16'] as const;

/**
 * One facility. A space inside another is indented under it with a connector and always names its
 * parent in words, so a flat result never hides the relationship. The things that need attention
 * (nobody to approve, a closure in effect) are flagged in text.
 */
export function FacilityRow({ row }: { row: AdminFacilityRow }) {
  const location = useLocation();
  const indent = INDENT[Math.min(row.depth, INDENT.length - 1)];
  return (
    <article
      className={`flex w-full flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 sm:flex-row sm:items-start sm:justify-between ${
        row.status === 'archived' ? 'opacity-80' : ''
      }`}
    >
      <div className={`flex min-w-0 gap-2 ${indent}`}>
        {row.parentFacility && (
          <CornerDownRight aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" />
        )}
        <div className="min-w-0">
          <h3 className="text-sm leading-5 font-semibold">
            <Link
              to={`/admin/facilities/${encodeURIComponent(row.id)}`}
              state={{ fromList: location.search }}
              className="text-primary underline underline-offset-2"
            >
              {row.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {row.code} · {row.type.name} · {row.locality}
          </p>
          {row.parentFacility && (
            <p className="text-sm text-muted">Part of {row.parentFacility.name}</p>
          )}
          {row.childCount > 0 && (
            <p className="text-sm text-muted">
              Includes {row.childCount} {row.childCount === 1 ? 'space' : 'spaces'}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <AdminStatusBadge status={row.status} />
        {row.status !== 'archived' && row.approverCount === 0 && (
          <Badge tone="danger" className="gap-1">
            <ShieldAlert aria-hidden className="size-3" />
            No approver
          </Badge>
        )}
        {row.blackoutActive && (
          <Badge tone="warning" className="gap-1">
            <Ban aria-hidden className="size-3" />
            Closure in effect
          </Badge>
        )}
        <Badge className="gap-1">
          <Layers aria-hidden className="size-3" />
          {row.futureBookings === 1 ? '1 future booking' : `${row.futureBookings} future bookings`}
        </Badge>
      </div>
    </article>
  );
}
