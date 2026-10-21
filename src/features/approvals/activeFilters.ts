import type { ApprovalCounts } from '@/shared/api';
import { STATUS_STYLES, type ActiveFilter } from '@/shared/components';
import { shortDate } from '@/shared/utils/format';
import { CLEARED_APPROVAL_FILTERS, shownStatuses, type ApprovalListState } from './listState';
import { WORK_TYPE_STYLES } from './workType';

type Update = (patch: Partial<ApprovalListState>) => void;

const asDate = (iso: string) => shortDate(`${iso}T00:00:00Z`, 'utc');

/** One chip per applied value. The default view, pending only, is not a filter and has no chip. */
export function buildActiveFilters(
  state: ApprovalListState,
  counts: ApprovalCounts | undefined,
  update: Update,
): ActiveFilter[] {
  const statuses = shownStatuses(state);
  const defaultStatus = statuses.length === 1 && statuses[0] === 'pending';

  const filters: ActiveFilter[] = [
    ...(defaultStatus
      ? []
      : statuses.map((status) => ({
          key: `status:${status}`,
          label: `Status: ${STATUS_STYLES[status].label}`,
          onRemove: () => update({ status: statuses.filter((s) => s !== status) }),
        }))),
    ...state.type.map((type) => ({
      key: `type:${type}`,
      label: `Type: ${WORK_TYPE_STYLES[type].label}`,
      onRemove: () => update({ type: state.type.filter((t) => t !== type) }),
    })),
    ...state.facilityId.map((id) => ({
      key: `facility:${id}`,
      label: counts?.facilities.find((f) => f.id === id)?.name ?? id,
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

export { CLEARED_APPROVAL_FILTERS };
