import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useApiClient } from '@/shared/api';
import { rulesOf, windowProblem, type WindowProblem } from '@/shared/utils/availability';
import {
  bookingKeys,
  fetchAvailabilityRange,
  fetchBooking,
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
        end.plus({ days: 1 }).toISODate() ?? '',
        signal,
      );
      const rules = rulesOf(availability);
      const date = start.setZone(rules.timeZone).toISODate();
      const day = availability.days.find((d) => d.date === date);
      return {
        zone: rules.timeZone,
        problem: windowProblem({ start, end }, day, rules, DateTime.now()),
      };
    },
  });
}
