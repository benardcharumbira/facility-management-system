import {
  FACILITY_LIST_DEFAULTS,
  FACILITY_SORTS,
  FACILITY_STATUS_FILTERS,
  type FacilityListParams,
  type FacilitySort,
  type FacilityStatusFilter,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

export const VIEW_MODES = ['grid', 'list'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/**
 * Everything the browse screen keeps in the URL: the API parameters plus the view mode.
 * Adding the reserved availability filter later means adding `availableFrom` and
 * `availableTo` fields here and to the schema below; nothing else about URL handling changes.
 */
export interface FacilityListState {
  q: string;
  type: string[];
  locality: string[];
  minCapacity: number | undefined;
  maxCapacity: number | undefined;
  amenities: string[];
  status: FacilityStatusFilter;
  sort: FacilitySort;
  page: number;
  /** Undefined until the user chooses; the session preference applies meanwhile. */
  view: ViewMode | undefined;
}

export const facilityListCodec = createParamsCodec<FacilityListState>({
  q: param.string(),
  type: param.stringList(),
  locality: param.stringList(),
  minCapacity: param.int(),
  maxCapacity: param.int(),
  amenities: param.stringList(),
  status: param.oneOf(FACILITY_STATUS_FILTERS, FACILITY_LIST_DEFAULTS.status),
  sort: param.oneOf(FACILITY_SORTS, FACILITY_LIST_DEFAULTS.sort),
  page: param.positiveInt(FACILITY_LIST_DEFAULTS.page),
  view: param.oneOfOptional(VIEW_MODES),
});

export function toListParams(state: FacilityListState): FacilityListParams {
  return {
    q: state.q || undefined,
    type: state.type,
    locality: state.locality,
    minCapacity: state.minCapacity,
    maxCapacity: state.maxCapacity,
    amenities: state.amenities,
    status: state.status,
    sort: state.sort,
    page: state.page,
    pageSize: FACILITY_LIST_DEFAULTS.pageSize,
  };
}

/** The patch that clears every filter. Search text, sort and view are not filters. */
export const CLEARED_FILTERS: Partial<FacilityListState> = {
  type: [],
  locality: [],
  minCapacity: undefined,
  maxCapacity: undefined,
  amenities: [],
  status: FACILITY_LIST_DEFAULTS.status,
};
