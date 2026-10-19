import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ForumIcon from '@mui/icons-material/Forum';
import GroupsIcon from '@mui/icons-material/Groups';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import ParkIcon from '@mui/icons-material/Park';
import PoolIcon from '@mui/icons-material/Pool';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import type { SvgIconProps } from '@mui/material/SvgIcon';

/** Fallback artwork for facilities without a photo, chosen by type. Decorative. */
export function FacilityTypeIcon({ typeId, ...props }: SvgIconProps & { typeId: string }) {
  switch (typeId) {
    case 'community-hall':
      return <GroupsIcon aria-hidden {...props} />;
    case 'civic-hall':
      return <AccountBalanceIcon aria-hidden {...props} />;
    case 'board-room':
      return <MeetingRoomIcon aria-hidden {...props} />;
    case 'committee-room':
      return <ForumIcon aria-hidden {...props} />;
    case 'sports-field':
      return <SportsSoccerIcon aria-hidden {...props} />;
    case 'court':
      return <SportsTennisIcon aria-hidden {...props} />;
    case 'swimming-pool':
      return <PoolIcon aria-hidden {...props} />;
    case 'open-space':
      return <ParkIcon aria-hidden {...props} />;
    default:
      return <ApartmentIcon aria-hidden {...props} />;
  }
}
