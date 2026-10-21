import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  RESOURCE_CATEGORIES,
  RESOURCE_SORTS,
  type AdminResourceRow,
  type ResourceSort,
} from '@/shared/api';
import {
  ActiveFilterChips,
  buttonStyles,
  DensityProvider,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterPanel,
  PageLayout,
  Pagination,
  ResultsGrid,
  ResultsSection,
  ResultsToolbar,
  SearchField,
  SkeletonGrid,
  SortSelect,
  type ActiveFilter,
  type SortOption,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { ResourceAreaTabs } from '../resources/components/ResourceAreaTabs';
import { ResourceFilters } from '../resources/components/ResourceFilters';
import { ResourceRow } from '../resources/components/ResourceRow';
import { useResources } from '../resources/hooks';
import { CATEGORY_LABELS, STATUS_LABELS } from '../resources/labels';
import {
  CLEARED_RESOURCE_FILTERS,
  isFiltered,
  resourceListCodec,
  shownStatuses,
  toListParams,
} from '../resources/listState';

const SORT_LABELS: Record<ResourceSort, string> = {
  category: 'Category, then name',
  name: 'Name',
  '-facilitiesHolding': 'Held by most facilities',
};
const SORT_OPTIONS: SortOption<ResourceSort>[] = RESOURCE_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export default function AdminResourcesPage() {
  const [state, update] = useUrlState(resourceListCodec);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const list = useResources(toListParams(state));
  const data = list.data;

  const statuses = shownStatuses(state);
  const chips: ActiveFilter[] = [
    ...state.category.map((c) => ({
      key: `category:${c}`,
      label: `Category: ${CATEGORY_LABELS[c]}`,
      onRemove: () => update({ category: state.category.filter((x) => x !== c) }),
    })),
    ...(statuses.length === 1 && statuses[0] === 'active'
      ? []
      : statuses.map((s) => ({
          key: `status:${s}`,
          label: `Status: ${STATUS_LABELS[s]}`,
          onRemove: () => update({ status: statuses.filter((x) => x !== s) }),
        }))),
  ];
  const clear = () => update(CLEARED_RESOURCE_FILTERS);
  const countLabel = data
    ? `${data.totalItems} ${data.totalItems === 1 ? 'resource' : 'resources'}`
    : undefined;

  const renderResults = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load the catalogue"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!data) return <SkeletonGrid count={8} layout="row" hasMedia={false} rows={['text']} />;
    if (data.items.length === 0) {
      return (
        <EmptyState
          title={isFiltered(state) ? 'No resources match' : 'The catalogue is empty'}
          description={
            isFiltered(state)
              ? 'Nothing fits the search and filters you have chosen.'
              : 'Create the first resource.'
          }
        />
      );
    }
    const row = (item: AdminResourceRow) => <ResourceRow key={item.id} row={item} />;
    // Grouped by category when sorted that way, which is the booking form's own grouping.
    if (state.sort !== 'category') {
      return (
        <ResultsGrid layout="rows" label="Resources">
          {data.items.map(row)}
        </ResultsGrid>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        {RESOURCE_CATEGORIES.map((category) => {
          const items = data.items.filter((i) => i.category === category);
          return items.length === 0 ? null : (
            <ResultsSection key={category} title={CATEGORY_LABELS[category]} count={items.length}>
              <ResultsGrid layout="rows" label={CATEGORY_LABELS[category]}>
                {items.map(row)}
              </ResultsGrid>
            </ResultsSection>
          );
        })}
      </div>
    );
  };

  return (
    <PageLayout
      title="Resources"
      description="The catalogue of what can be requested, and what each facility holds of it."
      actions={
        <Link to="/admin/resources/new" className={buttonStyles()}>
          <Plus aria-hidden className="size-4" />
          Create resource
        </Link>
      }
    >
      <ResourceAreaTabs current="catalogue" />
      <DensityProvider density="compact">
        <div className="flex flex-col gap-3">
          <SearchField
            label="Search resources"
            placeholder="Name or description"
            value={state.q}
            onChange={(q) => update({ q }, { replace: true })}
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
                onChange={(sort) => update({ sort })}
              />
            }
          />
          <ActiveFilterChips filters={chips} onClearAll={clear} />
          <section aria-label="Resources" aria-busy={list.isFetching}>
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={() => {}} />}
        </div>
        <FilterPanel
          placement="overlay"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
          onClearAll={chips.length > 0 ? clear : undefined}
          returnFocusRef={filterButtonRef}
        >
          <ResourceFilters state={state} onChange={update} />
        </FilterPanel>
      </DensityProvider>
    </PageLayout>
  );
}
