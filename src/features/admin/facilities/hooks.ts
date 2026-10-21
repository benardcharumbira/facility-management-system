import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient, type AdminFacilityListParams } from '@/shared/api';
import {
  adminFacilityKeys,
  fetchAdminFacilities,
  fetchAdminFacility,
  fetchApproverCandidates,
  fetchArrangementNames,
  fetchBlackouts,
  fetchFacilityTypes,
} from './api';

export function useAdminFacilities(params: AdminFacilityListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.list(params),
    queryFn: ({ signal }) => fetchAdminFacilities(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Always fresh when opened: what an administrator edits must be what is there now. */
export function useAdminFacility(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchAdminFacility(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useBlackouts(id: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.blackouts(id),
    queryFn: ({ signal }) => fetchBlackouts(api, id, signal),
    staleTime: 0,
  });
}

export function useFacilityTypes() {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.types(),
    queryFn: ({ signal }) => fetchFacilityTypes(api, signal),
  });
}

export function useApproverCandidates() {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.candidates(),
    queryFn: ({ signal }) => fetchApproverCandidates(api, signal),
  });
}

export function useArrangementNames() {
  const api = useApiClient();
  return useQuery({
    queryKey: adminFacilityKeys.arrangements(),
    queryFn: ({ signal }) => fetchArrangementNames(api, signal),
    staleTime: 5 * 60_000,
  });
}

/**
 * After a change: refresh administration, and everything the public sees that the change may have
 * reached (browse, detail and availability), and the approval queues, whose scope approvers set.
 */
export function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminFacilityKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'facility'] }),
      ]),
    [queryClient],
  );
}
