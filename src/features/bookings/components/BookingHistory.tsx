import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleX,
  FilePlus2,
  Send,
} from 'lucide-react';
import type { Booking, BookingHistoryEntry } from '@/shared/api';
import { ActivityLog, type ActivityEntry } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';

const TITLES: Record<BookingHistoryEntry['type'], string> = {
  created: 'Request started',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  reschedule_requested: 'Change of date requested',
  reschedule_approved: 'Change of date approved',
  reschedule_declined: 'Change of date declined',
};
const ICONS: Record<BookingHistoryEntry['type'], React.ReactNode> = {
  created: <FilePlus2 className="size-3.5" />,
  submitted: <Send className="size-3.5" />,
  approved: <CircleCheck className="size-3.5" />,
  rejected: <CircleX className="size-3.5" />,
  cancelled: <Ban className="size-3.5" />,
  reschedule_requested: <CalendarClock className="size-3.5" />,
  reschedule_approved: <CalendarCheck className="size-3.5" />,
  reschedule_declined: <CalendarX className="size-3.5" />,
};

/** The applicant facing view of the audit trail: what happened, when, and who did it. */
export function BookingHistory({ booking }: { booking: Booking }) {
  const entries: ActivityEntry[] = booking.history.map((entry) => ({
    key: entry.id,
    title: TITLES[entry.type],
    when: dateAndTime(entry.at, booking.facility.timeZone),
    dateTime: entry.at,
    actor:
      entry.actor === 'applicant'
        ? 'you'
        : entry.actor === 'municipality'
          ? 'the municipality'
          : undefined,
    detail: entry.note ?? undefined,
    icon: ICONS[entry.type],
  }));
  return <ActivityLog entries={entries} label="Booking history" />;
}
