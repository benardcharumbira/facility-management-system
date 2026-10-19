import { Link } from 'react-router';
import { DateTime } from 'luxon';
import type { ApiProblem, SlotConflictExtensions } from '@/shared/api';
import { Alert, buttonStyles } from '@/shared/components';

/**
 * The lost race: another request took the slot between choosing it and submitting. Says what
 * happened and why in plain words, reassures that nothing was lost, and offers the way back.
 */
export function ConflictNotice({
  problem,
  zone,
  calendarHref,
}: {
  problem: ApiProblem;
  zone: string;
  calendarHref: string;
}) {
  const extensions = problem.extensions as Partial<SlotConflictExtensions>;
  const window = extensions.conflictingWindow;
  const related = extensions.relatedFacility;
  const times =
    window &&
    `${DateTime.fromISO(window.startsAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm')} to ${DateTime.fromISO(window.endsAt, { zone: 'utc' }).setZone(zone).toFormat('HH:mm')}`;

  return (
    <Alert severity="error" title="That time is no longer available">
      <p>
        {related
          ? `${related.name} ${related.relationship === 'parent' ? 'contains this space' : 'is part of this venue'} and is now booked${times ? ` from ${times}` : ''}, which blocks your request.`
          : `Someone else has now booked or is holding${times ? ` ${times}` : ' that time'}. ${extensions.reason ?? ''}`.trim()}
      </p>
      <p className="mt-1">
        Nothing you entered has been lost. Choose another time on the calendar and you will come
        straight back to this request.
      </p>
      <Link to={calendarHref} className={buttonStyles({ variant: 'secondary', className: 'mt-3' })}>
        Choose another time
      </Link>
    </Alert>
  );
}
