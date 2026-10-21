import { APPROVAL_STATUSES, WORK_ITEM_TYPES, type ApprovalCounts } from '@/shared/api';
import {
  CheckboxGroupFilter,
  DateRangeFilter,
  FilterSection,
  Skeleton,
  STATUS_STYLES,
} from '@/shared/components';
import { shownStatuses, type ApprovalListState } from '../listState';
import { WORK_TYPE_STYLES } from '../workType';

interface ApprovalFiltersProps {
  counts: ApprovalCounts | undefined;
  state: ApprovalListState;
  onChange: (patch: Partial<ApprovalListState>) => void;
}

/** The approval specific composition of the shared filter primitives. */
export function ApprovalFilters({ counts, state, onChange }: ApprovalFiltersProps) {
  const statuses = shownStatuses(state);
  return (
    <div>
      <FilterSection title="Status" activeCount={state.status.length}>
        <CheckboxGroupFilter
          label="Status"
          options={APPROVAL_STATUSES.map((status) => ({
            value: status,
            label: STATUS_STYLES[status].label,
          }))}
          selected={statuses}
          onChange={(next) =>
            onChange({ status: next.length === 1 && next[0] === 'pending' ? [] : (next as never) })
          }
        />
      </FilterSection>
      <FilterSection title="Kind of request" activeCount={state.type.length}>
        <CheckboxGroupFilter
          label="Kind of request"
          options={WORK_ITEM_TYPES.map((type) => ({
            value: type,
            label: WORK_TYPE_STYLES[type].label,
          }))}
          selected={state.type}
          onChange={(type) => onChange({ type: type as ApprovalListState['type'] })}
        />
      </FilterSection>
      <FilterSection title="Event date" activeCount={state.from || state.to ? 1 : 0}>
        <DateRangeFilter
          label="Event date"
          value={{ from: state.from, to: state.to }}
          onChange={({ from, to }) => onChange({ from, to })}
        />
      </FilterSection>
      <FilterSection title="Facility" activeCount={state.facilityId.length}>
        {counts ? (
          <CheckboxGroupFilter
            label="Facility"
            options={counts.facilities.map((f) => ({
              value: f.id,
              label: f.name,
              count: f.pending,
            }))}
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
