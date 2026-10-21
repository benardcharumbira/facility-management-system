/**
 * What a change to the resource catalogue or to a facility's allocations would touch among the
 * bookings that already exist. The server side behaviour the real impact endpoints must
 * reproduce. It decides nothing; it only names what the change reaches.
 *
 * Considered: approved and pending bookings that have not yet ended. A finding is one booking and
 * one resource, so a booking short of two resources appears twice and counts once.
 */
import type { DateTime } from 'luxon';
import type {
  AllocationChange,
  AllocationValue,
  ImpactedBooking,
  ImpactReason,
  ResourceImpactResult,
  ResourceProposedChange,
} from '@/shared/api';
import { applicantName, type StoredBooking } from './bookingStore';
import { facilityStore } from './facilityStore';
import { resourceStore, type StoredResource } from './resourceStore';

interface Live {
  booking: StoredBooking;
  ownerId: string;
}

function finding(
  live: Live,
  reason: ImpactReason,
  resource: StoredResource,
  requested: number,
  available: number | null,
): ImpactedBooking {
  const { booking } = live;
  return {
    bookingId: booking.id,
    reference: booking.reference,
    applicantName: applicantName(live.ownerId),
    facility: {
      id: booking.facility.id,
      name: booking.facility.name,
      timeZone: booking.facility.timeZone,
    },
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    status: booking.status,
    reason,
    conflictsWith: null,
    resource: { id: resource.id, name: resource.name, requested, available },
  };
}

const requestedOf = (live: Live, resourceId: string): number =>
  live.booking.resources.find((r) => r.resourceId === resourceId)?.quantity ?? 0;

function summarise(
  found: ImpactedBooking[],
  allocationsAffected = 0,
  facilitiesAffected = 0,
): ResourceImpactResult {
  const sorted = [...found].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      a.reference.localeCompare(b.reference) ||
      (a.resource?.name ?? '').localeCompare(b.resource?.name ?? ''),
  );
  return {
    affectedBookings: sorted,
    totalAffected: new Set(sorted.map((f) => f.bookingId)).size,
    allocationsAffected,
    facilitiesAffected,
  };
}

const asCount = (value: AllocationValue) => (typeof value === 'number' ? value : value ? 1 : 0);

/** A batch of pending edits to allocations: one check over the whole batch. */
export function batchImpact(changes: AllocationChange[], now: DateTime): ResourceImpactResult {
  // The last change to a cell wins, as it will when the batch is applied.
  const cells = new Map<string, AllocationChange>();
  for (const change of changes) cells.set(`${change.facilityId}|${change.resourceId}`, change);

  const live = facilityStore.liveBookings(now);
  const found: ImpactedBooking[] = [];
  for (const change of cells.values()) {
    const resource = resourceStore.get(change.resourceId);
    if (!resource || resource.archived) continue;
    const before = resourceStore.valueOf(change.facilityId, resource.id);
    for (const l of live.filter((x) => x.booking.facilityId === change.facilityId)) {
      const asked = requestedOf(l, resource.id);
      if (asked === 0) continue;
      if (resource.quantified) {
        const after = asCount(change.value);
        // Newly short: it could be met before, and cannot be now.
        if (asked > after && !(asked > asCount(before))) {
          found.push(finding(l, 'resource_shortfall', resource, asked, after));
        }
      } else if (!change.value && before) {
        found.push(finding(l, 'resource_withdrawn', resource, asked, null));
      }
    }
  }
  return summarise(found);
}

/** A change to a catalogue entry: the bookings it reaches, and the allocations it overwrites. */
export function catalogueImpact(
  resourceId: string,
  change: ResourceProposedChange,
  now: DateTime,
): ResourceImpactResult {
  const resource = resourceStore.get(resourceId);
  if (!resource) return summarise([]);
  const live = facilityStore.liveBookings(now);
  const asking = live.filter((l) => requestedOf(l, resourceId) > 0);
  const holders = resourceStore.holders(resourceId);

  switch (change.kind) {
    case 'details':
      return summarise([]);

    case 'archive':
      return summarise(
        asking.map((l) =>
          finding(l, 'resource_archived', resource, requestedOf(l, resourceId), null),
        ),
        0,
        holders.length,
      );

    case 'quantified': {
      if (change.quantified === resource.quantified) return summarise([]);
      if (!change.quantified) {
        // The numbers are discarded; a facility that held any is left available.
        return summarise([], holders.length, holders.length);
      }
      // Every facility is left at zero, so what was asked for is no longer held.
      const held = new Set(holders.map((h) => h.facilityId));
      const found = asking
        .filter((l) => held.has(l.booking.facilityId))
        .map((l) => finding(l, 'resource_shortfall', resource, requestedOf(l, resourceId), 0));
      return summarise(found, holders.length, holders.length);
    }
  }
}
