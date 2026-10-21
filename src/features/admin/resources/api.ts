import type {
  AdminResource,
  AdminResourceList,
  AdminResourceListParams,
  AllocationChange,
  AllocationMatrix,
  ApiClient,
  CreateResourceRequest,
  FacilityAllocations,
  ResourceImpactResult,
  ResourceProposedChange,
  SetFacilityAllocationsRequest,
  UpdateResourceRequest,
} from '@/shared/api';
import { createQueryKeys } from '@/shared/api';

export const adminResourceKeys = {
  ...createQueryKeys('admin-resources'),
  list: (params: AdminResourceListParams) => ['admin-resources', 'list', params] as const,
  matrix: () => ['admin-resources', 'matrix'] as const,
  facility: (id: string) => ['admin-resources', 'facility', id] as const,
};

const base = (id: string) => `/admin/resources/${encodeURIComponent(id)}`;

export const fetchResources = (
  api: ApiClient,
  params: AdminResourceListParams,
  signal?: AbortSignal,
) => api.get<AdminResourceList>('/admin/resources', { query: { ...params }, signal });

export const fetchResource = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<AdminResource>(base(id), { signal });

export const createResource = (api: ApiClient, body: CreateResourceRequest) =>
  api.post<AdminResource>('/admin/resources', { body });

export const updateResource = (api: ApiClient, id: string, body: UpdateResourceRequest) =>
  api.patch<AdminResource>(base(id), { body });

/** What a change to a catalogue entry would reach. Decides nothing. */
export const checkResourceImpact = (api: ApiClient, id: string, change: ResourceProposedChange) =>
  api.post<ResourceImpactResult>(`${base(id)}/impact`, { body: change });

export const archiveResource = (api: ApiClient, id: string) =>
  api.post<AdminResource>(`${base(id)}/archive`);

export const restoreResource = (api: ApiClient, id: string) =>
  api.post<AdminResource>(`${base(id)}/restore`);

export const fetchMatrix = (api: ApiClient, signal?: AbortSignal) =>
  api.get<AllocationMatrix>('/admin/resource-allocations', { signal });

/** One check over a whole batch of pending edits. */
export const checkBatchImpact = (api: ApiClient, changes: AllocationChange[]) =>
  api.post<ResourceImpactResult>('/admin/resource-allocations/impact', { body: { changes } });

/** Applies every change or none. */
export const saveBatch = (api: ApiClient, changes: AllocationChange[]) =>
  api.put<{ applied: number }>('/admin/resource-allocations', { body: { changes } });

export const fetchFacilityAllocations = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<FacilityAllocations>(`/admin/facilities/${encodeURIComponent(id)}/resources`, { signal });

export const saveFacilityAllocations = (
  api: ApiClient,
  id: string,
  body: SetFacilityAllocationsRequest,
) =>
  api.put<FacilityAllocations>(`/admin/facilities/${encodeURIComponent(id)}/resources`, { body });
