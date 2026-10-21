import { Building2, Plus, Settings2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ADMIN_FACILITY_SORTS, type AdminFacilityRow, type AdminFacilitySort } from '@/shared/api';
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
  type SortOption,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { buildActiveFilters } from '../facilities/activeFilters';
import { FacilityFilters } from '../facilities/components/FacilityFilters';
import { FacilityRow } from '../facilities/components/FacilityRow';
import { FacilityTypesDialog } from '../facilities/components/FacilityTypesDialog';
import { useAdminFacilities, useFacilityTypes } from '../facilities/hooks';
import {
  adminListCodec,
  CLEARED_ADMIN_FILTERS,
  isFiltered,
  toListParams,
} from '../facilities/listState';

const SORT_LABELS: Record<AdminFacilitySort, string> = {
  hierarchy: 'Grouped by building',
  name: 'Name',
  type: 'Type',
  locality: 'Locality',
  status: 'Status',
  '-futureBookings': 'Most future bookings',
};
const SORT_OPTIONS: SortOption<AdminFacilitySort>[] = ADMIN_FACILITY_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export default function AdminFacilitiesPage() {
  const [state, update] = useUrlState(adminListCodec, { resetOnChange: 'page' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useAdminFacilities(toListParams(state));
  const types = useFacilityTypes();
  const data = list.data;

  const activeFilters = buildActiveFilters(state, types.data, update);
  const clearFilters = () => update(CLEARED_ADMIN_FILTERS);
  const countLabel = data
    ? `${data.totalItems} ${data.totalItems === 1 ? 'facility' : 'facilities'}`
    : undefined;

  const renderResults = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load the facilities"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!data)
      return <SkeletonGrid count={8} layout="row" hasMedia={false} rows={['text', 'text']} />;
    if (data.items.length === 0) {
      if (!isFiltered(state)) {
        return (
          <EmptyState
            icon={<Building2 aria-hidden className="size-10" />}
            title="There are no facilities yet"
            description="Create the first facility to start building the estate."
            action={
              <Link to="/admin/facilities/new" className={buttonStyles()}>
                Create facility
              </Link>
            }
          />
        );
      }
      return (
        <EmptyState
          title="No facilities match"
          description="Nothing fits the search and filters you have chosen."
          action={
            <div className="flex gap-2">
              {activeFilters.length > 0 && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {state.q !== '' && (
                <Button variant="secondary" size="sm" onClick={() => update({ q: '' })}>
                  Clear search
                </Button>
              )}
            </div>
          }
        />
      );
    }
    return (
      <ResultsGrid layout="rows" label="Facilities">
        {data.items.map((row: AdminFacilityRow) => (
          <FacilityRow key={row.id} row={row} />
        ))}
      </ResultsGrid>
    );
  };

  return (
    <PageLayout
      title="Manage facilities"
      description="Create and change the facilities, how they sit together, and when and by whom they can be booked."
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTypesOpen(true)}>
            <Settings2 aria-hidden className="size-4" />
            Facility types
          </Button>
          <Link to="/admin/facilities/new" className={buttonStyles()}>
            <Plus aria-hidden className="size-4" />
            Create facility
          </Link>
        </div>
      }
    >
      <DensityProvider density="compact">
        <div className="flex flex-col gap-3">
          {data && data.withoutApprover > 0 && (
            <Alert
              severity="error"
              title={
                data.withoutApprover === 1
                  ? '1 facility has nobody to approve for it'
                  : `${data.withoutApprover} facilities have nobody to approve for them`
              }
            >
              Requests for them reach no one. Open the facility, choose Approvers and designate
              someone. They are marked “No approver” below.
            </Alert>
          )}
          <SearchField
            label="Search facilities"
            placeholder="Name, code or locality"
            value={state.q}
            onChange={(q) => update({ q }, { replace: true })}
          />
          <ResultsToolbar
            countLabel={countLabel}
            leading={
              <FilterButton
                ref={filterButtonRef}
                alwaysVisible
                activeCount={activeFilters.length}
                onClick={() => setFiltersOpen(true)}
              />
            }
            sort={
              <SortSelect
                value={state.sort}
                options={SORT_OPTIONS}
                onChange={(sort) => update({ sort })}
              />
            }
          />
          <ActiveFilterChips filters={activeFilters} onClearAll={clearFilters} />
          <section
            aria-label="Facilities"
            aria-busy={list.isFetching}
            className={
              list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
            }
          >
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={(page) => update({ page })} />}
        </div>
        <FilterPanel
          placement="overlay"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
          onClearAll={activeFilters.length > 0 ? clearFilters : undefined}
          returnFocusRef={filterButtonRef}
        >
          <FacilityFilters
            types={types.data}
            localities={data?.localities}
            state={state}
            onChange={update}
          />
        </FilterPanel>
      </DensityProvider>
      <FacilityTypesDialog open={typesOpen} onOpenChange={setTypesOpen} />
    </PageLayout>
  );
}
