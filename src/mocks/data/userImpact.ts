/**
 * What a change to a user, or to a seating arrangement, would reach. The server side behaviour the
 * real impact endpoints must reproduce. It decides nothing, cancels nothing and tells nobody.
 *
 * A change to a user strands work when it removes the last designated approver of a facility: the
 * facility is then a hole, and the pending requests for it have nobody to decide them. Both are
 * named. Considered: facilities that are not archived, and pending bookings that have not ended.
 */
import type { DateTime } from 'luxon';
import type { ProposedUserChange, ReferenceImpactResult, UserImpactResult } from '@/shared/api';
import { ROLES } from '@/shared/auth/roles';
import { designationsOf } from './designations';
import { facilityStore } from './facilityStore';
import { toImpacted } from './facilityImpact';
import { referenceStore } from './referenceStore';
import type { StoredUser } from './userStore';

/** The facilities a change would take the user off, given what they are designated against now. */
export function designationsRemovedBy(user: StoredUser, change: ProposedUserChange): string[] {
  const current = designationsOf(user.id).map((f) => f.id);
  switch (change.kind) {
    case 'role':
      return change.role === ROLES.facilityAdmin ? [] : current;
    case 'deactivate':
      return current;
    case 'facilities':
      return current.filter((id) => !change.facilityIds.includes(id));
  }
}

export function userImpact(
  user: StoredUser,
  change: ProposedUserChange,
  now: DateTime,
): UserImpactResult {
  const removed = designationsRemovedBy(user, change)
    .map((id) => facilityStore.get(id))
    .filter((f) => f !== undefined);
  const left = removed.filter((f) => f.approverIds.every((id) => id === user.id));
  const leftIds = new Set(left.map((f) => f.id));
  const affectedBookings = facilityStore
    .liveBookings(now)
    .filter(({ booking }) => booking.status === 'pending' && leftIds.has(booking.facilityId))
    .map((live) => toImpacted(live, 'no_approver'))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.reference.localeCompare(b.reference));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  return {
    affectedBookings,
    totalAffected: affectedBookings.length,
    unroutedPendingRequests: affectedBookings.length,
    facilitiesLeftWithoutApprover: left.map(({ id, name }) => ({ id, name })).sort(byName),
    designationsRemoved: removed.map(({ id, name }) => ({ id, name })).sort(byName),
  };
}

/** Facilities holding a capacity figure for the arrangement, and the live bookings that chose it. */
export function seatingImpact(arrangementId: string, now: DateTime): ReferenceImpactResult {
  const name = referenceStore.nameOf('seating_arrangement', arrangementId)?.toLowerCase();
  const facilitiesAffected = facilityStore
    .all()
    .filter((f) => !f.archived)
    .flatMap((f) => {
      const figure = f.capacity.byArrangement.find((c) => c.arrangement.toLowerCase() === name);
      return figure ? [{ id: f.id, name: f.name, capacity: figure.capacity }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const affectedBookings = facilityStore
    .liveBookings(now)
    .filter(({ booking }) => booking.seatingArrangementId === arrangementId)
    .map((live) => toImpacted(live, 'arrangement_archived'))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.reference.localeCompare(b.reference));
  return { affectedBookings, totalAffected: affectedBookings.length, facilitiesAffected };
}
