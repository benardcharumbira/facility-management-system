import type { Booking, BookingFields } from '@/shared/api';
import type { StepId } from './config';
import type { BookingFormValues } from './schema';

export const EMPTY_VALUES: BookingFormValues = {
  facilityId: '',
  startsAt: '',
  endsAt: '',
  eventTypeId: '',
  description: '',
  attendeeCount: '',
  seatingArrangementId: '',
  resources: {},
  termsAccepted: false,
};

/** The parameters that may arrive from the calendar and override what a draft holds. */
export interface WindowParams {
  facilityId: string | undefined;
  startsAt: string | undefined;
  endsAt: string | undefined;
}

export function valuesFrom(
  booking: Booking | null,
  params: WindowParams,
  termsVersion: string,
): BookingFormValues {
  const base: BookingFormValues = booking
    ? {
        facilityId: booking.facilityId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        eventTypeId: booking.eventTypeId ?? '',
        description: booking.description,
        attendeeCount: booking.attendeeCount === null ? '' : String(booking.attendeeCount),
        seatingArrangementId: booking.seatingArrangementId ?? '',
        resources: Object.fromEntries(booking.resources.map((r) => [r.resourceId, r.quantity])),
        termsAccepted: booking.acceptedTermsVersion === termsVersion,
      }
    : EMPTY_VALUES;
  // A window chosen on the calendar always wins over what the draft was holding.
  return {
    ...base,
    facilityId: params.facilityId ?? base.facilityId,
    startsAt: params.startsAt ?? base.startsAt,
    endsAt: params.endsAt ?? base.endsAt,
  };
}

export function toFields(values: BookingFormValues, termsVersion: string): BookingFields {
  const attendees = Number.parseInt(values.attendeeCount, 10);
  return {
    facilityId: values.facilityId,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    eventTypeId: values.eventTypeId || null,
    description: values.description,
    attendeeCount: Number.isFinite(attendees) ? attendees : null,
    seatingArrangementId: values.seatingArrangementId || null,
    resources: Object.entries(values.resources).map(([resourceId, quantity]) => ({
      resourceId,
      quantity,
    })),
    acceptedTermsVersion: values.termsAccepted ? termsVersion : null,
  };
}

/** Where to resume a draft that is opened without a step: the first thing still missing. */
export function resumeStep(booking: Booking): StepId {
  const detailsDone =
    booking.eventTypeId !== null &&
    booking.description.trim() !== '' &&
    booking.attendeeCount !== null &&
    booking.seatingArrangementId !== null;
  return detailsDone ? 'review' : 'details';
}
