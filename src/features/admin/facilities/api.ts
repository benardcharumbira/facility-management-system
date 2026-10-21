import type {
  AdminBlackout,
  AdminFacility,
  AdminFacilityImage,
  AdminFacilityList,
  AdminFacilityListParams,
  ApiClient,
  Approver,
  BookingOptions,
  CreateBlackoutRequest,
  CreateFacilityRequest,
  CreateFacilityTypeRequest,
  FacilityCapacity,
  FacilitySchedule,
  FacilityType,
  ImpactResult,
  ProposedChange,
  UpdateFacilityRequest,
  UpdateFacilityTypeRequest,
  UpdateImageRequest,
} from '@/shared/api';
import { createQueryKeys } from '@/shared/api';

export const adminFacilityKeys = {
  ...createQueryKeys('admin-facilities'),
  list: (params: AdminFacilityListParams) => ['admin-facilities', 'list', params] as const,
  blackouts: (id: string) => ['admin-facilities', 'blackouts', id] as const,
  types: () => ['admin-facilities', 'types'] as const,
  candidates: () => ['admin-facilities', 'candidates'] as const,
  arrangements: () => ['admin-facilities', 'arrangements'] as const,
};

const base = (id: string) => `/admin/facilities/${encodeURIComponent(id)}`;

export const fetchAdminFacilities = (
  api: ApiClient,
  params: AdminFacilityListParams,
  signal?: AbortSignal,
) => api.get<AdminFacilityList>('/admin/facilities', { query: { ...params }, signal });

export const fetchAdminFacility = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<AdminFacility>(base(id), { signal });

export const fetchBlackouts = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<AdminBlackout[]>(`${base(id)}/blackouts`, { signal });

export const fetchFacilityTypes = (api: ApiClient, signal?: AbortSignal) =>
  api.get<FacilityType[]>('/admin/facility-types', { signal });

export const fetchApproverCandidates = (api: ApiClient, signal?: AbortSignal) =>
  api.get<Approver[]>('/admin/approver-candidates', { signal });

/** The seating arrangements the booking form offers. Their vocabulary is managed elsewhere. */
export const fetchArrangementNames = async (api: ApiClient, signal?: AbortSignal) =>
  (await api.get<BookingOptions>('/booking-options', { signal })).seatingArrangements.map(
    (s) => s.name,
  );

export const createFacility = (api: ApiClient, body: CreateFacilityRequest) =>
  api.post<AdminFacility>('/admin/facilities', { body });

export const updateFacility = (api: ApiClient, id: string, body: UpdateFacilityRequest) =>
  api.patch<AdminFacility>(base(id), { body });

/** What a proposed change would reach. Decides nothing. */
export const checkImpact = (api: ApiClient, id: string, change: ProposedChange) =>
  api.post<ImpactResult>(`${base(id)}/impact`, { body: change });

export const archiveFacility = (api: ApiClient, id: string) =>
  api.post<AdminFacility>(`${base(id)}/archive`);

export const restoreFacility = (api: ApiClient, id: string) =>
  api.post<AdminFacility>(`${base(id)}/restore`);

export const saveSchedule = (api: ApiClient, id: string, body: FacilitySchedule) =>
  api.put<FacilitySchedule>(`${base(id)}/schedule`, { body });

export const saveCapacity = (api: ApiClient, id: string, body: FacilityCapacity) =>
  api.put<FacilityCapacity>(`${base(id)}/capacity`, { body });

export const saveApprovers = (api: ApiClient, id: string, userIds: string[]) =>
  api.put<Approver[]>(`${base(id)}/approvers`, { body: { userIds } });

export const createBlackout = (api: ApiClient, id: string, body: CreateBlackoutRequest) =>
  api.post<AdminBlackout>(`${base(id)}/blackouts`, { body });

export const deleteBlackout = (api: ApiClient, id: string, blackoutId: string) =>
  api.delete<void>(`${base(id)}/blackouts/${encodeURIComponent(blackoutId)}`);

export function uploadImage(
  api: ApiClient,
  id: string,
  file: File,
  caption: string,
  onProgress: (fraction: number) => void,
) {
  const body = new FormData();
  body.set('file', file);
  body.set('caption', caption);
  return api.upload<AdminFacilityImage>(`${base(id)}/images`, body, { onProgress });
}

export const updateImage = (
  api: ApiClient,
  id: string,
  imageId: string,
  body: UpdateImageRequest,
) => api.patch<AdminFacilityImage>(`${base(id)}/images/${encodeURIComponent(imageId)}`, { body });

export const deleteImage = (api: ApiClient, id: string, imageId: string) =>
  api.delete<void>(`${base(id)}/images/${encodeURIComponent(imageId)}`);

export const createFacilityType = (api: ApiClient, body: CreateFacilityTypeRequest) =>
  api.post<FacilityType>('/admin/facility-types', { body });

export const updateFacilityType = (api: ApiClient, id: string, body: UpdateFacilityTypeRequest) =>
  api.patch<FacilityType>(`/admin/facility-types/${encodeURIComponent(id)}`, { body });
