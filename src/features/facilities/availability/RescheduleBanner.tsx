import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Link } from 'react-router';
import { useApiClient, type Booking } from '@/shared/api';
import { Alert } from '@/shared/components';

/**
 * Shown while choosing a new time for an existing booking, so the applicant can see what they
 * hold. The booking itself appears on the calendar as booked, and does not move until the
 * municipality decides.
 */
export function RescheduleBanner({ bookingId }: { bookingId: string }) {
  const api = useApiClient();
  const booking = useQuery({
    queryKey: ['facilities', 'reschedule-booking', bookingId],
    queryFn: ({ signal }) =>
      api.get<Booking>(`/bookings/${encodeURIComponent(bookingId)}`, { signal }),
  });
  if (!booking.data) return null;

  const zone = booking.data.facility.timeZone;
  const start = DateTime.fromISO(booking.data.startsAt, { zone: 'utc' })
    .setZone(zone)
    .setLocale('en');
  const end = DateTime.fromISO(booking.data.endsAt, { zone: 'utc' }).setZone(zone);

  return (
    <Alert severity="info" title={`Choosing a new time for booking ${booking.data.reference}`}>
      <p>
        You currently hold {start.toFormat('cccc d LLLL yyyy')}, {start.toFormat('HH:mm')} to{' '}
        {end.toFormat('HH:mm')}. It shows on the calendar as booked. Choosing a time here sends a
        request; your booking stays as it is until the municipality decides.
      </p>
      <Link
        to={`/bookings/${encodeURIComponent(bookingId)}`}
        className="mt-2 inline-block font-medium underline underline-offset-2"
      >
        Keep my current booking
      </Link>
    </Alert>
  );
}
