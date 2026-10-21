import {
  RESOURCE_CATEGORIES,
  RESOURCE_STATUSES,
  type ResourceCategory,
  type ResourceStatus,
} from '@/shared/api';
import { CheckboxGroupFilter, FilterSection } from '@/shared/components';
import { CATEGORY_LABELS, STATUS_LABELS } from '../labels';
import { shownStatuses, type ResourceListState } from '../listState';

export function ResourceFilters({
  state,
  onChange,
}: {
  state: ResourceListState;
  onChange: (patch: Partial<ResourceListState>) => void;
}) {
  const statuses = shownStatuses(state);
  return (
    <div>
      <FilterSection title="Category" activeCount={state.category.length}>
        <CheckboxGroupFilter
          label="Category"
          options={RESOURCE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          selected={state.category}
          onChange={(category) => onChange({ category: category as ResourceCategory[] })}
        />
      </FilterSection>
      <FilterSection title="Status" activeCount={state.status.length}>
        <CheckboxGroupFilter
          label="Status"
          options={RESOURCE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          selected={statuses}
          onChange={(next) => {
            const isDefault = next.length === 1 && next[0] === 'active';
            onChange({ status: isDefault ? [] : (next as ResourceStatus[]) });
          }}
        />
      </FilterSection>
    </div>
  );
}
