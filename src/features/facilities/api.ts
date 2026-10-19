import type {
  ApiClient,
  FacilityFilterOptions,
  FacilityListParams,
  FacilityListResponse,
  FacilitySummary,
} from '@/shared/api';
import { createQueryKeys } from '@/shared/api';

export const facilityKeys = {
  ...createQueryKeys('facilities'),
  filterOptions: () => ['facilities', 'filter-options'] as const,
};

/** Array params are sent repeated, empty ones omitted: the client handles both. */
export function fetchFacilities(
  api: ApiClient,
  params: FacilityListParams,
  signal?: AbortSignal,
): Promise<FacilityListResponse> {
  return api.get<FacilityListResponse>('/facilities', { query: { ...params }, signal });
}

export function fetchFacilityFilterOptions(
  api: ApiClient,
  signal?: AbortSignal,
): Promise<FacilityFilterOptions> {
  return api.get<FacilityFilterOptions>('/facilities/filter-options', { signal });
}

export function fetchFacility(
  api: ApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<FacilitySummary> {
  return api.get<FacilitySummary>(`/facilities/${encodeURIComponent(id)}`, { signal });
}
