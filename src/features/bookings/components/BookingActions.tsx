import { Printer } from 'lucide-react';
import { Link } from 'react-router';
import type { Booking } from '@/shared/api';
import { Button, buttonStyles } from '@/shared/components';

interface BookingActionsProps {
  booking: Booking;
  /** The facility's calendar, opened on this booking's day, for choosing a new time. */
  rescheduleHref: string;
  /** A fresh request for the same venue, prefilled. */
  newRequestHref: string;
  onCancel: () => void;
  onDelete: () => void;
}

/**
 * What the applicant can do, by status. An action is offered only if it will work: where the
 * rules forbid one, the reason is given in its place, so nobody discovers it on submission.
 */
export function BookingActions({
  booking,
  rescheduleHref,
  newRequestHref,
  onCancel,
  onDelete,
}: BookingActionsProps) {
  const { actions } = booking;
  const wide = 'w-full';

  return (
    <section
      aria-labelledby="actions-heading"
      className="rounded-lg border border-line bg-surface p-5"
    >
      <h2 id="actions-heading" className="mb-3 text-base font-semibold">
        What you can do
      </h2>
      <div className="flex flex-col gap-3">
        {booking.status === 'draft' && (
          <>
            <Link
              to={`/bookings/new?draft=${encodeURIComponent(booking.id)}`}
              className={buttonStyles({ className: wide })}
            >
              Continue editing
            </Link>
            <Button variant="secondary" onClick={onDelete} className={wide}>
              Delete draft
            </Button>
          </>
        )}

        {booking.status === 'pending' && (
          <Button variant="secondary" onClick={onCancel} className={wide}>
            Cancel request
          </Button>
        )}

        {booking.status === 'approved' && (
          <>
            {actions.reschedule.allowed ? (
              <Link to={rescheduleHref} className={buttonStyles({ className: wide })}>
                Request a change of date
              </Link>
            ) : (
              <p className="text-sm text-muted">
                {booking.rescheduleRequest
                  ? 'A change of date has been requested. It is shown below.'
                  : actions.reschedule.blockedReason}
              </p>
            )}
            {actions.cancel.allowed ? (
              <Button variant="secondary" onClick={onCancel} className={wide}>
                Cancel booking
              </Button>
            ) : (
              actions.cancel.blockedReason && (
                <p className="text-sm text-muted">{actions.cancel.blockedReason}</p>
              )
            )}
            <Button variant="secondary" onClick={() => window.print()} className={wide}>
              <Printer aria-hidden className="size-4" />
              Print this booking
            </Button>
          </>
        )}

        {(booking.status === 'rejected' || booking.status === 'cancelled') && (
          <Link to={newRequestHref} className={buttonStyles({ className: wide })}>
            {`Start a new request for ${booking.facility.name}`}
          </Link>
        )}
      </div>
    </section>
  );
}
