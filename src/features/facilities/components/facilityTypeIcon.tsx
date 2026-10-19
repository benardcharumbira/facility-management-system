import {
  Building2,
  Goal,
  Landmark,
  MessagesSquare,
  Presentation,
  Trees,
  Users,
  Volleyball,
  Waves,
  type LucideProps,
} from 'lucide-react';

/** Fallback artwork for facilities without a photo, chosen by type. Decorative. */
export function FacilityTypeIcon({ typeId, ...props }: LucideProps & { typeId: string }) {
  switch (typeId) {
    case 'community-hall':
      return <Users aria-hidden {...props} />;
    case 'civic-hall':
      return <Landmark aria-hidden {...props} />;
    case 'board-room':
      return <Presentation aria-hidden {...props} />;
    case 'committee-room':
      return <MessagesSquare aria-hidden {...props} />;
    case 'sports-field':
      return <Goal aria-hidden {...props} />;
    case 'court':
      return <Volleyball aria-hidden {...props} />;
    case 'swimming-pool':
      return <Waves aria-hidden {...props} />;
    case 'open-space':
      return <Trees aria-hidden {...props} />;
    default:
      return <Building2 aria-hidden {...props} />;
  }
}
