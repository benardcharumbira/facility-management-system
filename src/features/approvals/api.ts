import type {
  ApiClient,
  ApproveRequest,
  ApprovalCounts,
  ApprovalDetail,
  ApprovalListItem,
  ApprovalListParams,
  RejectRequest,
  WorkItemType,
} from '@/shared/api';
import { createQueryKeys } from '@/shared/api';
import type { Paginated } from '@/shared/types/pagination';

export const approvalKeys = {
  ...createQueryKeys('approvals'),
  list: (params: ApprovalListParams) => ['approvals', 'list', params] as const,
  counts: () => ['approvals', 'counts'] as const,
};

export const fetchApprovals = (api: ApiClient, params: ApprovalListParams, signal?: AbortSignal) =>
  api.get<Paginated<ApprovalListItem>>('/approvals', { query: { ...params }, signal });

export const fetchApprovalCounts = (api: ApiClient, signal?: AbortSignal) =>
  api.get<ApprovalCounts>('/approvals/counts', { signal });

export const fetchApproval = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<ApprovalDetail>(`/approvals/${encodeURIComponent(id)}`, { signal });

export const downloadApprovalDocument = (api: ApiClient, id: string, documentId: string) =>
  api.download(`/approvals/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`);

/** Each kind of work item is decided at its own endpoint. */
const DECISION_PATH: Record<WorkItemType, string> = {
  booking_request: 'bookings',
  reschedule_request: 'reschedule-requests',
};

export const approveItem = (
  api: ApiClient,
  item: { id: string; type: WorkItemType },
  body: ApproveRequest,
) =>
  api.post<ApprovalDetail>(`/${DECISION_PATH[item.type]}/${encodeURIComponent(item.id)}/approve`, {
    body,
  });

export const rejectItem = (
  api: ApiClient,
  item: { id: string; type: WorkItemType },
  body: RejectRequest,
) =>
  api.post<ApprovalDetail>(`/${DECISION_PATH[item.type]}/${encodeURIComponent(item.id)}/reject`, {
    body,
  });
