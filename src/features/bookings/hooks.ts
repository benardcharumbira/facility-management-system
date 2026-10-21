import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useApiClient, type BookingListParams } from '@/shared/api';
import { rulesOf, spanProblem, type WindowProblem } from '@/shared/utils/availability';
import {
  bookingKeys,
  fetchAvailabilityRange,
  fetchBooking,
  fetchBookings,
  fetchBookingsSummary,
  fetchFacilityDetail,
  fetchOptions,
  searchFacilities,
} from './api';

const OPTIONS_STALE_MS = 5 * 60_000;

export function useBookingOptions() {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.options(),
    queryFn: ({ signal }) => fetchOptions(api, signal),
    staleTime: OPTIONS_STALE_MS,
  });
}

export function useBooking(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.detail(id ?? ''),
    queryFn: ({ signal }) => fetchBooking(api, id ?? '', signal),
    enabled: id !== undefined,
  });
}

export function useFacilityDetail(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.facility(id ?? ''),
    queryFn: ({ signal }) => fetchFacilityDetail(api, id ?? '', signal),
    enabled: id !== undefined && id !== '',
  });
}

export function useFacilitySearch(q: string) {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.picker(q),
    queryFn: ({ signal }) => searchFacilities(api, q, signal),
  });
}

export interface SlotCheck {
  zone: string;
  /** Null when the window can still be booked. */
  problem: WindowProblem | null;
}

/**
 * Re-checks the chosen window against live availability, so a slot that has gone since the
 * calendar was viewed is reported on arrival rather than after five steps. Never cached: every
 * entry checks afresh.
 */
export function useSlotCheck(facilityId: string, startsAt: string, endsAt: string) {
  const api = useApiClient();
  const enabled = facilityId !== '' && startsAt !== '' && endsAt !== '';
  return useQuery({
    queryKey: bookingKeys.slot(facilityId, startsAt, endsAt),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ signal }): Promise<SlotCheck> => {
      const start = DateTime.fromISO(startsAt, { zone: 'utc' });
      const end = DateTime.fromISO(endsAt, { zone: 'utc' });
      // The facility's zone is not known until the answer arrives, so ask for the days around.
      const availability = await fetchAvailabilityRange(
        api,
        facilityId,
        start.minus({ days: 1 }).toISODate() ?? '',
        DateTime.min(end.plus({ days: 1 }), start.plus({ days: 60 })).toISODate() ?? '',
        signal,
      );
      const rules = rulesOf(availability);
      return {
        zone: rules.timeZone,
        problem: spanProblem(
          { start, end },
          (date) => availability.days.find((d) => d.date === date),
          rules,
          DateTime.now(),
        ),
      };
    },
  });
}

/** The caller's bookings. Previous results stay on screen while the next page or filter loads. */
export function useBookings(params: BookingListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: ({ signal }) => fetchBookings(api, params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Counts that follow the filters (not the page or the sort), to tell the empty states apart. */
export function useBookingsSummary(filters: BookingListParams) {
  const api = useApiClient();
  return useQuery({
    queryKey: bookingKeys.summary(filters),
    queryFn: ({ signal }) => fetchBookingsSummary(api, filters, signal),
    placeholderData: keepPreviousData,
  });
}
