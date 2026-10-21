import type { Booking, BookingOptions } from '@/shared/api';
import { PrintOnly } from '@/shared/components';
import { describeWindow } from '@/shared/utils/format';
import { arrangementName, eventTypeName } from '../optionNames';
import { allResources, describeRequest } from '../resources';

/**
 * The record a person takes to the venue: reference, venue, time, event details and the approved
 * resources, on one clean page. Hidden on screen and shown only when printing; the rest of the
 * page (and the shell around it) is left out of the print.
 */
export function PrintBooking({
  booking,
  options,
}: {
  booking: Booking;
  options: BookingOptions | undefined;
}) {
  const window = describeWindow(booking.startsAt, booking.endsAt, booking.facility.timeZone);
  const resources = booking.resources.map((r) => {
    const resource = allResources(options).find((o) => o.id === r.resourceId);
    return {
      id: r.resourceId,
      name: resource?.name ?? r.resourceId,
      quantity: r.quantity,
      quantified: resource?.quantified ?? true,
      category: resource?.category,
    };
  });
  const group = (category: 'venue' | 'kitchen') => resources.filter((r) => r.category === category);
  const row = (label: string, value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? null : (
      <div className="flex gap-4 border-b border-line py-2">
        <dt className="w-48 shrink-0 font-semibold">{label}</dt>
        <dd className="m-0">{value}</dd>
      </div>
    );

  return (
    <PrintOnly>
      <article aria-label="Printable booking">
        <p className="text-2xl font-semibold">Booking confirmation</p>
        <p className="mt-1 text-lg">Reference {booking.reference}</p>
        <dl className="m-0 mt-4">
          {row('Status', 'Approved')}
          {row('Venue', booking.facility.name)}
          {row(
            window.span ? 'Dates' : 'Date',
            window.span ? `${window.date}, ${window.length}` : window.date,
          )}
          {row('Time', `${window.time} (${booking.facility.timeZone} time)`)}
          {row('Event type', eventTypeName(options, booking.eventTypeId))}
          {row('Event description', booking.description)}
          {row('Expected attendees', booking.attendeeCount)}
          {row('Seating arrangement', arrangementName(options, booking.seatingArrangementId))}
          {row(
            'Venue resources',
            group('venue')
              .map((r) => describeRequest(r.name, r.quantity, r.quantified))
              .join(', ') || 'None',
          )}
          {row(
            'Kitchen resources',
            group('kitchen')
              .map((r) => describeRequest(r.name, r.quantity, r.quantified))
              .join(', ') || 'None',
          )}
        </dl>
        <p className="mt-6 text-sm">Keep this page and bring it with you to the venue.</p>
      </article>
    </PrintOnly>
  );
}
