import { z } from 'zod';
import { MAX_DESCRIPTION_LENGTH, type StepId } from './config';

/** What the form holds. Strings stay strings until they are sent. */
export interface BookingFormValues {
  facilityId: string;
  startsAt: string;
  endsAt: string;
  eventTypeId: string;
  description: string;
  attendeeCount: string;
  seatingArrangementId: string;
  /** Resource id to quantity. Only requested resources are present. */
  resources: Record<string, number>;
  termsAccepted: boolean;
}

export const whenSchema = z.object({
  facilityId: z.string().min(1, 'Choose a facility.'),
  startsAt: z.string().min(1, 'Choose a start time.'),
  endsAt: z.string().min(1, 'Choose an end time.'),
});

export const detailsSchema = z.object({
  eventTypeId: z.string().min(1, 'Choose the type of meeting or event.'),
  description: z
    .string()
    .trim()
    .min(1, 'Describe the event.')
    .max(MAX_DESCRIPTION_LENGTH, `Use ${MAX_DESCRIPTION_LENGTH} characters or fewer.`),
  attendeeCount: z
    .string()
    .trim()
    .min(1, 'Enter the number of people expected.')
    .regex(/^\d+$/, 'Enter a whole number, such as 40.')
    .refine((value) => Number(value) >= 1, 'There must be at least 1 person.'),
  seatingArrangementId: z.string().min(1, 'Choose a seating arrangement.'),
});

export const resourcesSchema = z.object({
  resources: z.record(z.string(), z.number().int().min(1, 'A quantity must be at least 1.')),
});

export const reviewSchema = z.object({
  termsAccepted: z
    .boolean()
    .refine(
      (accepted) => accepted,
      'You must accept the terms and conditions before you can submit.',
    ),
});

/** One schema for the whole booking, composed from the step schemas. */
export const bookingSchema = z.object({
  ...whenSchema.shape,
  ...detailsSchema.shape,
  ...resourcesSchema.shape,
  ...reviewSchema.shape,
});

type FieldName = keyof BookingFormValues;

/** The fields each step is responsible for. Validating a step validates exactly these. */
export const STEP_FIELDS: Record<StepId, FieldName[]> = {
  when: ['facilityId', 'startsAt', 'endsAt'],
  details: ['eventTypeId', 'description', 'attendeeCount', 'seatingArrangementId'],
  resources: ['resources'],
  documents: [],
  review: ['termsAccepted'],
};

export function stepOfField(field: string): StepId | undefined {
  return (Object.keys(STEP_FIELDS) as StepId[]).find((step) =>
    STEP_FIELDS[step].some((name) => field === name || field.startsWith(`${name}.`)),
  );
}

/** The id of the control for a field, for error links and "edit" focus. */
export const fieldId = (name: string) => `booking-${name}`;
