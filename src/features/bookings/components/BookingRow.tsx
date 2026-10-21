import type { DateTime } from 'luxon';
import { Link, useLocation } from 'react-router';
import type { BookingListItem } from '@/shared/api';
import { Badge, buttonStyles } from '@/shared/components';
import { describeWindow, elapsed, shortDate } from '@/shared/utils/format';
import { bookingLink, facilityLink } from '../links';
import { BookingStatusBadge, STATUS_STYLES } from '@/shared/components';

const brief = (text: string) => (text.length > 100 ? `${text.slice(0, 97)}…` : text);

/** What the row says about progress: how long a request has waited, or when a draft was last saved. */
function progressLine(item: BookingListItem, now: DateTime): string | null {
  if (item.status === 'pending' && item.submittedAt) {
    return `Waiting ${elapsed(item.submittedAt, now)}, since ${shortDate(item.submittedAt, item.facility.timeZone)}`;
  }
  if (item.status === 'draft') {
    return `Last saved ${elapsed(item.updatedAt, now)} ago, on ${shortDate(item.updatedAt, item.facility.timeZone)}`;
  }
  if (item.status === 'approved') return 'Confirmed';
  if (item.status === 'rejected') return 'Declined. Open it to read the reason.';
  return 'Withdrawn';
}

/**
 * One booking. The status leads, because the question being asked is "has it been approved".
 * The reference is the single link to the booking; the venue and, for a draft, "Continue editing"
 * are separate links beside it, not nested inside it.
 */
export function BookingRow({ item, now }: { item: BookingListItem; now: DateTime }) {
  const location = useLocation();
  const window = describeWindow(item.startsAt, item.endsAt, item.facility.timeZone);
  const progress = progressLine(item, now);
  const about = [item.eventTypeName, item.description && brief(item.description)]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="relative flex w-full flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-shadow hover:shadow-md has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary sm:flex-row sm:items-start sm:gap-5">
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:w-44">
        <BookingStatusBadge status={item.status} size="lg" />
        {progress && <p className="text-sm text-muted">{progress}</p>}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-base leading-6 font-semibold">
          <Link
            to={bookingLink(item.id)}
            state={{ fromList: location.search }}
            aria-label={`${item.reference}, ${STATUS_STYLES[item.status].label}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {item.reference}
          </Link>
        </h3>
        <p className="mt-0.5">
          <Link
            to={facilityLink(item.facility.id)}
            className="relative z-10 text-primary underline underline-offset-2"
          >
            {item.facility.name}
          </Link>
        </p>
        <p className="text-muted">{window.text}</p>
        {about && <p className="mt-1 [overflow-wrap:anywhere] text-muted">{about}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {item.isPast && <Badge>Past event</Badge>}
          {item.hasPendingReschedule && <Badge tone="primary">Change of date requested</Badge>}
        </div>
      </div>

      {item.status === 'draft' && !item.isPast && (
        <Link
          to={`/bookings/new?draft=${encodeURIComponent(item.id)}`}
          className={buttonStyles({ variant: 'secondary', className: 'relative z-10 self-start' })}
        >
          Continue editing
        </Link>
      )}
    </article>
  );
}
