import {
  ADMIN_FACILITY_STATUSES,
  type AdminFacilityStatus,
  type FacilityStructure,
  type FacilityType,
} from '@/shared/api';
import { CheckboxGroupFilter, FilterSection, Skeleton } from '@/shared/components';
import { STRUCTURE_LABELS } from '../activeFilters';
import { DEFAULT_STATUSES, shownStatuses, STRUCTURES, type AdminListState } from '../listState';
import { FACILITY_STATUS_LABELS } from '../status';

interface FacilityFiltersProps {
  types: FacilityType[] | undefined;
  localities: string[] | undefined;
  state: AdminListState;
  onChange: (patch: Partial<AdminListState>) => void;
}

/** The composition of the shared filter primitives for the estate list. */
export function FacilityFilters({ types, localities, state, onChange }: FacilityFiltersProps) {
  const statuses = shownStatuses(state);
  return (
    <div>
      <FilterSection title="Status" activeCount={state.status.length}>
        <CheckboxGroupFilter
          label="Status"
          options={ADMIN_FACILITY_STATUSES.map((status) => ({
            value: status,
            label: FACILITY_STATUS_LABELS[status],
          }))}
          selected={statuses}
          onChange={(next) => {
            const same =
              next.length === DEFAULT_STATUSES.length &&
              DEFAULT_STATUSES.every((s) => next.includes(s));
            onChange({ status: same ? [] : (next as AdminFacilityStatus[]) });
          }}
        />
      </FilterSection>
      <FilterSection title="Structure" activeCount={state.structure.length}>
        <CheckboxGroupFilter
          label="Structure"
          options={STRUCTURES.map((s) => ({ value: s, label: STRUCTURE_LABELS[s] }))}
          selected={state.structure}
          onChange={(structure) => onChange({ structure: structure as FacilityStructure[] })}
        />
      </FilterSection>
      <FilterSection title="Type" activeCount={state.type.length}>
        {types ? (
          <CheckboxGroupFilter
            label="Type"
            options={types.map((t) => ({ value: t.id, label: t.name, count: t.facilityCount }))}
            selected={state.type}
            onChange={(type) => onChange({ type })}
          />
        ) : (
          <Placeholder />
        )}
      </FilterSection>
      <FilterSection title="Locality" activeCount={state.locality.length}>
        {localities ? (
          <CheckboxGroupFilter
            label="Locality"
            options={localities.map((name) => ({ value: name, label: name }))}
            selected={state.locality}
            onChange={(locality) => onChange({ locality })}
          />
        ) : (
          <Placeholder />
        )}
      </FilterSection>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-5" />
      ))}
    </div>
  );
}
