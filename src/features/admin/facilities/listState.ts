import {
  ADMIN_FACILITY_SORTS,
  ADMIN_FACILITY_STATUSES,
  type AdminFacilityListParams,
  type AdminFacilitySort,
  type AdminFacilityStatus,
  type FacilityStructure,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

export const ADMIN_PAGE_SIZE = 25;
export const STRUCTURES: readonly FacilityStructure[] = ['parent', 'child', 'standalone'];

/** Everything the list keeps in the URL. */
export interface AdminListState {
  q: string;
  type: string[];
  locality: string[];
  /** Empty means the default view: active and unavailable, without archived. */
  status: AdminFacilityStatus[];
  structure: FacilityStructure[];
  sort: AdminFacilitySort;
  page: number;
}

export const adminListCodec = createParamsCodec<AdminListState>({
  q: param.string(),
  type: param.stringList(),
  locality: param.stringList(),
  status: param.stringList<AdminFacilityStatus>(),
  structure: param.stringList<FacilityStructure>(),
  sort: param.oneOf(ADMIN_FACILITY_SORTS, 'hierarchy'),
  page: param.positiveInt(1),
});

export const DEFAULT_STATUSES: AdminFacilityStatus[] = ['active', 'unavailable'];

export function shownStatuses(state: AdminListState): AdminFacilityStatus[] {
  const valid = state.status.filter((s) => ADMIN_FACILITY_STATUSES.includes(s));
  return valid.length > 0 ? valid : DEFAULT_STATUSES;
}

export function toListParams(state: AdminListState): AdminFacilityListParams {
  return {
    q: state.q || undefined,
    type: state.type,
    locality: state.locality,
    status: shownStatuses(state),
    structure: state.structure.filter((s) => STRUCTURES.includes(s)),
    sort: state.sort,
    page: state.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export const CLEARED_ADMIN_FILTERS: Partial<AdminListState> = {
  type: [],
  locality: [],
  status: [],
  structure: [],
};

export function isFiltered(state: AdminListState): boolean {
  return (
    state.q !== '' ||
    state.type.length > 0 ||
    state.locality.length > 0 ||
    state.structure.length > 0 ||
    state.status.length > 0
  );
}
