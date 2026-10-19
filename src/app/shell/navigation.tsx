import ApartmentIcon from '@mui/icons-material/Apartment';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import InventoryIcon from '@mui/icons-material/Inventory2';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import type { ReactNode } from 'react';
import type { Role } from '@/shared/auth';
import { ACCESS, PATHS } from '../access';

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  /** Omit for every authenticated user. */
  roles?: readonly Role[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Facilities', to: PATHS.facilities, icon: <ApartmentIcon /> },
  { label: 'My bookings', to: PATHS.bookings, icon: <EventNoteIcon />, roles: ACCESS.bookers },
  {
    label: 'Approvals',
    to: PATHS.approvals,
    icon: <FactCheckIcon />,
    roles: ACCESS.facilityAdmins,
  },
  {
    label: 'Manage facilities',
    to: PATHS.adminFacilities,
    icon: <MeetingRoomIcon />,
    roles: ACCESS.facilityAdmins,
  },
  {
    label: 'Manage resources',
    to: PATHS.adminResources,
    icon: <InventoryIcon />,
    roles: ACCESS.facilityAdmins,
  },
  {
    label: 'Users',
    to: PATHS.adminUsers,
    icon: <ManageAccountsIcon />,
    roles: ACCESS.systemAdmins,
  },
];

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
