import { CalendarClock, CalendarPlus, type LucideIcon } from 'lucide-react';
import type { WorkItemType } from '@/shared/api';
import { StatusBadge, type Pattern } from '@/shared/components';

/**
 * The two kinds of work in the queue, told apart by pattern, icon and words together: a new
 * request is an outline with a plus; a change of date is dotted with a clock.
 */
interface WorkTypeStyle {
  label: string;
  icon: LucideIcon;
  pattern: Pattern;
  className: string;
}

export const WORK_TYPE_STYLES: Record<WorkItemType, WorkTypeStyle> = {
  booking_request: {
    label: 'New request',
    icon: CalendarPlus,
    pattern: 'outline',
    className: 'text-primary',
  },
  reschedule_request: {
    label: 'Change of date',
    icon: CalendarClock,
    pattern: 'dotted',
    className: 'text-warning',
  },
};

export function WorkTypeBadge({ type, size }: { type: WorkItemType; size?: 'md' | 'lg' }) {
  const style = WORK_TYPE_STYLES[type];
  const Icon = style.icon;
  return (
    <StatusBadge
      label={style.label}
      icon={<Icon className="size-4" />}
      pattern={style.pattern}
      className={style.className}
      size={size}
    />
  );
}
