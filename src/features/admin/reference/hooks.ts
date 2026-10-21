import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient } from '@/shared/api';
import { adminReferenceKeys, fetchTerms, fetchVocabulary, type Vocabulary } from './api';

export function useVocabulary(path: Vocabulary) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminReferenceKeys.vocabulary(path),
    queryFn: ({ signal }) => fetchVocabulary(api, path, signal),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useTerms() {
  const api = useApiClient();
  return useQuery({
    queryKey: adminReferenceKeys.terms(),
    queryFn: ({ signal }) => fetchTerms(api, signal),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * After a change: refresh administration, and what these drive: the booking form's lists and
 * terms, the capacity editor's arrangements, the figures the public sees, and the audit trail.
 */
export function useRefreshAfterReferenceChange() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminReferenceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-audit'] }),
      ]),
    [queryClient],
  );
}
