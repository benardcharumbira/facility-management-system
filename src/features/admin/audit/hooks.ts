import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiClient, type AuditQueryParams } from '@/shared/api';
import { adminAuditKeys, fetchAudit } from './api';

export function useAudit(params: AuditQueryParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: adminAuditKeys.list(params),
    queryFn: ({ signal }) => fetchAudit(api, params, signal),
    placeholderData: keepPreviousData,
  });
}
