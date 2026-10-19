import type { FacilityFilterOptions } from '@/shared/api';
import type { ActiveFilter } from '@/shared/components';
import { CLEARED_FILTERS, type FacilityListState } from './listState';

type Update = (patch: Partial<FacilityListState>) => void;

/** One entry per applied value. Names come from the filter options, never hardcoded. */
export function buildActiveFilters(
  state: FacilityListState,
  options: FacilityFilterOptions | undefined,
  update: Update,
): ActiveFilter[] {
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, id: string) =>
    list?.find((item) => item.id === id)?.name ?? id;
  const without = (values: string[], value: string) => values.filter((v) => v !== value);

  const filters: ActiveFilter[] = [
    ...state.type.map((id) => ({
      key: `type:${id}`,
      label: nameOf(options?.types, id),
      onRemove: () => update({ type: without(state.type, id) }),
    })),
    ...state.locality.map((id) => ({
      key: `locality:${id}`,
      label: nameOf(options?.localities, id),
      onRemove: () => update({ locality: without(state.locality, id) }),
    })),
    ...state.amenities.map((id) => ({
      key: `amenity:${id}`,
      label: nameOf(options?.amenities, id),
      onRemove: () => update({ amenities: without(state.amenities, id) }),
    })),
  ];

  if (state.minCapacity !== undefined || state.maxCapacity !== undefined) {
    const low = state.minCapacity ?? options?.capacity.min ?? 0;
    const high = state.maxCapacity;
    filters.push({
      key: 'capacity',
      label:
        high === undefined
          ? `Capacity ${low}+`
          : state.minCapacity === undefined
            ? `Capacity up to ${high}`
            : `Capacity ${low}–${high}`,
      onRemove: () => update({ minCapacity: undefined, maxCapacity: undefined }),
    });
  }

  if (state.status !== CLEARED_FILTERS.status) {
    filters.push({
      key: 'status',
      label: state.status === 'all' ? 'Including unavailable' : 'Unavailable only',
      onRemove: () => update({ status: 'active' }),
    });
  }

  return filters;
}
