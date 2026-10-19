import { useFormContext } from 'react-hook-form';
import type { BookingOptions, FacilityDetail } from '@/shared/api';
import { Alert, controlStyles, FormField } from '@/shared/components';
import { MAX_DESCRIPTION_LENGTH } from '../config';
import { fieldId, type BookingFormValues } from '../schema';

/** The capacity that applies to this seating arrangement, if the venue lists one. */
function capacityFor(facility: FacilityDetail | undefined, arrangement: string | undefined) {
  if (!facility) return null;
  const match = facility.capacityByArrangement?.find(
    (c) => c.arrangement.toLowerCase() === arrangement?.toLowerCase(),
  );
  if (match)
    return {
      capacity: match.capacity,
      label: `${match.arrangement.toLowerCase()} seating at ${facility.name}`,
    };
  return facility.capacity === null
    ? null
    : { capacity: facility.capacity, label: `the maximum capacity of ${facility.name}` };
}

export function StepDetails({
  options,
  facility,
}: {
  options: BookingOptions;
  facility: FacilityDetail | undefined;
}) {
  const { register, watch, formState } = useFormContext<BookingFormValues>();
  const { errors } = formState;
  const description = watch('description');
  const attendees = Number.parseInt(watch('attendeeCount'), 10);
  const arrangementId = watch('seatingArrangementId');
  const arrangementName = options.seatingArrangements.find((s) => s.id === arrangementId)?.name;
  const limit = capacityFor(facility, arrangementName);
  const overCapacity = limit !== null && Number.isFinite(attendees) && attendees > limit.capacity;

  return (
    <div className="flex flex-col gap-5">
      <FormField
        id={fieldId('eventTypeId')}
        label="Type of meeting or event"
        required
        error={errors.eventTypeId?.message}
      >
        {(control) => (
          <select {...control} {...register('eventTypeId')} className={`${controlStyles} h-11`}>
            <option value="">Choose…</option>
            {options.eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id={fieldId('description')}
        label="Event description"
        required
        hint={`Tell us what the event is and anything the venue should know. Up to ${MAX_DESCRIPTION_LENGTH} characters.`}
        error={errors.description?.message}
      >
        {(control) => (
          <>
            <textarea
              {...control}
              {...register('description')}
              rows={5}
              className={`${controlStyles} py-2`}
            />
            <p
              aria-live="polite"
              className={
                description.length > MAX_DESCRIPTION_LENGTH
                  ? 'text-sm font-medium text-danger'
                  : 'text-sm text-muted'
              }
            >
              {`${description.length} of ${MAX_DESCRIPTION_LENGTH} characters`}
            </p>
          </>
        )}
      </FormField>

      <FormField
        id={fieldId('seatingArrangementId')}
        label="Seating arrangement"
        required
        error={errors.seatingArrangementId?.message}
      >
        {(control) => (
          <select
            {...control}
            {...register('seatingArrangementId')}
            className={`${controlStyles} h-11`}
          >
            <option value="">Choose…</option>
            {options.seatingArrangements.map((arrangement) => (
              <option key={arrangement.id} value={arrangement.id}>
                {arrangement.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id={fieldId('attendeeCount')}
        label="Expected attendees"
        required
        hint="The number of people you expect, including organisers."
        error={errors.attendeeCount?.message}
      >
        {(control) => (
          <input
            {...control}
            {...register('attendeeCount')}
            inputMode="numeric"
            className={`${controlStyles} h-11 max-w-40`}
          />
        )}
      </FormField>

      {overCapacity && limit && (
        <Alert severity="warning" title="This is more than the venue is listed for">
          You expect {attendees} people, but {limit.label} lists {limit.capacity}. You can still
          continue: the municipality will check this when it reviews your request.
        </Alert>
      )}
    </div>
  );
}
