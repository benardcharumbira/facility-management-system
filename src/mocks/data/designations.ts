/**
 * Who is designated to approve for which facility. One relationship, stored on the facility and
 * edited from either side, so the two screens cannot disagree. Only facility administrators who
 * are active can be designated.
 */
import type { DateTime } from 'luxon';
import { auditStore } from './auditStore';
import { facilityStore, type StoredFacility } from './facilityStore';
import { userStore } from './userStore';

/** The facilities (not archived) a user is designated against. */
export const designationsOf = (userId: string): StoredFacility[] =>
  facilityStore
    .all()
    .filter((f) => !f.archived && f.approverIds.includes(userId))
    .sort((a, b) => a.name.localeCompare(b.name));

const names = (ids: string[]) =>
  ids.map((id) => facilityStore.get(id)?.name ?? id).sort((a, b) => a.localeCompare(b));

/**
 * Writes a user's designations and records the change against them. Facilities the user was not
 * and is not designated against are left alone.
 */
export function setDesignations(
  userId: string,
  facilityIds: string[],
  actor: string | null,
  at: DateTime,
  reason = 'Designation changed',
) {
  const wanted = new Set(facilityIds);
  const before = designationsOf(userId).map((f) => f.id);
  for (const f of facilityStore.all()) {
    if (f.archived) continue;
    const has = f.approverIds.includes(userId);
    if (has && !wanted.has(f.id)) {
      facilityStore.set({ ...f, approverIds: f.approverIds.filter((id) => id !== userId) });
    } else if (!has && wanted.has(f.id)) {
      facilityStore.set({ ...f, approverIds: [...f.approverIds, userId] });
    }
  }
  recordDesignationChange(
    userId,
    before,
    designationsOf(userId).map((f) => f.id),
    actor,
    at,
    reason,
  );
}

/** An audit entry against the user, if their designations changed. */
export function recordDesignationChange(
  userId: string,
  before: string[],
  after: string[],
  actor: string | null,
  at: DateTime,
  reason = 'Designation changed',
) {
  const same = before.length === after.length && before.every((id) => after.includes(id));
  if (same) return;
  const user = userStore.get(userId);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  const parts = [
    added.length > 0 ? `designated for ${names(added).join(', ')}` : null,
    removed.length > 0 ? `removed from ${names(removed).join(', ')}` : null,
  ].filter(Boolean);
  auditStore.record({
    occurredAt: at.toUTC().toISO({ suppressMilliseconds: true }) ?? '',
    actor,
    action: 'user.facilities_changed',
    entityType: 'user',
    entityId: userId,
    entityLabel: user?.name ?? userId,
    summary: `${user?.name ?? userId}: ${parts.join('; ')}. ${reason}.`,
    before: { facilities: names(before) },
    after: { facilities: names(after) },
  });
}
