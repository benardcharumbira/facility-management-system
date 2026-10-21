import { Link, useLocation } from 'react-router';
import type { UserAudience } from '@/shared/api';
import { cn } from '@/shared/utils/cn';
import { userListCodec, type UserListState } from '../listState';

/**
 * Staff, applicants or everyone. The applicant list dwarfs the staff list and the staff are what
 * an administrator usually came for, so staff is where this opens. The counts say what is behind each.
 */
export function AudienceTabs({
  state,
  counts,
}: {
  state: UserListState;
  counts: { staff: number; applicants: number } | undefined;
}) {
  const { pathname } = useLocation();
  const tabs: Array<{ id: UserAudience; label: string; count?: number }> = [
    { id: 'staff', label: 'Staff', count: counts?.staff },
    { id: 'applicants', label: 'Applicants', count: counts?.applicants },
    {
      id: 'all',
      label: 'Everyone',
      count: counts ? counts.staff + counts.applicants : undefined,
    },
  ];
  return (
    <nav aria-label="Who to show" className="mb-4">
      <ul className="m-0 flex list-none gap-2 border-b border-line p-0">
        {tabs.map((tab) => {
          const selected = tab.id === state.audience;
          const search = userListCodec.toSearchString({ ...state, audience: tab.id, page: 1 });
          return (
            <li key={tab.id}>
              <Link
                to={`${pathname}${search ? `?${search}` : ''}`}
                replace
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  '-mb-px flex items-baseline gap-2 border-b-2 px-4 py-2 font-semibold',
                  selected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-sm font-normal text-muted">{tab.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
