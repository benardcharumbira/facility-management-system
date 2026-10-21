import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DateTime } from 'luxon';
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

const fetchRange = (
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

/**
 * The month grid, a week and the days of a span all ask the same endpoint. Each is cached under
 * its own kind of key, because each keeps a different thing beside the data (the month it belongs
 * to, the week it starts on).
 */
const keyFor = (facilityId: string, kind: 'month' | 'week' | 'range', from: string, to: string) =>
  [...facilityKeys.detail(facilityId), 'availability', kind, from, to] as const;

function monthQuery(api: ApiClient, facilityId: string, month: YearMonth) {
  const { from, to } = monthGridRange(month, DATE_ARITHMETIC_ZONE);
  return queryOptions({
    queryKey: keyFor(facilityId, 'month', from, to),
    queryFn: async ({ signal }): Promise<MonthAvailability> => ({
      month,
      availability: await fetchRange(api, facilityId, from, to, signal),
    }),
    staleTime: STALE_MS,
  });
}

/**
 * One query per month grid, keyed by its date range. The previous month's data stays in place
 * while the next loads, and `data.month` says which month the data belongs to.
 */
export function useMonthAvailability(facilityId: string, month: YearMonth, enabled = true) {
  const api = useApiClient();
  return useQuery({
    ...monthQuery(api, facilityId, month),
    enabled,
    placeholderData: keepPreviousData,
  });
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

export interface WeekAvailability {
  /** The Monday the data starts on, as an ISO date. */
  weekStart: string;
  availability: FacilityAvailability;
}

const weekRange = (monday: DateTime) => ({
  from: monday.toISODate() ?? '',
  to: monday.plus({ days: 6 }).toISODate() ?? '',
});

function weekQuery(api: ApiClient, facilityId: string, monday: DateTime) {
  const { from, to } = weekRange(monday);
  return queryOptions({
    queryKey: keyFor(facilityId, 'week', from, to),
    queryFn: async ({ signal }): Promise<WeekAvailability> => ({
      weekStart: from,
      availability: await fetchRange(api, facilityId, from, to, signal),
    }),
    staleTime: STALE_MS,
  });
}

/**
 * A week, Monday to Sunday. As with the month, the week on screen stays in place while the next
 * loads, and `data.weekStart` says which week the data belongs to.
 */
export function useWeekAvailability(facilityId: string, monday: DateTime, enabled: boolean) {
  const api = useApiClient();
  return useQuery({
    ...weekQuery(api, facilityId, monday),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Warms the weeks either side, within the reachable range (Mondays, inclusive). */
export function usePrefetchAdjacentWeeks(
  facilityId: string,
  monday: DateTime,
  range: { min: DateTime; max: DateTime },
  enabled: boolean,
) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const key = monday.toISODate();
  const min = range.min.toMillis();
  const max = range.max.toMillis();
  useEffect(() => {
    if (!enabled) return;
    for (const delta of [1, -1]) {
      const target = monday.plus({ weeks: delta });
      if (target.toMillis() < min || target.toMillis() > max) continue;
      void queryClient.prefetchQuery(weekQuery(api, facilityId, target));
    }
    // `monday` is a new object each render; its date is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, enabled, facilityId, key, min, max, queryClient]);
}

/** The days of a chosen span, asked for exactly, so the panel judges it on current data. */
export function useSpanAvailability(
  facilityId: string,
  from: string,
  to: string,
  enabled: boolean,
) {
  const api = useApiClient();
  return useQuery({
    queryKey: keyFor(facilityId, 'range', from, to),
    queryFn: ({ signal }) => fetchRange(api, facilityId, from, to, signal),
    enabled,
    staleTime: 0,
  });
}
