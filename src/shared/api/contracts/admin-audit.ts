/**
 * Contract for the audit trail. Read only; the backend records, this exposes.
 *
 * ```
 * GET /api/admin/audit          filtered, newest first, paginated (the slice 2 envelope)
 * GET /api/admin/audit/export   the same filters as CSV; both ends of a date range are required
 * ```
 *
 * **System administrators only.** The trail holds personal information. Facility administrators
 * are answered 403.
 *
 * **Exports are themselves audited.** Every export records an `audit.exported` event with the
 * actor, the filters applied and the number of rows. There is no unfiltered export: without both
 * `from` and `to` the server answers 422.
 *
 * **Dates** are calendar dates in the facility time zone, inclusive at both ends. Instants are UTC.
 */
import type { Paginated } from '@/shared/types/pagination';

export const AUDIT_ENTITY_TYPES = [
  'booking',
  'user',
  'terms',
  'seating_arrangement',
  'event_type',
  'audit',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  'booking.created',
  'booking.submitted',
  'booking.approved',
  'booking.rejected',
  'booking.cancelled',
  'booking.reschedule_requested',
  'booking.reschedule_approved',
  'booking.reschedule_declined',
  'user.role_changed',
  'user.facilities_changed',
  'user.deactivated',
  'user.reactivated',
  'terms.draft_created',
  'terms.draft_updated',
  'terms.published',
  'seating_arrangement.created',
  'seating_arrangement.updated',
  'seating_arrangement.archived',
  'seating_arrangement.restored',
  'event_type.created',
  'event_type.updated',
  'event_type.archived',
  'event_type.restored',
  'audit.exported',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  id: string;
  /** A UTC instant. */
  occurredAt: string;
  /** Null for something the system did itself. */
  actor: { id: string; name: string } | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** What a person recognises the entity by: a booking reference, a user's name, a version. */
  entityLabel: string;
  /** One line: what happened. */
  summary: string;
  /** The state before and after, as the backend recorded it. Null where there was no before. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface AuditFilters {
  /** First day, yyyy-MM-dd. */
  from?: string;
  /** Last day, yyyy-MM-dd. */
  to?: string;
  /** Matches the actor's name or id. */
  actor?: string;
  entityType?: AuditEntityType[];
  entityId?: string;
  action?: AuditAction[];
  /** Matches a booking reference, case insensitively, in part. */
  reference?: string;
}

export interface AuditQueryParams extends AuditFilters {
  page?: number;
  pageSize?: number;
}

export type AuditList = Paginated<AuditEntry>;

/** What an `audit.exported` event records as its `after` state. */
export interface AuditExportRecord {
  filters: AuditFilters;
  rowCount: number;
}
