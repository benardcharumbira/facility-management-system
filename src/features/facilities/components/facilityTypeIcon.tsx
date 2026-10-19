import {
  Building2,
  DoorOpen,
  Gavel,
  Landmark,
  MessagesSquare,
  Presentation,
  Shapes,
  Users,
  type LucideProps,
} from 'lucide-react';

/**
 * Placeholder artwork for facilities without a photo, chosen by type. Decorative. Unknown types
 * fall back to a generic building, so new types need no change here to display.
 */
export function FacilityTypeIcon({ typeId, ...props }: LucideProps & { typeId: string }) {
  switch (typeId) {
    case 'hall':
      return <Users aria-hidden {...props} />;
    case 'civic-hall':
      return <Landmark aria-hidden {...props} />;
    case 'hall-wing':
      return <DoorOpen aria-hidden {...props} />;
    case 'committee-room':
      return <MessagesSquare aria-hidden {...props} />;
    case 'board-room':
      return <Presentation aria-hidden {...props} />;
    case 'council-chamber':
      return <Gavel aria-hidden {...props} />;
    case 'activity-room':
      return <Shapes aria-hidden {...props} />;
    default:
      return <Building2 aria-hidden {...props} />;
  }
}
