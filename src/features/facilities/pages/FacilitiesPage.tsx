import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useRef, useState } from 'react';
import { FACILITY_SORTS, type FacilitySort } from '@/shared/api';
import {
  ActiveFilterChips,
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
  type GridColumns,
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
  { value: 'grid', label: 'Card view', icon: <ViewModuleIcon /> },
  { value: 'list', label: 'List view', icon: <ViewListIcon /> },
];

/**
 * The shell's navigation and the filter sidebar both take width at `lg`, so four card
 * columns only fit from `xl`. See shared/components/README.md.
 */
const CARD_COLUMNS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 3, xl: 4 };
const ROW_COLUMNS: GridColumns = { xs: 1 };
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

  const columns = view === 'list' ? ROW_COLUMNS : CARD_COLUMNS;

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
        <SkeletonGrid
          count={SKELETON_COUNT}
          columns={ROW_COLUMNS}
          layout="row"
          rows={[...FACILITY_ROW_ROWS]}
        />
      ) : (
        <SkeletonGrid
          count={SKELETON_COUNT}
          columns={CARD_COLUMNS}
          rows={[...FACILITY_CARD_ROWS]}
        />
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
            <Stack direction="row" spacing={1}>
              {activeFilters.length > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
              {searching && <Button onClick={() => update({ q: '' })}>Clear search</Button>}
            </Stack>
          }
        />
      );
    }
    return (
      <ResultsGrid columns={columns} label="Facilities">
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
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <FilterPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
          onClearAll={activeFilters.length > 0 ? clearFilters : undefined}
          returnFocusRef={filterButtonRef}
        >
          <FacilityFilters options={options.data} state={state} onChange={update} />
        </FilterPanel>

        <Stack spacing={2} sx={{ flexGrow: 1, minWidth: 0 }}>
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
          <Box
            component="section"
            id="facility-results"
            aria-label="Facility results"
            aria-busy={facilities.isFetching}
            sx={{
              opacity: facilities.isPlaceholderData ? 0.6 : 1,
              transition: (theme) => theme.transitions.create('opacity'),
            }}
          >
            {renderResults()}
          </Box>
          {data && <Pagination envelope={data} onChange={goToPage} />}
        </Stack>
      </Box>
    </PageLayout>
  );
}
