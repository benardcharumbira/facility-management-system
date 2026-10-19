import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApiClient, type ApiClient, type FacilityAvailability } from '@/shared/api';
import {
  addMonths,
  compareYearMonth,
  monthGridRange,
  type YearMonth,
} from '@/shared/utils/calendar';
import { facilityKeys } from '../api';

const STALE_MS = 60_000;

export interface MonthAvailability {
  month: YearMonth;
  availability: FacilityAvailability;
}

/** Date arithmetic only, so the zone is irrelevant here; the response carries the real one. */
const DATE_ARITHMETIC_ZONE = 'utc';

function monthQuery(api: ApiClient, facilityId: string, month: YearMonth) {
  const { from, to } = monthGridRange(month, DATE_ARITHMETIC_ZONE);
  return queryOptions({
    queryKey: [...facilityKeys.detail(facilityId), 'availability', from, to] as const,
    queryFn: async ({ signal }): Promise<MonthAvailability> => ({
      month,
      availability: await api.get<FacilityAvailability>(
        `/facilities/${encodeURIComponent(facilityId)}/availability`,
        { query: { from, to }, signal },
      ),
    }),
    staleTime: STALE_MS,
  });
}

/**
 * One query per month grid, keyed by its date range. The previous month's data stays in place
 * while the next loads, and `data.month` says which month the data belongs to.
 */
export function useMonthAvailability(facilityId: string, month: YearMonth) {
  const api = useApiClient();
  return useQuery({ ...monthQuery(api, facilityId, month), placeholderData: keepPreviousData });
}

/** Warms the cache for the months either side, within the reachable range. */
export function usePrefetchAdjacentMonths(
  facilityId: string,
  month: YearMonth,
  range: { min: YearMonth; max: YearMonth },
  enabled: boolean,
) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || !range) return;
    for (const delta of [1, -1]) {
      const target = addMonths(month, delta);
      if (compareYearMonth(target, range.min) < 0 || compareYearMonth(target, range.max) > 0)
        continue;
      void queryClient.prefetchQuery(monthQuery(api, facilityId, target));
    }
  }, [api, enabled, facilityId, month, queryClient, range]);
}
