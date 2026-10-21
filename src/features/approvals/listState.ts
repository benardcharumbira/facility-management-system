import {
  APPROVAL_SORTS,
  APPROVAL_STATUSES,
  WORK_ITEM_TYPES,
  type ApprovalListParams,
  type ApprovalSort,
  type ApprovalStatus,
  type WorkItemType,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const APPROVAL_PAGE_SIZE = 25;

/** Everything the queue keeps in the URL, so a view can be shared and survives a reload. */
export interface ApprovalListState {
  q: string;
  /** Empty means the default view: pending. */
  status: ApprovalStatus[];
  type: WorkItemType[];
  from: string | undefined;
  to: string | undefined;
  facilityId: string[];
  sort: ApprovalSort;
  page: number;
}

export const approvalListCodec = createParamsCodec<ApprovalListState>({
  q: param.string(),
  status: param.stringList<ApprovalStatus>(),
  type: param.stringList<WorkItemType>(),
  from: param.matching(DATE),
  to: param.matching(DATE),
  facilityId: param.stringList(),
  sort: param.oneOf(APPROVAL_SORTS, 'waiting'),
  page: param.positiveInt(1),
});

/** The statuses actually shown: pending unless the URL says otherwise. */
export function shownStatuses(state: ApprovalListState): ApprovalStatus[] {
  const valid = state.status.filter((s) => APPROVAL_STATUSES.includes(s));
  return valid.length > 0 ? valid : ['pending'];
}

export function toFilters(state: ApprovalListState): ApprovalListParams {
  return {
    q: state.q || undefined,
    status: shownStatuses(state),
    type: state.type.filter((t) => WORK_ITEM_TYPES.includes(t)),
    from: state.from,
    to: state.to,
    facilityId: state.facilityId,
  };
}

export function toListParams(state: ApprovalListState): ApprovalListParams {
  return { ...toFilters(state), sort: state.sort, page: state.page, pageSize: APPROVAL_PAGE_SIZE };
}

export const CLEARED_APPROVAL_FILTERS: Partial<ApprovalListState> = {
  status: [],
  type: [],
  from: undefined,
  to: undefined,
  facilityId: [],
};

/** True where the view is anything but the default: pending, nothing searched or filtered. */
export function isFiltered(state: ApprovalListState): boolean {
  const statuses = shownStatuses(state);
  return (
    state.q !== '' ||
    state.type.length > 0 ||
    state.facilityId.length > 0 ||
    state.from !== undefined ||
    state.to !== undefined ||
    !(statuses.length === 1 && statuses[0] === 'pending')
  );
}
