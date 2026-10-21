import type { AuditAction, AuditEntityType } from '@/shared/api';

export const ENTITY_LABELS: Record<AuditEntityType, string> = {
  booking: 'Booking',
  user: 'User',
  terms: 'Terms and conditions',
  seating_arrangement: 'Seating arrangement',
  event_type: 'Event type',
  audit: 'Audit trail',
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  'booking.created': 'Booking started',
  'booking.submitted': 'Booking submitted',
  'booking.approved': 'Booking approved',
  'booking.rejected': 'Booking rejected',
  'booking.cancelled': 'Booking cancelled',
  'booking.reschedule_requested': 'Move requested',
  'booking.reschedule_approved': 'Move approved',
  'booking.reschedule_declined': 'Move declined',
  'user.role_changed': 'Role changed',
  'user.facilities_changed': 'Facilities changed',
  'user.deactivated': 'Account deactivated',
  'user.reactivated': 'Account reactivated',
  'terms.draft_created': 'Terms draft started',
  'terms.draft_updated': 'Terms draft edited',
  'terms.published': 'Terms published',
  'seating_arrangement.created': 'Seating arrangement added',
  'seating_arrangement.updated': 'Seating arrangement changed',
  'seating_arrangement.archived': 'Seating arrangement archived',
  'seating_arrangement.restored': 'Seating arrangement restored',
  'event_type.created': 'Event type added',
  'event_type.updated': 'Event type changed',
  'event_type.archived': 'Event type archived',
  'event_type.restored': 'Event type restored',
  'audit.exported': 'Audit exported',
};
