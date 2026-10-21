import { ShieldAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import type { AdminUserRow } from '@/shared/api';
import { ROLE_LABELS } from '@/shared/auth';
import { Badge } from '@/shared/components';
import { shortDate } from '@/shared/utils/format';

const ZONE = 'Africa/Johannesburg';

/** One person: who, their role and status, when they last signed in, and what they approve for. */
export function UserRow({ row }: { row: AdminUserRow }) {
  const location = useLocation();
  return (
    <article
      className={`flex w-full flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 sm:flex-row sm:items-start sm:justify-between ${
        row.status === 'deactivated' ? 'opacity-80' : ''
      }`}
    >
      <div className="min-w-0">
        <h3 className="text-sm leading-5 font-semibold">
          <Link
            to={`/admin/users/${encodeURIComponent(row.id)}`}
            state={{ fromList: location.search }}
            className="text-primary underline underline-offset-2"
          >
            {row.name}
          </Link>
        </h3>
        <p className="text-sm [overflow-wrap:anywhere] text-muted">{row.email}</p>
        <p className="text-sm text-muted">
          {row.lastSignInAt
            ? `Last signed in ${shortDate(row.lastSignInAt, ZONE)}`
            : 'Has never signed in'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <Badge tone={row.role === 'applicant' ? 'neutral' : 'primary'}>
          {ROLE_LABELS[row.role]}
        </Badge>
        {row.status === 'deactivated' && <Badge tone="warning">Deactivated</Badge>}
        {row.designatedFacilities !== null && !row.approverWithoutFacilities && (
          <Badge>
            {row.designatedFacilities === 1
              ? 'Approves for 1 facility'
              : `Approves for ${row.designatedFacilities} facilities`}
          </Badge>
        )}
        {row.approverWithoutFacilities && (
          <Badge tone="warning" className="gap-1">
            <ShieldAlert aria-hidden className="size-3" />
            No facilities designated
          </Badge>
        )}
      </div>
    </article>
  );
}
