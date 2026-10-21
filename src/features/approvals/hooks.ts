import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, type ApprovalDetail, type ApprovalListParams } from '@/shared/api';
import {
  approvalKeys,
  approveItem,
  fetchApproval,
  fetchApprovalCounts,
  fetchApprovals,
  rejectItem,
} from './api';

/** The caller's queue. Previous results stay on screen while the next filter or page loads. */
export function useApprovals(params: ApprovalListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: approvalKeys.list(params),
    queryFn: ({ signal }) => fetchApprovals(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

/**
 * One work item with its decision context. Always fetched afresh on selection: who competes with
 * it changes as other requests are decided, and a decision made on stale competition is the
 * mistake this screen exists to prevent.
 */
export function useApprovalDetail(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: approvalKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchApproval(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Pending counts for the navigation badge and the facility filter. Refreshed when the window is
 * focused again, so the number is right when someone comes back to it. Never polled.
 */
export function useApprovalCounts(enabled = true) {
  const api = useApiClient();
  return useQuery({
    queryKey: approvalKeys.counts(),
    queryFn: ({ signal }) => fetchApprovalCounts(api, signal),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export type Decision = { kind: 'approve'; note?: string } | { kind: 'reject'; reason: string };

/**
 * Decides one item. Afterwards everything that depends on it is refreshed and awaited, so the
 * caller can move to the next item knowing the queue is current. The caller presents failures.
 */
export function useDecide() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, decision }: { item: ApprovalDetail; decision: Decision }) =>
      decision.kind === 'approve'
        ? approveItem(api, item, { note: decision.note?.trim() ? decision.note : undefined })
        : rejectItem(api, item, { reason: decision.reason }),
    meta: { silent: true },
    onSuccess: async (decided) => {
      queryClient.setQueryData(approvalKeys.detail(decided.id), decided);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: approvalKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: approvalKeys.counts() }),
        // The applicant's side, and the calendar, change with the decision.
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['facilities'] }),
      ]);
    },
  });
}
