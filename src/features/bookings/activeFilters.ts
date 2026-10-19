import type { BookingsSummary } from '@/shared/api';
import type { ActiveFilter } from '@/shared/components';
import { shortDate } from './format';
import { CLEARED_BOOKING_FILTERS, type BookingListState } from './listState';
import { STATUS_STYLES } from './status';

type Update = (patch: Partial<BookingListState>) => void;

const asDate = (iso: string) => shortDate(`${iso}T00:00:00Z`, 'utc');

/** One chip per applied value; names come from the data, never hardcoded. */
export function buildActiveFilters(
  state: BookingListState,
  summary: BookingsSummary | undefined,
  update: Update,
): ActiveFilter[] {
  const filters: ActiveFilter[] = [
    ...state.status.map((status) => ({
      key: `status:${status}`,
      label: `Status: ${STATUS_STYLES[status]?.label ?? status}`,
      onRemove: () => update({ status: state.status.filter((s) => s !== status) }),
    })),
    ...state.facilityId.map((id) => ({
      key: `facility:${id}`,
      label: summary?.facilities.find((f) => f.id === id)?.name ?? id,
      onRemove: () => update({ facilityId: state.facilityId.filter((f) => f !== id) }),
    })),
  ];

  if (state.from || state.to) {
    const label =
      state.from && state.to
        ? `Event date: ${asDate(state.from)} to ${asDate(state.to)}`
        : state.from
          ? `Event date: from ${asDate(state.from)}`
          : `Event date: until ${asDate(state.to ?? '')}`;
    filters.push({
      key: 'dates',
      label,
      onRemove: () => update({ from: undefined, to: undefined }),
    });
  }
  return filters;
}

export { CLEARED_BOOKING_FILTERS };
