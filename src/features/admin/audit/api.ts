import {
  createQueryKeys,
  type ApiClient,
  type AuditFilters,
  type AuditList,
  type AuditQueryParams,
} from '@/shared/api';

export const adminAuditKeys = createQueryKeys('admin-audit');

export const fetchAudit = (api: ApiClient, params: AuditQueryParams, signal?: AbortSignal) =>
  api.get<AuditList>('/admin/audit', { query: { ...params }, signal });

/** The CSV for these filters. The server refuses without both ends of a date range, and records the export. */
export function exportAudit(api: ApiClient, filters: AuditFilters): Promise<Blob> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== '') query.append(key, String(item));
    }
  }
  return api.download(`/admin/audit/export?${query.toString()}`);
}
