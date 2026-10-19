import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { STEP_IDS, type StepId } from './config';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;

/**
 * The booking form's place in the URL: where it is (`step`), which draft it belongs to, and the
 * facility and window handed over by the calendar. The step lives here so a reload or a shared
 * link returns to the same place.
 */
export interface BookingUrlState {
  facilityId: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
  draft: string | undefined;
  step: StepId | undefined;
}

export const bookingCodec = createParamsCodec<BookingUrlState>({
  facilityId: param.matching(/^[\w-]+$/),
  startsAt: param.matching(ISO_INSTANT),
  endsAt: param.matching(ISO_INSTANT),
  draft: param.matching(/^[\w-]+$/),
  step: param.oneOfOptional(STEP_IDS),
});
