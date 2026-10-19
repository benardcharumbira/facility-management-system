import { DateTime } from 'luxon';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  BOOKING_SORTS,
  type BookingGroup,
  type BookingListItem,
  type BookingSort,
} from '@/shared/api';
import {
  ActiveFilterChips,
  Button,
  buttonStyles,
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
  type SortOption,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { buildActiveFilters } from '../activeFilters';
import { BookingFilters } from '../components/BookingFilters';
import { BookingRow } from '../components/BookingRow';
import { useBookings, useBookingsSummary } from '../hooks';
import { CLEARED_BOOKING_FILTERS, bookingListCodec, toFilters, toListParams } from '../listState';

const SORT_LABELS: Record<BookingSort, string> = {
  attention: 'Needs attention first',
  eventDate: 'Event date (soonest first)',
  '-eventDate': 'Event date (latest first)',
  submitted: 'Submitted (oldest first)',
  '-submitted': 'Submitted (newest first)',
  status: 'Status',
};
const SORT_OPTIONS: SortOption<BookingSort>[] = BOOKING_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

const SECTION_TITLES: Record<BookingGroup, string> = {
  attention: 'Needs attention',
  upcoming: 'Upcoming',
  closed: 'Past and closed',
};
const GROUP_ORDER: BookingGroup[] = ['attention', 'upcoming', 'closed'];

export default function BookingsPage() {
  const [state, update] = useUrlState(bookingListCodec, { resetOnChange: 'page' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const list = useBookings(toListParams(state));
  const summary = useBookingsSummary(toFilters(state));
  const data = list.data;
  const counts = summary.data;
  const now = DateTime.now();

  const activeFilters = buildActiveFilters(state, counts, update);
  const clearFilters = () => update(CLEARED_BOOKING_FILTERS);
  const countLabel = data
    ? `${data.totalItems} ${data.totalItems === 1 ? 'booking' : 'bookings'}`
    : undefined;

  const renderResults = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load your bookings"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!data) return <SkeletonGrid count={5} layout="row" rows={['text', 'text', 'text']} />;

    if (data.items.length === 0) {
      if (counts && counts.overall === 0) {
        return (
          <EmptyState
            title="You have no bookings yet"
            description="Request a hall or room for a meeting or event, and its progress will appear here: when it is approved, if it is declined, and anything you need to do next."
            action={
              <Link to="/facilities" className={buttonStyles()}>
                Browse venues
              </Link>
            }
          />
        );
      }
      return (
        <EmptyState
          title="No bookings match"
          description="Nothing fits the search and filters you have chosen."
          action={
            <div className="flex gap-2">
              {activeFilters.length > 0 && (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {state.q !== '' && (
                <Button variant="secondary" onClick={() => update({ q: '' })}>
                  Clear search
                </Button>
              )}
            </div>
          }
        />
      );
    }

    const row = (item: BookingListItem) => <BookingRow key={item.id} item={item} now={now} />;

    // Sections only make sense in the default ordering, which is built from them.
    if (state.sort !== 'attention') {
      return (
        <ResultsGrid layout="rows" label="Bookings">
          {data.items.map(row)}
        </ResultsGrid>
      );
    }

    const byGroup = (group: BookingGroup) => data.items.filter((item) => item.group === group);
    const onLastPage = data.page >= data.totalPages;
    const noPastAtAll = counts !== undefined && counts.matching.closed === 0;
    return (
      <div className="flex flex-col gap-8">
        {GROUP_ORDER.map((group) => {
          const items = byGroup(group);
          if (items.length === 0) {
            // A quiet note, not an empty state: everything else is here and nothing has finished yet.
            return group === 'closed' && onLastPage && noPastAtAll ? (
              <ResultsSection key={group} title={SECTION_TITLES.closed}>
                <p className="text-muted">You have no past bookings yet.</p>
              </ResultsSection>
            ) : null;
          }
          return (
            <ResultsSection key={group} title={SECTION_TITLES[group]} count={items.length}>
              <ResultsGrid layout="rows" label={SECTION_TITLES[group]}>
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
      title="My bookings"
      description="Check whether your requests have been approved, and manage your bookings."
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
          <BookingFilters summary={counts} state={state} onChange={update} />
        </FilterPanel>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SearchField
            label="Search bookings"
            placeholder="Reference, venue or event description"
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
          />
          <ActiveFilterChips filters={activeFilters} onClearAll={clearFilters} />
          <section
            aria-label="Bookings"
            aria-busy={list.isFetching}
            className={
              list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
            }
          >
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={(page) => update({ page })} />}
        </div>
      </div>
    </PageLayout>
  );
}
