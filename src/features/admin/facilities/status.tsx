import { Archive, CircleCheck, CircleSlash, type LucideIcon } from 'lucide-react';
import type { AdminFacilityStatus } from '@/shared/api';
import { StatusBadge, type Pattern } from '@/shared/components';

/** A facility's state told by pattern, icon and words, like every status in the system. */
const STYLES: Record<
  AdminFacilityStatus,
  { label: string; icon: LucideIcon; pattern: Pattern; className: string }
> = {
  active: { label: 'Active', icon: CircleCheck, pattern: 'solid', className: 'text-primary' },
  unavailable: {
    label: 'Unavailable',
    icon: CircleSlash,
    pattern: 'striped',
    className: 'text-warning',
  },
  archived: { label: 'Archived', icon: Archive, pattern: 'outline', className: 'text-subtle' },
};

export const FACILITY_STATUS_LABELS = Object.fromEntries(
  Object.entries(STYLES).map(([status, style]) => [status, style.label]),
) as Record<AdminFacilityStatus, string>;

export function AdminStatusBadge({
  status,
  size,
}: {
  status: AdminFacilityStatus;
  size?: 'md' | 'lg';
}) {
  const style = STYLES[status];
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
