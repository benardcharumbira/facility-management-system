import { Ban, CircleCheck, CircleX, FilePenLine, Hourglass, type LucideIcon } from 'lucide-react';
import type { BookingStatus } from '@/shared/api';
import { StatusBadge, type Pattern } from '@/shared/components';

/**
 * How each booking status looks. Built only from the existing vocabulary: the calendar's fill
 * patterns, icons and the semantic colour tokens, so a status differs by pattern, icon and
 * words, never by colour alone.
 */
interface StatusStyle {
  label: string;
  icon: LucideIcon;
  pattern: Pattern;
  className: string;
}

export const STATUS_STYLES: Record<BookingStatus, StatusStyle> = {
  draft: { label: 'Draft', icon: FilePenLine, pattern: 'dashed', className: 'text-muted' },
  pending: { label: 'Pending', icon: Hourglass, pattern: 'striped', className: 'text-warning' },
  approved: { label: 'Approved', icon: CircleCheck, pattern: 'solid', className: 'text-primary' },
  rejected: { label: 'Rejected', icon: CircleX, pattern: 'crosshatch', className: 'text-danger' },
  cancelled: { label: 'Cancelled', icon: Ban, pattern: 'outline', className: 'text-subtle' },
};

export function BookingStatusBadge({
  status,
  size,
}: {
  status: BookingStatus;
  size?: 'md' | 'lg';
}) {
  const style = STATUS_STYLES[status];
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
