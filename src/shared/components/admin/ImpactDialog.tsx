import { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import type { ImpactedBooking, ImpactReason, ImpactResult } from '@/shared/api';
import { compactWindow } from '@/shared/utils/format';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { Badge } from '../ui/Badge';

/** What each reason means for the booking it names, in a sentence. */
const REASON_COPY: Record<ImpactReason, (item: ImpactedBooking) => string> = {
  inside_blackout: (item) =>
    item.day
      ? `The closure falls on ${DateTime.fromISO(item.day).setLocale('en').toFormat('cccc d LLLL')}, one day of this booking. The booking is one unit, so all of it is affected.`
      : 'Falls inside the closure.',
  outside_operating_hours: () => 'Would fall outside the new operating hours.',
  new_conflict: (item) =>
    item.conflictsWith
      ? `Would now clash with ${item.conflictsWith.reference} at ${item.conflictsWith.facility.name}.`
      : 'Would now clash with another booking.',
  over_capacity: () => 'Expects more people than the new capacity allows.',
  facility_unavailable: () => 'The facility would no longer be available for it.',
  resource_shortfall: () => 'The facility would hold fewer than it asks for.',
  resource_withdrawn: () => 'It asks for something the facility would no longer offer.',
  resource_archived: () => 'It asks for a resource that would no longer be offered.',
  no_approver: () => 'Nobody would be designated to decide this request.',
  arrangement_archived: () =>
    'It uses a seating arrangement that would no longer be offered. The booking is left as it is.',
};

/** For a resource reason, exactly what was asked for and what would be held. */
function describeResource(item: ImpactedBooking): string | null {
  const resource = item.resource;
  if (!resource) return null;
  if (item.reason === 'resource_archived') return `${resource.name}: asked for, to be archived`;
  if (resource.available === null)
    return `${resource.name}: asked for, would no longer be available`;
  return `${resource.name}: ${resource.requested} asked for, ${resource.available} would be held`;
}

export interface ImpactListProps {
  impact: ImpactResult;
  describeReason?: (item: ImpactedBooking) => string;
}

/** The bookings a change reaches: reference, who, where, when, status and why. */
export function ImpactList({ impact, describeReason }: ImpactListProps) {
  return (
    <ul
      aria-label="Affected bookings"
      className="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto p-0"
    >
      {impact.affectedBookings.map((item) => (
        <li
          key={`${item.bookingId}:${item.resource?.id ?? ''}`}
          className="rounded-md border border-line bg-sunken p-3 text-ink"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">{item.reference}</span>
            <Badge tone={item.status === 'approved' ? 'primary' : 'warning'}>
              {item.status === 'approved' ? 'Approved' : 'Pending'}
            </Badge>
          </div>
          <p>
            {item.applicantName} · {item.facility.name}
          </p>
          <p className="text-sm text-muted">
            {compactWindow(item.startsAt, item.endsAt, item.facility.timeZone)}
          </p>
          {describeResource(item) && (
            <p className="mt-1 text-sm font-medium">{describeResource(item)}</p>
          )}
          <p className="mt-1 text-sm font-medium">
            {(describeReason ?? ((i) => REASON_COPY[i.reason](i)))(item)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export interface ImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the change is, in a sentence. */
  summary: ReactNode;
  impact: ImpactResult;
  confirmLabel: string;
  describeReason?: (item: ImpactedBooking) => string;
  /** What else is lost, when that is not a booking: for example allocations that will be discarded. */
  details?: ReactNode;
  onConfirm: () => Promise<void>;
}

/**
 * Shown when a change would reach bookings that already exist: names each one and asks for explicit
 * confirmation. It says plainly that confirming decides nothing about those bookings.
 */
export function ImpactDialog({
  open,
  onOpenChange,
  title,
  summary,
  impact,
  confirmLabel,
  describeReason,
  details,
  onConfirm,
}: ImpactDialogProps) {
  const count = impact.totalAffected;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title={title}
      description={
        <div className="flex flex-col gap-2">
          <p>{summary}</p>
          {details}
          {count > 0 && (
            <p className="font-medium text-ink">
              {count === 1 ? '1 booking is affected:' : `${count} bookings are affected:`}
            </p>
          )}
        </div>
      }
      confirmLabel={confirmLabel}
      cancelLabel="Go back"
      onConfirm={onConfirm}
    >
      {count > 0 && (
        <>
          <ImpactList impact={impact} describeReason={describeReason} />
          <p className="text-sm text-muted">
            Confirming does not cancel or move any of these bookings, and nobody is notified. What
            happens to each one is a separate decision for you to make.
          </p>
        </>
      )}
    </ConfirmDialog>
  );
}
