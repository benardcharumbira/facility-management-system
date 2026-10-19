import type {
  ApiClient,
  BookingListItem,
  BookingListParams,
  BookingsSummary,
  CancelBookingRequest,
  RescheduleBookingRequest,
  Booking,
  BookingDocument,
  BookingOptions,
  CreateBookingRequest,
  FacilityAvailability,
  FacilityDetail,
  FacilityListResponse,
  UpdateBookingRequest,
} from '@/shared/api';
import { createQueryKeys } from '@/shared/api';
import type { Paginated } from '@/shared/types/pagination';

export const bookingKeys = {
  ...createQueryKeys('bookings'),
  options: () => ['bookings', 'options'] as const,
  facility: (id: string) => ['bookings', 'facility', id] as const,
  slot: (facilityId: string, startsAt: string, endsAt: string) =>
    ['bookings', 'slot-check', facilityId, startsAt, endsAt] as const,
  list: (params: BookingListParams) => ['bookings', 'list', params] as const,
  summary: (params: BookingListParams) => ['bookings', 'summary', params] as const,
  picker: (q: string) => ['bookings', 'facility-picker', q] as const,
};

export const fetchOptions = (api: ApiClient, signal?: AbortSignal) =>
  api.get<BookingOptions>('/booking-options', { signal });

export const fetchBooking = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<Booking>(`/bookings/${encodeURIComponent(id)}`, { signal });

export const createDraft = (api: ApiClient, body: CreateBookingRequest) =>
  api.post<Booking>('/bookings', { body });

/** Writes the draft. Never holds or reserves time: only `submit` does that. */
export const updateDraft = (api: ApiClient, id: string, body: UpdateBookingRequest) =>
  api.patch<Booking>(`/bookings/${encodeURIComponent(id)}`, { body });

export const submitBooking = (api: ApiClient, id: string) =>
  api.post<Booking>(`/bookings/${encodeURIComponent(id)}/submit`);

export const deleteDocument = (api: ApiClient, id: string, documentId: string) =>
  api.delete<void>(
    `/bookings/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
  );

export function uploadDocument(
  api: ApiClient,
  id: string,
  file: File,
  onProgress: (fraction: number) => void,
) {
  const body = new FormData();
  body.set('file', file);
  return api.upload<BookingDocument>(`/bookings/${encodeURIComponent(id)}/documents`, body, {
    onProgress,
  });
}

export const fetchFacilityDetail = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<FacilityDetail>(`/facilities/${encodeURIComponent(id)}`, { signal });

export const searchFacilities = (api: ApiClient, q: string, signal?: AbortSignal) =>
  api.get<FacilityListResponse>('/facilities', {
    query: { q: q || undefined, pageSize: 12, sort: 'name' },
    signal,
  });

export const fetchAvailabilityRange = (
  api: ApiClient,
  facilityId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  api.get<FacilityAvailability>(`/facilities/${encodeURIComponent(facilityId)}/availability`, {
    query: { from, to },
    signal,
  });

export const fetchBookings = (api: ApiClient, params: BookingListParams, signal?: AbortSignal) =>
  api.get<Paginated<BookingListItem>>('/bookings', { query: { ...params }, signal });

export const fetchBookingsSummary = (
  api: ApiClient,
  params: BookingListParams,
  signal?: AbortSignal,
) => api.get<BookingsSummary>('/bookings/summary', { query: { ...params }, signal });

export const cancelBooking = (api: ApiClient, id: string, body: CancelBookingRequest) =>
  api.post<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { body });

export const requestReschedule = (api: ApiClient, id: string, body: RescheduleBookingRequest) =>
  api.post<Booking>(`/bookings/${encodeURIComponent(id)}/reschedule`, { body });

export const deleteDraft = (api: ApiClient, id: string) =>
  api.delete<void>(`/bookings/${encodeURIComponent(id)}`);

export const downloadDocument = (api: ApiClient, id: string, documentId: string) =>
  api.download(`/bookings/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`);
