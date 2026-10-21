import {
  RESOURCE_CATEGORIES,
  RESOURCE_SORTS,
  RESOURCE_STATUSES,
  type AdminResourceListParams,
  type ResourceCategory,
  type ResourceSort,
  type ResourceStatus,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

/** Everything the catalogue keeps in the URL. */
export interface ResourceListState {
  q: string;
  category: ResourceCategory[];
  /** Empty means the default view: active resources only. */
  status: ResourceStatus[];
  sort: ResourceSort;
}

export const resourceListCodec = createParamsCodec<ResourceListState>({
  q: param.string(),
  category: param.stringList<ResourceCategory>(),
  status: param.stringList<ResourceStatus>(),
  sort: param.oneOf(RESOURCE_SORTS, 'category'),
});

export const DEFAULT_RESOURCE_STATUSES: ResourceStatus[] = ['active'];

export function shownStatuses(state: ResourceListState): ResourceStatus[] {
  const valid = state.status.filter((s) => RESOURCE_STATUSES.includes(s));
  return valid.length > 0 ? valid : DEFAULT_RESOURCE_STATUSES;
}

export function toListParams(state: ResourceListState): AdminResourceListParams {
  return {
    q: state.q || undefined,
    category: state.category.filter((c) => RESOURCE_CATEGORIES.includes(c)),
    status: shownStatuses(state),
    sort: state.sort,
    pageSize: 100,
  };
}

export const CLEARED_RESOURCE_FILTERS: Partial<ResourceListState> = { category: [], status: [] };

export function isFiltered(state: ResourceListState): boolean {
  return state.q !== '' || state.category.length > 0 || state.status.length > 0;
}

/** What the allocation grid keeps in the URL: which facilities and which category to show. */
export interface AllocationViewState {
  facility: string[];
  category: ResourceCategory[];
}

export const allocationViewCodec = createParamsCodec<AllocationViewState>({
  facility: param.stringList(),
  category: param.stringList<ResourceCategory>(),
});
