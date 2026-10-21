import { Link, Navigate, useParams } from 'react-router';
import { isApiProblem } from '@/shared/api';
import {
  Badge,
  buttonStyles,
  ConfirmationPanel,
  ErrorState,
  LoadingState,
  NotFoundState,
  usePageHeader,
} from '@/shared/components';
import { describeWindow } from '@/shared/utils/format';
import { useBooking, useBookingOptions } from '../hooks';
import { bookingLink } from '../links';

export default function BookingConfirmationPage() {
  const { id = '' } = useParams();
  const booking = useBooking(id);
  const options = useBookingOptions();
  usePageHeader('Request received');

  if (booking.isError) {
    return isApiProblem(booking.error) && booking.error.status === 404 ? (
      <NotFoundState
        title="We could not find that booking"
        description="The link may be out of date."
        action={{ label: 'Browse venues', to: '/facilities' }}
      />
    ) : (
      <ErrorState problem={booking.error} onRetry={() => void booking.refetch()} />
    );
  }
  if (!booking.data) return <LoadingState />;

  const data = booking.data;
  if (data.status === 'draft') {
    return (
      <Navigate to={`/bookings/new?draft=${encodeURIComponent(data.id)}&step=review`} replace />
    );
  }

  const window = describeWindow(data.startsAt, data.endsAt, data.facility.timeZone);
  const turnaround = options.data?.expectedTurnaround;

  return (
    <ConfirmationPanel
      title="Your request has been received"
      summary="We have sent it for approval and are holding the time for you while it is considered."
      referenceLabel="Booking reference"
      reference={data.reference}
      status={<Badge tone="primary">Status: Pending</Badge>}
      details={[
        { label: 'Venue', value: data.facility.name },
        { label: 'Date', value: window.date },
        { label: 'Time', value: `${window.time} (${data.facility.timeZone} time)` },
        { label: 'Status', value: 'Pending approval' },
      ]}
      actions={
        <>
          <Link to={bookingLink(data.id)} className={buttonStyles()}>
            View this booking
          </Link>
          <Link to="/facilities" className={buttonStyles({ variant: 'secondary' })}>
            Browse venues
          </Link>
        </>
      }
    >
      <section aria-labelledby="next-heading" className="flex flex-col gap-2">
        <h2 id="next-heading" className="text-lg font-semibold">
          What happens next
        </h2>
        <p className="font-medium">Your request is not confirmed until it has been approved.</p>
        <p className="text-muted">
          The municipality will review your request{turnaround ? ` ${turnaround}` : ''} and let you
          know the outcome. Keep your booking reference, {data.reference}, for any enquiry.
        </p>
      </section>
    </ConfirmationPanel>
  );
}
