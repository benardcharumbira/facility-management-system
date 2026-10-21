import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient, type AdminUserListParams } from '@/shared/api';
import { adminUserKeys, fetchUser, fetchUsers } from './api';

export function useUsers(params: AdminUserListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: ({ signal }) => fetchUsers(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Always fresh when opened: what a person may do depends on who else is an administrator now. */
export function useUser(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminUserKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchUser(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * After a change to a person: refresh the users, the facilities whose approvers they are, the
 * approval queues their role decides, the audit trail that records it, and who the people are.
 */
export function useRefreshAfterUserChange() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminUserKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
      ]),
    [queryClient],
  );
}
