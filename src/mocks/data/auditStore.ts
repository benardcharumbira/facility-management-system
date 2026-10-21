/**
 * The mock's audit trail. The backend records booking creation, status changes and approval
 * actions, and administrative changes, with the actor, the time and the state before and after;
 * the audit screen only reads it. Entries are never edited or removed.
 */
import { DateTime } from 'luxon';
import type { AuditAction, AuditEntry, AuditFilters } from '@/shared/api';
import { FACILITY_TIME_ZONE } from './bookingLedger';
import type { StoredBooking } from './bookingStore';
import { userStore } from './userStore';

interface Stored extends AuditEntry {
  seq: number;
}

let entries: Stored[] = [];
let seq = 0;

export type NewAuditEntry = Omit<AuditEntry, 'id' | 'actor'> & { actor: string | null };

export const actorOf = (userId: string | null): AuditEntry['actor'] => {
  if (!userId) return null;
  return { id: userId, name: userStore.get(userId)?.name ?? userId };
};

/** The booking as the audit trail remembers it: enough to see what changed, not the whole record. */
export const bookingState = (b: StoredBooking): Record<string, unknown> => ({
  status: b.status,
  facility: b.facility.name,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
});

const instant = (value: DateTime) => value.toUTC().toISO({ suppressMilliseconds: true }) ?? '';

export const auditStore = {
  record(entry: NewAuditEntry): AuditEntry {
    seq += 1;
    const stored: Stored = { ...entry, actor: actorOf(entry.actor), id: `au-${seq}`, seq };
    entries.push(stored);
    return publicEntry(stored);
  },

  /** A booking event, with the booking's reference as the label a person searches for. */
  recordBooking(
    action: AuditAction,
    booking: StoredBooking,
    actor: string | null,
    at: DateTime,
    before: StoredBooking | null,
    summary: string,
    extra: Record<string, unknown> = {},
  ) {
    return this.record({
      occurredAt: instant(at),
      actor,
      action,
      entityType: 'booking',
      entityId: booking.id,
      entityLabel: booking.reference,
      summary,
      before: before ? bookingState(before) : null,
      after: { ...bookingState(booking), ...extra },
    });
  },

  /** Newest first. */
  query(filters: AuditFilters): AuditEntry[] {
    const from = filters.from
      ? DateTime.fromISO(filters.from, { zone: FACILITY_TIME_ZONE }).startOf('day').toMillis()
      : -Infinity;
    const to = filters.to
      ? DateTime.fromISO(filters.to, { zone: FACILITY_TIME_ZONE }).endOf('day').toMillis()
      : Infinity;
    const actor = filters.actor?.trim().toLowerCase();
    const reference = filters.reference?.trim().toLowerCase();
    const entityId = filters.entityId?.trim();
    return entries
      .filter((e) => {
        const at = DateTime.fromISO(e.occurredAt, { zone: 'utc' }).toMillis();
        if (at < from || at > to) return false;
        if (actor && !`${e.actor?.name ?? ''} ${e.actor?.id ?? ''}`.toLowerCase().includes(actor)) {
          return false;
        }
        if (filters.entityType?.length && !filters.entityType.includes(e.entityType)) return false;
        if (filters.action?.length && !filters.action.includes(e.action)) return false;
        if (entityId && e.entityId !== entityId) return false;
        if (
          reference &&
          !(e.entityType === 'booking' && e.entityLabel.toLowerCase().includes(reference))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.seq - a.seq)
      .map(publicEntry);
  },

  count: () => entries.length,
  reset() {
    entries = [];
    seq = 0;
  },
};

function publicEntry(stored: Stored): AuditEntry {
  const entry: AuditEntry & { seq?: number } = { ...stored };
  delete entry.seq;
  return entry;
}

export function resetAuditStore() {
  auditStore.reset();
}
