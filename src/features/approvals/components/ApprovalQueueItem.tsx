import { Ban, Clock, Hourglass, Layers } from 'lucide-react';
import type { DateTime } from 'luxon';
import type { ApprovalListItem } from '@/shared/api';
import { Badge, QueueItem } from '@/shared/components';
import { compactWindow, elapsed, shortDate } from '@/shared/utils/format';
import { urgencyOf } from '../urgency';
import { WORK_TYPE_STYLES } from '../workType';

interface ApprovalQueueItemProps {
  item: ApprovalListItem;
  selected: boolean;
  now: DateTime;
  /** The queue's query string, carried to the item so a filtered view survives selection. */
  search: string;
}

/** One work item in the queue: what it is, where, when, who, how long it has waited, and what needs hurrying. */
export function ApprovalQueueItem({ item, selected, now, search }: ApprovalQueueItemProps) {
  const zone = item.facility.timeZone;
  const type = WORK_TYPE_STYLES[item.type];
  const TypeIcon = type.icon;
  const urgency = urgencyOf(item, now);
  const move = item.type === 'reschedule_request' && item.currentWindow;

  const lines = [
    `${item.facility.name} · ${item.applicantName}`,
    move ? `Now ${compactWindow(move.startsAt, move.endsAt, zone)}` : null,
    `${move ? 'Move to ' : ''}${compactWindow(item.startsAt, item.endsAt, zone)}${
      !move && item.eventTypeName ? ` · ${item.eventTypeName}` : ''
    }`,
    item.status === 'pending'
      ? `Waiting ${elapsed(item.raisedAt, now)}`
      : `${item.status === 'approved' ? 'Approved' : 'Rejected'}${
          item.decidedAt ? ` ${shortDate(item.decidedAt, zone)}` : ''
        }`,
  ].filter((line): line is string => line !== null);

  const label = [item.reference, type.label, item.facility.name, item.applicantName].join(', ');

  return (
    <QueueItem
      itemId={item.id}
      to={`/approvals/${encodeURIComponent(item.id)}${search}`}
      selected={selected}
      label={label}
      leading={
        <span
          aria-hidden
          className={`flex size-7 items-center justify-center rounded-md bg-sunken ${type.className}`}
        >
          <TypeIcon className="size-4" />
        </span>
      }
      title={item.reference}
      lines={lines}
      flags={
        <>
          <Badge
            tone={item.type === 'reschedule_request' ? 'primary' : 'neutral'}
            className="gap-1"
          >
            <TypeIcon aria-hidden className="size-3" />
            {type.label}
          </Badge>
          {urgency.target && (
            <Badge tone={urgency.target.state === 'over' ? 'danger' : 'warning'} className="gap-1">
              <Clock aria-hidden className="size-3" />
              {urgency.target.label}
            </Badge>
          )}
          {urgency.hold && (
            <Badge tone={urgency.hold.state === 'lapsed' ? 'danger' : 'warning'} className="gap-1">
              <Hourglass aria-hidden className="size-3" />
              {urgency.hold.label}
            </Badge>
          )}
          {item.competingCount > 0 && (
            <Badge tone="warning" className="gap-1">
              <Layers aria-hidden className="size-3" />
              Competes with {item.competingCount}
            </Badge>
          )}
          {item.status === 'pending' && !item.approvable && (
            <Badge tone="danger" className="gap-1">
              <Ban aria-hidden className="size-3" />
              Cannot be approved
            </Badge>
          )}
        </>
      }
    />
  );
}
