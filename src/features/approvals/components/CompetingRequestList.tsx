import { Link } from 'react-router';
import type { CompetingRequest } from '@/shared/api';
import { Badge } from '@/shared/components';
import { compactDate, compactWindow } from '@/shared/utils/format';
import { WORK_TYPE_STYLES } from '../workType';

interface CompetingRequestListProps {
  requests: CompetingRequest[];
  /** The facility being decided, to phrase how the others relate to it. */
  facilityName: string;
  zone: string;
  /** The queue's query string, so opening a competitor keeps the filtered view. */
  search: string;
  label: string;
}

function relation(request: CompetingRequest, facilityName: string): string {
  switch (request.relationship) {
    case 'same_facility':
      return `Wants ${facilityName} too, at an overlapping time.`;
    case 'parent':
      return `Wants ${request.facility.name}, which contains ${facilityName}, at an overlapping time.`;
    case 'child':
      return `Wants ${request.facility.name}, which is part of ${facilityName}, at an overlapping time.`;
  }
}

/**
 * Each request that competes with the one in front of the approver, or already stands in its
 * way: its reference (a link to it in the queue), who asked, what for, where it overlaps, how it
 * relates to this venue, and when it was submitted.
 */
export function CompetingRequestList({
  requests,
  facilityName,
  zone,
  search,
  label,
}: CompetingRequestListProps) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
      {requests.map((request) => {
        const type = WORK_TYPE_STYLES[request.workItemType];
        return (
          <li
            key={request.workItemId}
            className="rounded-md border border-warning-line bg-warning-soft/40 p-3"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">
                {request.inYourQueue ? (
                  <Link
                    to={`/approvals/${encodeURIComponent(request.workItemId)}${search}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {request.reference}
                  </Link>
                ) : (
                  request.reference
                )}
              </span>
              <Badge>{type.label}</Badge>
              {!request.inYourQueue && <Badge>Not in your queue</Badge>}
            </div>
            <p className="mt-1">
              {request.applicantName} · {request.facility.name}
            </p>
            <p className="text-sm text-muted">{relation(request, facilityName)}</p>
            <p className="text-sm text-muted">
              Asks for {compactWindow(request.startsAt, request.endsAt, zone)}. Overlap:{' '}
              {compactWindow(request.overlap.startsAt, request.overlap.endsAt, zone)}. Submitted{' '}
              {compactDate(request.submittedAt, zone)}.
            </p>
          </li>
        );
      })}
    </ul>
  );
}
