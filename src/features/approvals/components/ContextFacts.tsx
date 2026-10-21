import { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import type { ApprovalDetail } from '@/shared/api';
import { Alert } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * The facts that bear on the decision, and nothing about the person beyond how often they have
 * booked this venue. Factual and minimal: no scoring, no profile.
 */
export function ContextFacts({ detail }: { detail: ApprovalDetail }) {
  const { context, facility } = detail;
  const { capacity } = context;
  const days = context.turnaroundTargetHours === null ? null : context.turnaroundTargetHours / 24;

  return (
    <dl className="m-0 divide-y divide-line">
      <Fact label="Capacity">
        <p>
          {capacity.expectedAttendees === null
            ? 'Expected attendees not given.'
            : capacity.limit === null
              ? `${capacity.expectedAttendees} expected. The capacity for ${
                  capacity.arrangement
                    ? `${capacity.arrangement.toLowerCase()} seating`
                    : 'this arrangement'
                } is not known.`
              : `${capacity.expectedAttendees} expected. ${facility.name} holds ${capacity.limit} with ${capacity.arrangement?.toLowerCase()} seating.`}
        </p>
        {context.capacityWarning && (
          <Alert severity="warning" className="mt-2">
            {context.capacityWarning}
          </Alert>
        )}
      </Fact>
      <Fact label="Resources">
        {context.resourceWarning ? (
          <Alert severity="warning">{context.resourceWarning}</Alert>
        ) : (
          'What was asked for is within what the venue holds.'
        )}
      </Fact>
      <Fact label="Previous bookings">
        {context.applicantPreviousBookingsAtFacility === 0
          ? `None before at ${facility.name}.`
          : `${context.applicantPreviousBookingsAtFacility} previous ${
              context.applicantPreviousBookingsAtFacility === 1 ? 'booking' : 'bookings'
            } at ${facility.name}.`}
      </Fact>
      <Fact label="Decision target">
        {days === null
          ? 'No target is set for this venue.'
          : `Within ${days} ${days === 1 ? 'day' : 'days'} of ${
              detail.type === 'booking_request' ? 'submission' : 'the request'
            }, by ${dateAndTime(
              DateTime.fromISO(detail.raisedAt, { zone: 'utc' })
                .plus({ hours: context.turnaroundTargetHours ?? 0 })
                .toUTC()
                .toISO() ?? '',
              facility.timeZone,
            )}.`}
      </Fact>
    </dl>
  );
}
