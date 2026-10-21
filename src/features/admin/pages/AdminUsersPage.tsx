import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { USER_SORTS, type UserSort } from '@/shared/api';
import { ROLE_LABELS } from '@/shared/auth';
import {
  ActiveFilterChips,
  Alert,
  Button,
  buttonStyles,
  DensityProvider,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterPanel,
  PageLayout,
  Pagination,
  ResultsGrid,
  ResultsToolbar,
  SearchField,
  SkeletonGrid,
  SortSelect,
  type ActiveFilter,
  type SortOption,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { AudienceTabs } from '../users/components/AudienceTabs';
import { UserFilters } from '../users/components/UserFilters';
import { UserRow } from '../users/components/UserRow';
import { useUsers } from '../users/hooks';
import { CLERK_DASHBOARD_URL, STATUS_LABELS } from '../users/labels';
import { CLEARED_USER_FILTERS, isFiltered, toListParams, userListCodec } from '../users/listState';

const SORT_LABELS: Record<UserSort, string> = {
  name: 'Name',
  role: 'Role, highest first',
  status: 'Status',
  '-lastSignIn': 'Signed in most recently',
};
const SORT_OPTIONS: SortOption<UserSort>[] = USER_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export default function AdminUsersPage() {
  const [state, update] = useUrlState(userListCodec);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const list = useUsers(toListParams(state));
  const data = list.data;

  const chips: ActiveFilter[] = [
    ...state.role.map((r) => ({
      key: `role:${r}`,
      label: `Role: ${ROLE_LABELS[r]}`,
      onRemove: () => update({ role: state.role.filter((x) => x !== r), page: 1 }),
    })),
    ...state.status.map((s) => ({
      key: `status:${s}`,
      label: `Status: ${STATUS_LABELS[s]}`,
      onRemove: () => update({ status: state.status.filter((x) => x !== s), page: 1 }),
    })),
    ...(state.noFacilities === 'yes'
      ? [
          {
            key: 'noFacilities',
            label: 'Approvers with no facilities',
            onRemove: () => update({ noFacilities: 'no', page: 1 }),
          },
        ]
      : []),
  ];
  const clear = () => update(CLEARED_USER_FILTERS);
  const countLabel = data
    ? `${data.totalItems} ${data.totalItems === 1 ? 'person' : 'people'}`
    : undefined;
  const idle = data?.counts.approversWithoutFacilities ?? 0;

  const renderResults = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load the users"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!data) return <SkeletonGrid count={8} layout="row" hasMedia={false} rows={['text']} />;
    if (data.items.length === 0) {
      return (
        <EmptyState
          title={isFiltered(state) ? 'Nobody matches' : 'Nobody here yet'}
          description={
            isFiltered(state)
              ? 'Nobody fits the search and filters you have chosen. Try everyone, or clear the filters.'
              : 'Nobody is in this group.'
          }
        />
      );
    }
    return (
      <ResultsGrid layout="rows" label="Users">
        {data.items.map((row) => (
          <UserRow key={row.id} row={row} />
        ))}
      </ResultsGrid>
    );
  };

  return (
    <PageLayout
      title="Users"
      description="Who can do what in the service. People sign up and sign in through Clerk; here you decide their role and, for approvers, their facilities."
      actions={
        <a
          href={CLERK_DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          className={buttonStyles({ variant: 'secondary' })}
        >
          Invite staff in Clerk
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      }
    >
      <AudienceTabs state={state} counts={data?.counts} />
      <DensityProvider density="compact">
        <div className="flex flex-col gap-3">
          {idle > 0 && state.noFacilities === 'no' && (
            <Alert
              severity="warning"
              title={`${idle} ${idle === 1 ? 'facility administrator has' : 'facility administrators have'} no facilities designated`}
              action={
                <Button
                  variant="secondary"
                  onClick={() => update({ noFacilities: 'yes', audience: 'staff', page: 1 })}
                >
                  <ShieldAlert aria-hidden className="size-4" />
                  Show them
                </Button>
              }
            >
              They can sign in but approve nothing. It does no harm, and is worth tidying.
            </Alert>
          )}
          <SearchField
            label="Search users"
            placeholder="Name or email address"
            value={state.q}
            onChange={(q) => update({ q, page: 1 }, { replace: true })}
          />
          <ResultsToolbar
            countLabel={countLabel}
            leading={
              <FilterButton
                ref={filterButtonRef}
                alwaysVisible
                activeCount={chips.length}
                onClick={() => setFiltersOpen(true)}
              />
            }
            sort={
              <SortSelect
                value={state.sort}
                options={SORT_OPTIONS}
                onChange={(sort) => update({ sort, page: 1 })}
              />
            }
          />
          <ActiveFilterChips filters={chips} onClearAll={clear} />
          <section aria-label="Users" aria-busy={list.isFetching}>
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={(page) => update({ page })} />}
        </div>
        <FilterPanel
          placement="overlay"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
          onClearAll={chips.length > 0 ? clear : undefined}
          returnFocusRef={filterButtonRef}
        >
          <UserFilters state={state} onChange={update} />
        </FilterPanel>
      </DensityProvider>
    </PageLayout>
  );
}
