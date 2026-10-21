/**
 * Sample history for the audit trail: the lifecycle of every booking in the mock, a fully traced
 * booking to search for, a long run of older bookings so the result set pages, and a few
 * administrative changes. PROVISIONAL and invented.
 */
import type { DateTime } from 'luxon';
import type { AuditAction } from '@/shared/api';
import { auditStore, bookingState } from './auditStore';
import { bookingStore } from './bookingStore';
import { facilityStore } from './facilityStore';
import { MOCK_SYSADMIN_ID, userStore } from './userStore';

const iso = (value: DateTime) => value.toUTC().toISO({ suppressMilliseconds: true }) ?? '';

const ACTION_OF: Record<string, AuditAction> = {
  created: 'booking.created',
  submitted: 'booking.submitted',
  approved: 'booking.approved',
  rejected: 'booking.rejected',
  cancelled: 'booking.cancelled',
  reschedule_requested: 'booking.reschedule_requested',
  reschedule_approved: 'booking.reschedule_approved',
  reschedule_declined: 'booking.reschedule_declined',
};
const STATUS_AFTER: Record<string, string | null> = {
  created: 'draft',
  submitted: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
  reschedule_requested: null,
  reschedule_approved: null,
  reschedule_declined: null,
};
const SUMMARY: Record<string, string> = {
  created: 'started a booking request',
  submitted: 'submitted the request',
  approved: 'approved the request',
  rejected: 'rejected the request',
  cancelled: 'cancelled the booking',
  reschedule_requested: 'asked to move the booking',
  reschedule_approved: 'approved moving the booking',
  reschedule_declined: 'declined moving the booking',
};

const APPROVERS = ['approver-vaal', 'mock-approver-1', 'approver-partial', 'approver-empty'];

export function seedAudit(now: DateTime) {
  // The lifecycle of the bookings that exist.
  for (const { booking, ownerId } of bookingStore.all()) {
    let status: string | null = null;
    for (const event of booking.history) {
      const after: string | null = STATUS_AFTER[event.type] ?? status;
      const byStaff = event.actor === 'municipality';
      const decider = byStaff
        ? (userStore.all().find((u) => u.name === bookingStore.decisionFor(booking.id)?.decidedBy)
            ?.id ?? null)
        : ownerId;
      auditStore.record({
        occurredAt: event.at,
        actor: decider,
        action: ACTION_OF[event.type] ?? 'booking.created',
        entityType: 'booking',
        entityId: booking.id,
        entityLabel: booking.reference,
        summary: `${decider ? (userStore.get(decider)?.name ?? decider) : 'The municipality'} ${SUMMARY[event.type] ?? event.type}.`,
        before: status ? { status } : null,
        after: { ...bookingState(booking), status: after },
      });
      status = after;
    }
  }

  const facilities = facilityStore.publicCatalogue();
  const venueAt = (i: number) =>
    facilities[i % Math.max(1, facilities.length)]?.name ?? 'City Hall';

  // A booking with a long, fully traced history, the sort of thing someone asks about.
  const tracedOwner = 'applicant-001';
  const trace = (
    reference: string,
    id: string,
    owner: string,
    venue: string,
    start: DateTime,
    steps: Array<[string, string | null, number, string?]>,
  ) => {
    let status: string | null = null;
    for (const [type, actor, hoursAfter, note] of steps) {
      const after: string | null = STATUS_AFTER[type] ?? status;
      const who = actor ?? owner;
      auditStore.record({
        occurredAt: iso(start.plus({ hours: hoursAfter })),
        actor: who,
        action: ACTION_OF[type] ?? 'booking.created',
        entityType: 'booking',
        entityId: id,
        entityLabel: reference,
        summary: `${userStore.get(who)?.name ?? who} ${SUMMARY[type]}${note ? `: ${note}` : '.'}`,
        before: status ? { status } : null,
        after: { status: after, facility: venue },
      });
      status = after;
    }
  };

  const base = now.minus({ days: 74 });
  trace('MVL-2026-00417', 'bk-h-417', tracedOwner, 'Rothdene Hall', base, [
    ['created', null, 0],
    ['submitted', null, 2],
    ['approved', 'mock-approver-1', 26],
    ['reschedule_requested', null, 24 * 20],
    ['reschedule_approved', 'mock-approver-1', 24 * 21],
  ]);

  // Older bookings, so the result set runs to many pages.
  for (let i = 0; i < 180; i += 1) {
    const number = 100 + i;
    if (number === 417) continue;
    const owner = `applicant-${String(((i * 7) % 240) + 1).padStart(3, '0')}`;
    const start = now.minus({ days: 110 - Math.floor(i * 0.55), hours: (i * 5) % 11 });
    const venue = venueAt(i);
    const approver = APPROVERS[i % APPROVERS.length] ?? 'mock-approver-1';
    const outcome = i % 7 === 3 ? 'rejected' : 'approved';
    const steps: Array<[string, string | null, number, string?]> = [
      ['created', null, 0],
      ['submitted', null, 1],
      [
        outcome,
        approver,
        20 + (i % 30),
        outcome === 'rejected' ? 'the date was already taken' : undefined,
      ],
    ];
    if (outcome === 'approved' && i % 9 === 4) steps.push(['cancelled', null, 24 * 6]);
    trace(
      `MVL-2026-${String(number).padStart(5, '0')}`,
      `bk-h-${number}`,
      owner,
      venue,
      start,
      steps,
    );
  }

  // Administrative changes.
  const admin = MOCK_SYSADMIN_ID;
  const grant = (userId: string, from: string, to: string, daysAgo: number) =>
    auditStore.record({
      occurredAt: iso(now.minus({ days: daysAgo })),
      actor: admin,
      action: 'user.role_changed',
      entityType: 'user',
      entityId: userId,
      entityLabel: userStore.get(userId)?.name ?? userId,
      summary: `${userStore.get(userId)?.name ?? userId}'s role changed from ${from} to ${to}.`,
      before: { role: from },
      after: { role: to },
    });
  grant('approver-idle', 'applicant', 'facility_admin', 20);
  grant('approver-partial', 'internal', 'facility_admin', 45);
  grant('sysadmin-two', 'facility_admin', 'system_admin', 62);
  auditStore.record({
    occurredAt: iso(now.minus({ days: 273 })),
    actor: admin,
    action: 'terms.published',
    entityType: 'terms',
    entityId: 'terms-2026-1',
    entityLabel: '2026-1',
    summary: 'Published version 2026-1 of the terms, superseding 2025-1.',
    before: { currentVersion: '2025-1' },
    after: { currentVersion: '2026-1' },
  });
}
