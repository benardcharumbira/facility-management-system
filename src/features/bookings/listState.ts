import {
  BOOKING_SORTS,
  BOOKING_STATUSES,
  type BookingListParams,
  type BookingSort,
  type BookingStatus,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const BOOKING_PAGE_SIZE = 20;

/** Everything My bookings keeps in the URL, so a filtered view can be shared and survives a reload. */
export interface BookingListState {
  q: string;
  status: BookingStatus[];
  from: string | undefined;
  to: string | undefined;
  facilityId: string[];
  sort: BookingSort;
  page: number;
}

export const bookingListCodec = createParamsCodec<BookingListState>({
  q: param.string(),
  status: param.stringList<BookingStatus>(),
  from: param.matching(DATE),
  to: param.matching(DATE),
  facilityId: param.stringList(),
  sort: param.oneOf(BOOKING_SORTS, 'attention'),
  page: param.positiveInt(1),
});

/** Only the filters: what the summary counts follow. */
export function toFilters(state: BookingListState): BookingListParams {
  return {
    q: state.q || undefined,
    status: state.status.filter((s) => BOOKING_STATUSES.includes(s)),
    from: state.from,
    to: state.to,
    facilityId: state.facilityId,
  };
}

export function toListParams(state: BookingListState): BookingListParams {
  return { ...toFilters(state), sort: state.sort, page: state.page, pageSize: BOOKING_PAGE_SIZE };
}

export const CLEARED_BOOKING_FILTERS: Partial<BookingListState> = {
  status: [],
  from: undefined,
  to: undefined,
  facilityId: [],
};
