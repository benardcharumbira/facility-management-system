import { LayoutGrid, List } from 'lucide-react';
import { useRef, useState } from 'react';
import { FACILITY_SORTS, type FacilitySort } from '@/shared/api';
import {
  ActiveFilterChips,
  Button,
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
  ViewToggle,
  type SortOption,
  type ViewOption,
} from '@/shared/components';
import { useSessionStorageState, useUrlState } from '@/shared/hooks';
import { buildActiveFilters } from '../activeFilters';
import { FACILITY_CARD_ROWS, FacilityCard } from '../components/FacilityCard';
import { FacilityFilters } from '../components/FacilityFilters';
import { FACILITY_ROW_ROWS, FacilityListItem } from '../components/FacilityListItem';
import { useFacilities, useFacilityFilterOptions } from '../hooks';
import {
  CLEARED_FILTERS,
  VIEW_MODES,
  facilityListCodec,
  toListParams,
  type ViewMode,
} from '../listState';

const SORT_LABELS: Record<FacilitySort, string> = {
  name: 'Name (A to Z)',
  '-name': 'Name (Z to A)',
  capacity: 'Capacity (low to high)',
  '-capacity': 'Capacity (high to low)',
  type: 'Type',
  locality: 'Locality',
};
const SORT_OPTIONS: SortOption<FacilitySort>[] = FACILITY_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

const VIEW_OPTIONS: ViewOption<ViewMode>[] = [
  { value: 'grid', label: 'Card view', icon: <LayoutGrid aria-hidden className="size-5" /> },
  { value: 'list', label: 'List view', icon: <List aria-hidden className="size-5" /> },
];

const SKELETON_COUNT = 8;

const isViewMode = (value: string): value is ViewMode => VIEW_MODES.some((mode) => mode === value);

export default function FacilitiesPage() {
  const [state, update] = useUrlState(facilityListCodec, { resetOnChange: 'page' });
  const [storedView, setStoredView] = useSessionStorageState('facilities.view', isViewMode, 'grid');
  const view = state.view ?? storedView;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const options = useFacilityFilterOptions();
  const facilities = useFacilities(toListParams(state));

  const activeFilters = buildActiveFilters(state, options.data, update);
  const clearFilters = () => update(CLEARED_FILTERS);
  const data = facilities.data;
  const countLabel = data
    ? `${data.totalItems} ${data.totalItems === 1 ? 'facility' : 'facilities'}`
    : undefined;

  const goToPage = (page: number) => {
    update({ page });
    document.getElementById('facility-results')?.scrollIntoView?.({ block: 'start' });
  };

  const renderResults = () => {
    if (facilities.isError) {
      return (
        <ErrorState
          title="We could not load facilities"
          problem={facilities.error}
          onRetry={() => void facilities.refetch()}
        />
      );
    }
    if (!data) {
      return view === 'list' ? (
        <SkeletonGrid count={SKELETON_COUNT} layout="row" rows={[...FACILITY_ROW_ROWS]} />
      ) : (
        <SkeletonGrid count={SKELETON_COUNT} rows={[...FACILITY_CARD_ROWS]} />
      );
    }
    if (data.items.length === 0) {
      const searching = state.q !== '';
      if (!searching && activeFilters.length === 0) {
        return (
          <EmptyState
            title="No facilities available yet"
            description="There are no bookable facilities in the catalogue at the moment. Please check back soon."
          />
        );
      }
      return (
        <EmptyState
          title="No facilities match your search"
          description="Try removing a filter or searching for something different."
          action={
            <div className="flex gap-2">
              {activeFilters.length > 0 && (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {searching && (
                <Button variant="secondary" onClick={() => update({ q: '' })}>
                  Clear search
                </Button>
              )}
            </div>
          }
        />
      );
    }
    return (
      <ResultsGrid layout={view === 'list' ? 'rows' : 'cards'} label="Facilities">
        {data.items.map((facility) =>
          view === 'list' ? (
            <FacilityListItem key={facility.id} facility={facility} />
          ) : (
            <FacilityCard key={facility.id} facility={facility} />
          ),
        )}
      </ResultsGrid>
    );
  };

  return (
    <PageLayout
      title="Facilities"
      description="Find a venue, field, court or meeting room for your booking."
      meta={countLabel}
    >
      <div className="flex items-start gap-8">
        <FilterPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
          onClearAll={activeFilters.length > 0 ? clearFilters : undefined}
          returnFocusRef={filterButtonRef}
        >
          <FacilityFilters options={options.data} state={state} onChange={update} />
        </FilterPanel>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SearchField
            label="Search facilities"
            placeholder="Name, code, description or locality"
            value={state.q}
            onChange={(q) => update({ q }, { replace: true })}
          />
          <ResultsToolbar
            countLabel={countLabel}
            leading={
              <FilterButton
                ref={filterButtonRef}
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
            viewToggle={
              <ViewToggle
                value={view}
                options={VIEW_OPTIONS}
                onChange={(next) => {
                  setStoredView(next);
                  update({ view: next }, { replace: true });
                }}
              />
            }
          />
          <ActiveFilterChips filters={activeFilters} onClearAll={clearFilters} />
          <section
            id="facility-results"
            aria-label="Facility results"
            aria-busy={facilities.isFetching}
            className={
              facilities.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
            }
          >
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={goToPage} />}
        </div>
      </div>
    </PageLayout>
  );
}
