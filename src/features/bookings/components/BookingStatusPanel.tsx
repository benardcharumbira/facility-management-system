import type { DateTime } from 'luxon';
import type { Booking } from '@/shared/api';
import { describeWindow, elapsed, shortDate } from '@/shared/utils/format';

/**
 * The answer to "has it been approved", and what happens next, in words, directly under the
 * header. Rejection reasons are given in full and are not softened.
 */
export function BookingStatusPanel({
  booking,
  expectedTurnaround,
  now,
}: {
  booking: Booking;
  expectedTurnaround: string | null | undefined;
  now: DateTime;
}) {
  const zone = booking.facility.timeZone;
  const original = describeWindow(booking.startsAt, booking.endsAt, zone);
  const lines: React.ReactNode[] = [];
  let title: string;

  switch (booking.status) {
    case 'draft':
      title = 'This request has not been sent yet';
      lines.push(
        `You started it ${elapsed(booking.history[0]?.at ?? booking.updatedAt, now)} ago and last saved it on ${shortDate(booking.updatedAt, zone)}. Nothing is held for you until you submit it.`,
        'Continue editing to finish the request and send it for approval.',
      );
      break;
    case 'pending':
      title = 'The municipality is reviewing your request';
      lines.push(
        `It was submitted on ${shortDate(booking.submittedAt ?? booking.updatedAt, zone)} and has been waiting ${elapsed(booking.submittedAt ?? booking.updatedAt, now)}.`,
      );
      if (expectedTurnaround) lines.push(`We expect to reply ${expectedTurnaround}.`);
      if (booking.holdExpiresAt) {
        lines.push(
          `While it waits, your request holds this time until ${shortDate(booking.holdExpiresAt, zone)}. If it has not been decided by then, the time is released.`,
        );
      }
      lines.push('It is not confirmed until it has been approved.');
      break;
    case 'approved':
      title = 'Your booking is confirmed';
      lines.push(`${booking.facility.name} is booked for you on ${original.text}.`);
      if (booking.rescheduleRequest) {
        const proposed = describeWindow(
          booking.rescheduleRequest.proposedStartsAt,
          booking.rescheduleRequest.proposedEndsAt,
          zone,
        );
        lines.push(
          `You have asked to move it to ${proposed.text}. Until the municipality decides, your booking stays approved on its original time.`,
        );
      }
      break;
    case 'rejected':
      title = 'This request was declined';
      lines.push(
        `The municipality declined it${booking.decidedAt ? ` on ${shortDate(booking.decidedAt, zone)}` : ''}. Their reason:`,
        <blockquote
          key="reason"
          className="my-1 border-l-4 border-danger-line pl-4 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink"
        >
          {booking.rejectionReason ?? 'No reason was recorded.'}
        </blockquote>,
      );
      break;
    case 'cancelled': {
      title = 'This booking was cancelled';
      const by = booking.cancellation?.cancelledBy === 'municipality' ? 'the municipality' : 'you';
      lines.push(
        `It was cancelled by ${by}${booking.cancellation ? ` on ${shortDate(booking.cancellation.cancelledAt, zone)}` : ''}. The time has been released.`,
      );
      if (booking.cancellation?.reason) lines.push(`Reason given: ${booking.cancellation.reason}`);
      break;
    }
  }

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-lg border border-line bg-surface p-5"
    >
      <h2 id="status-heading" className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 flex max-w-prose flex-col gap-2 text-base">
        {lines.map((line, index) => (typeof line === 'string' ? <p key={index}>{line}</p> : line))}
      </div>
    </section>
  );
}
