import { useFormContext } from 'react-hook-form';
import type { BookingOptions, FacilityDetail } from '@/shared/api';
import {
  CheckboxField,
  Disclosure,
  ReviewList,
  type ReviewItem,
  type UploadItem,
} from '@/shared/components';
import type { StepId } from '../config';
import { describeWindow } from '@/shared/utils/format';
import { fieldId, type BookingFormValues } from '../schema';

export function StepReview({
  options,
  facility,
  zone,
  documents,
  goTo,
}: {
  options: BookingOptions;
  facility: FacilityDetail | undefined;
  zone: string | undefined;
  documents: UploadItem[];
  goTo: (step: StepId, field?: keyof BookingFormValues) => void;
}) {
  const { watch, setValue, formState } = useFormContext<BookingFormValues>();
  const values = watch();
  const window = zone ? describeWindow(values.startsAt, values.endsAt, zone) : null;
  const nameOf = (list: Array<{ id: string; name: string }>, id: string) =>
    list.find((item) => item.id === id)?.name ?? '';
  const requested = (category: 'venue' | 'kitchen') =>
    options.resources
      .filter((r) => r.category === category && values.resources[r.id] !== undefined)
      .map((r) => `${r.name} × ${values.resources[r.id]}`);
  const venue = requested('venue');
  const kitchen = requested('kitchen');
  const list = (items: string[]) =>
    items.length === 0 ? (
      'None requested'
    ) : (
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );

  const items: ReviewItem[] = [
    { key: 'facility', label: 'Venue', value: facility?.name ?? '', onEdit: () => goTo('when') },
    { key: 'date', label: 'Date', value: window?.date ?? '', onEdit: () => goTo('when') },
    {
      key: 'time',
      label: 'Time',
      value: window ? `${window.time} (${zone} time)` : '',
      onEdit: () => goTo('when'),
    },
    {
      key: 'event-type',
      label: 'Type of meeting or event',
      value: nameOf(options.eventTypes, values.eventTypeId),
      onEdit: () => goTo('details', 'eventTypeId'),
    },
    {
      key: 'description',
      label: 'Event description',
      value: <span className="whitespace-pre-wrap">{values.description}</span>,
      onEdit: () => goTo('details', 'description'),
    },
    {
      key: 'attendees',
      label: 'Expected attendees',
      value: values.attendeeCount,
      onEdit: () => goTo('details', 'attendeeCount'),
    },
    {
      key: 'seating',
      label: 'Seating arrangement',
      value: nameOf(options.seatingArrangements, values.seatingArrangementId),
      onEdit: () => goTo('details', 'seatingArrangementId'),
    },
    {
      key: 'venue-resources',
      label: 'Venue resources',
      value: list(venue),
      onEdit: () => goTo('resources'),
    },
    {
      key: 'kitchen-resources',
      label: 'Kitchen resources',
      value: list(kitchen),
      onEdit: () => goTo('resources'),
    },
    {
      key: 'documents',
      label: 'Documents',
      value: list(documents.filter((d) => d.status === 'done').map((d) => d.name)),
      onEdit: () => goTo('documents'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base">
        Check your answers. Select Edit beside anything you want to change.
      </p>
      <ReviewList items={items} />

      <section aria-labelledby="terms-heading" className="flex flex-col gap-3">
        <h3 id="terms-heading" className="text-base font-semibold">
          {options.terms.title}
        </h3>
        <Disclosure summary="Read the terms and conditions">
          <div className="flex flex-col gap-2">
            {options.terms.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="text-sm text-muted">Version {options.terms.version}</p>
          </div>
        </Disclosure>
        <CheckboxField
          id={fieldId('termsAccepted')}
          checked={values.termsAccepted}
          onChange={(accepted) =>
            setValue('termsAccepted', accepted, {
              shouldValidate: formState.isSubmitted || !!formState.errors.termsAccepted,
              shouldDirty: true,
            })
          }
          label={`I accept the terms and conditions (version ${options.terms.version})`}
          error={formState.errors.termsAccepted?.message}
        />
      </section>

      <p className="text-sm text-muted">
        Submitting sends your request for approval and holds the time for you while it is
        considered. It is not confirmed until it has been approved.
      </p>
    </div>
  );
}
