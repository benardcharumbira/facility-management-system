import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiClient, type FacilityListParams } from '@/shared/api';
import { facilityKeys, fetchFacilities, fetchFacility, fetchFacilityFilterOptions } from './api';

const FILTER_OPTIONS_STALE_MS = 5 * 60_000;

/** The key is derived from the full parameter set; previous results stay while the next load. */
export function useFacilities(params: FacilityListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: facilityKeys.list(params),
    queryFn: ({ signal }) => fetchFacilities(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useFacilityFilterOptions() {
  const api = useApiClient();
  return useQuery({
    queryKey: facilityKeys.filterOptions(),
    queryFn: ({ signal }) => fetchFacilityFilterOptions(api, signal),
    staleTime: FILTER_OPTIONS_STALE_MS,
  });
}

export function useFacility(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: facilityKeys.detail(id),
    queryFn: ({ signal }) => fetchFacility(api, id, signal),
  });
}
