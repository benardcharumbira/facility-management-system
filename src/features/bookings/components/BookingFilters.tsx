import { BOOKING_STATUSES, type BookingsSummary } from '@/shared/api';
import { CheckboxGroupFilter, DateRangeFilter, FilterSection, Skeleton } from '@/shared/components';
import type { BookingListState } from '../listState';
import { STATUS_STYLES } from '../status';

interface BookingFiltersProps {
  summary: BookingsSummary | undefined;
  state: BookingListState;
  onChange: (patch: Partial<BookingListState>) => void;
}

/** The booking specific composition of the shared filter primitives. */
export function BookingFilters({ summary, state, onChange }: BookingFiltersProps) {
  return (
    <div>
      <FilterSection title="Status" activeCount={state.status.length}>
        <CheckboxGroupFilter
          label="Status"
          options={BOOKING_STATUSES.map((status) => ({
            value: status,
            label: STATUS_STYLES[status].label,
          }))}
          selected={state.status}
          onChange={(status) => onChange({ status: status as BookingListState['status'] })}
        />
      </FilterSection>
      <FilterSection title="Event date" activeCount={state.from || state.to ? 1 : 0}>
        <DateRangeFilter
          label="Event date"
          value={{ from: state.from, to: state.to }}
          onChange={({ from, to }) => onChange({ from, to })}
        />
      </FilterSection>
      <FilterSection title="Venue" activeCount={state.facilityId.length}>
        {summary ? (
          <CheckboxGroupFilter
            label="Venue"
            options={summary.facilities.map((f) => ({ value: f.id, label: f.name }))}
            selected={state.facilityId}
            onChange={(facilityId) => onChange({ facilityId })}
          />
        ) : (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        )}
      </FilterSection>
    </div>
  );
}
