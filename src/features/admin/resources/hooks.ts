import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient, type AdminResourceListParams } from '@/shared/api';
import {
  adminResourceKeys,
  fetchFacilityAllocations,
  fetchMatrix,
  fetchResource,
  fetchResources,
} from './api';

export function useResources(params: AdminResourceListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminResourceKeys.list(params),
    queryFn: ({ signal }) => fetchResources(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useResource(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminResourceKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchResource(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Always fresh when opened: the grid edits what is there now, not what was there a minute ago. */
export function useMatrix() {
  const api = useApiClient();
  return useQuery({
    queryKey: adminResourceKeys.matrix(),
    queryFn: ({ signal }) => fetchMatrix(api, signal),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useFacilityAllocations(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminResourceKeys.facility(id ?? ''),
    queryFn: ({ signal }) => fetchFacilityAllocations(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * After a change: refresh administration, and everything the public sees that it may have reached
 * (the facilities' resources and amenities, the booking form's resources, the approvers' context).
 */
export function useRefreshAfterResourceChange() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminResourceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals'] }),
      ]),
    [queryClient],
  );
}
