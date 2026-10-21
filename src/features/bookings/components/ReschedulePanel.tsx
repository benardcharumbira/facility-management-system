import { useState } from 'react';
import { Link } from 'react-router';
import { ApiProblem, SLOT_CONFLICT_PROBLEM_TYPE, type Booking } from '@/shared/api';
import { Alert, Button, buttonStyles } from '@/shared/components';
import { describeWindow } from '@/shared/utils/format';

/**
 * A proposed move, shown beside what is held now, for confirmation. It is a request: the booking
 * stays approved on its original window until the municipality decides, and the panel says so.
 */
export function ReschedulePanel({
  booking,
  proposedStartsAt,
  proposedEndsAt,
  calendarHref,
  onSend,
  onDismiss,
}: {
  booking: Booking;
  proposedStartsAt: string;
  proposedEndsAt: string;
  calendarHref: string;
  onSend: () => Promise<void>;
  onDismiss: () => void;
}) {
  const zone = booking.facility.timeZone;
  const current = describeWindow(booking.startsAt, booking.endsAt, zone);
  const proposed = describeWindow(proposedStartsAt, proposedEndsAt, zone);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const send = async () => {
    setSending(true);
    setProblem(null);
    try {
      await onSend();
    } catch (error) {
      setProblem(ApiProblem.from(error));
    } finally {
      setSending(false);
    }
  };
  const taken = problem?.status === 409 && problem.type === SLOT_CONFLICT_PROBLEM_TYPE;

  return (
    <section
      aria-labelledby="reschedule-heading"
      className="flex flex-col gap-4 rounded-lg border border-primary-line bg-primary-soft p-5"
    >
      <h2 id="reschedule-heading" className="text-lg font-semibold">
        Confirm your request to change the date
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            Your booking now
          </p>
          <p className="font-medium">{current.date}</p>
          <p>{current.time}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            Proposed new time
          </p>
          <p className="font-medium">{proposed.date}</p>
          <p>{proposed.time}</p>
        </div>
      </div>
      <p className="font-medium">
        This sends a request. Your booking stays approved on {current.date}, {current.time} until
        the municipality decides.
      </p>
      {problem && (
        <Alert
          severity="error"
          title={taken ? 'That time is no longer available' : 'We could not send your request'}
        >
          {problem.detail ?? problem.title}
          {taken && (
            <>
              {' '}
              <Link to={calendarHref} className="font-medium underline underline-offset-2">
                Choose another time
              </Link>
            </>
          )}
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void send()} disabled={sending}>
          {sending ? 'Sending…' : 'Send change request'}
        </Button>
        <Link to={calendarHref} className={buttonStyles({ variant: 'secondary' })}>
          Choose a different time
        </Link>
        <Button variant="ghost" onClick={onDismiss} disabled={sending}>
          Never mind
        </Button>
      </div>
    </section>
  );
}
