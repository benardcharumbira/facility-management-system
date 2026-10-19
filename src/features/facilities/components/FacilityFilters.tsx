import type { FacilityFilterOptions } from '@/shared/api';
import {
  CheckboxGroupFilter,
  FilterSection,
  RangeFilter,
  Skeleton,
  SwitchField,
} from '@/shared/components';
import type { FacilityListState } from '../listState';

interface FacilityFiltersProps {
  /** Undefined while the filter vocabulary is loading. */
  options: FacilityFilterOptions | undefined;
  state: FacilityListState;
  onChange: (patch: Partial<FacilityListState>) => void;
}

/** The facility specific composition of the generic filter primitives. */
export function FacilityFilters({ options, state, onChange }: FacilityFiltersProps) {
  if (!options) {
    return (
      <div className="flex flex-col gap-3 py-3" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-5" />
        ))}
      </div>
    );
  }

  const hasCapacityRange = options.capacity.max > options.capacity.min;

  return (
    <div>
      <FilterSection title="Facility type" activeCount={state.type.length}>
        <CheckboxGroupFilter
          label="Facility type"
          options={options.types.map((t) => ({ value: t.id, label: t.name, count: t.count }))}
          selected={state.type}
          onChange={(type) => onChange({ type })}
        />
      </FilterSection>
      <FilterSection title="Locality" activeCount={state.locality.length}>
        <CheckboxGroupFilter
          label="Locality"
          options={options.localities.map((l) => ({ value: l.id, label: l.name, count: l.count }))}
          selected={state.locality}
          onChange={(locality) => onChange({ locality })}
        />
      </FilterSection>
      {hasCapacityRange && (
        <FilterSection
          title="Capacity"
          activeCount={state.minCapacity !== undefined || state.maxCapacity !== undefined ? 1 : 0}
        >
          <RangeFilter
            label="Capacity"
            bounds={options.capacity}
            value={{ min: state.minCapacity, max: state.maxCapacity }}
            onChange={({ min, max }) => onChange({ minCapacity: min, maxCapacity: max })}
          />
        </FilterSection>
      )}
      <FilterSection title="Amenities" activeCount={state.amenities.length}>
        <CheckboxGroupFilter
          label="Amenities (all selected must be present)"
          options={options.amenities.map((a) => ({ value: a.id, label: a.name }))}
          selected={state.amenities}
          onChange={(amenities) => onChange({ amenities })}
        />
      </FilterSection>
      <FilterSection title="Status">
        <SwitchField
          label="Include unavailable facilities"
          checked={state.status === 'all'}
          onChange={(checked) => onChange({ status: checked ? 'all' : 'active' })}
        />
      </FilterSection>
    </div>
  );
}
