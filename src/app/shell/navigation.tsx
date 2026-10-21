import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  Package,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role } from '@/shared/auth';
import { ApprovalsNavBadge } from '@/features/approvals/components/ApprovalsNavBadge';
import { ACCESS, PATHS } from '../access';

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** Omit for every authenticated user. */
  roles?: readonly Role[];
  /** Shown at the end of the item, e.g. a count. */
  badge?: ReactNode;
}

const icon = 'size-5 shrink-0';

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Facilities', to: PATHS.facilities, icon: <Building2 aria-hidden className={icon} /> },
  {
    label: 'My bookings',
    to: PATHS.bookings,
    icon: <CalendarDays aria-hidden className={icon} />,
    roles: ACCESS.bookers,
  },
  {
    label: 'Approvals',
    to: PATHS.approvals,
    icon: <ClipboardCheck aria-hidden className={icon} />,
    roles: ACCESS.approvers,
    badge: <ApprovalsNavBadge />,
  },
  {
    label: 'Manage facilities',
    to: PATHS.adminFacilities,
    icon: <DoorOpen aria-hidden className={icon} />,
    roles: ACCESS.facilityAdmins,
  },
  {
    label: 'Manage resources',
    to: PATHS.adminResources,
    icon: <Package aria-hidden className={icon} />,
    roles: ACCESS.facilityAdmins,
  },
  {
    label: 'Users',
    to: PATHS.adminUsers,
    icon: <UsersRound aria-hidden className={icon} />,
    roles: ACCESS.systemAdmins,
  },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
