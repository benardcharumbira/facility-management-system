import { Download } from 'lucide-react';
import type { Booking, BookingOptions } from '@/shared/api';
import { Button, formatBytes, ReviewList, type ReviewItem } from '@/shared/components';
import { allResources, describeRequest } from '../resources';

function resourceList(
  booking: Booking,
  options: BookingOptions | undefined,
  category: 'venue' | 'kitchen',
) {
  const names = new Map(allResources(options).map((r) => [r.id, r]));
  const items = booking.resources
    .filter((r) => names.get(r.resourceId)?.category === category)
    .map((r) =>
      describeRequest(
        names.get(r.resourceId)?.name ?? r.resourceId,
        r.quantity,
        names.get(r.resourceId)?.quantified ?? true,
      ),
    );
  return items;
}

const asList = (items: string[]) =>
  items.length === 0 ? (
    'None requested'
  ) : (
    <ul className="m-0 list-none p-0">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

/** Everything that was submitted, as the same label and value rows the review step uses. */
export function BookingDetails({
  booking,
  options,
  onDownload,
}: {
  booking: Booking;
  options: BookingOptions | undefined;
  onDownload: (documentId: string, name: string) => void;
}) {
  const nameOf = (list: Array<{ id: string; name: string }> | undefined, id: string | null) =>
    list?.find((item) => item.id === id)?.name ?? '';

  const items: ReviewItem[] = [
    {
      key: 'type',
      label: 'Type of meeting or event',
      value: nameOf(options?.eventTypes, booking.eventTypeId) || 'Not given',
    },
    {
      key: 'description',
      label: 'Event description',
      value: <span className="whitespace-pre-wrap">{booking.description || 'Not given'}</span>,
    },
    { key: 'attendees', label: 'Expected attendees', value: booking.attendeeCount ?? 'Not given' },
    {
      key: 'seating',
      label: 'Seating arrangement',
      value: nameOf(options?.seatingArrangements, booking.seatingArrangementId) || 'Not given',
    },
    {
      key: 'venue',
      label: 'Venue resources',
      value: asList(resourceList(booking, options, 'venue')),
    },
    {
      key: 'kitchen',
      label: 'Kitchen resources',
      value: asList(resourceList(booking, options, 'kitchen')),
    },
    {
      key: 'documents',
      label: 'Documents',
      value:
        booking.documents.length === 0 ? (
          'None attached'
        ) : (
          <ul aria-label="Documents" className="m-0 flex list-none flex-col gap-2 p-0">
            {booking.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="[overflow-wrap:anywhere]">{doc.name}</span>
                <span className="text-sm text-muted">{formatBytes(doc.sizeBytes)}</span>
                <Button variant="secondary" size="sm" onClick={() => onDownload(doc.id, doc.name)}>
                  <Download aria-hidden className="size-4" />
                  {`Download ${doc.name}`}
                </Button>
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return <ReviewList items={items} />;
}
