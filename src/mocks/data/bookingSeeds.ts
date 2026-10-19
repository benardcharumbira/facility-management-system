/**
 * Sample bookings for the mock applicant, so My bookings has something in every state. All
 * PROVISIONAL and invented. Dates are relative to "now". `seedBookings` is called by the browser
 * worker; tests call it where they need it, because each test starts with an empty store.
 */
import { DateTime } from 'luxon';
import type { BookingHistoryEntry, BookingStatus } from '@/shared/api';
import { FACILITY_TIME_ZONE } from './bookingLedger';
import { MOCK_USER_ID, bookingStore, type StoredBooking } from './bookingStore';
import { TERMS_VERSION } from './bookingOptions';

const FACILITIES: Record<string, string> = {
  'rothdene-hall': 'Rothdene Hall',
  'lakeside-hall': 'Lakeside Hall',
  'vaal-marina-hall': 'Vaal Marina Hall',
  'activity-room': 'Activity Room',
  'city-hall': 'City Hall',
};

interface Spec {
  id: string;
  status: BookingStatus;
  facilityId: keyof typeof FACILITIES;
  /** Whole days from today (negative is the past), and the local times. */
  days: number;
  from: string;
  to: string;
  eventTypeId?: string;
  description?: string;
  attendeeCount?: number;
  seatingArrangementId?: string;
  resources?: Array<[string, number]>;
  documents?: string[];
  /** Hours before "now" that each stage happened. */
  createdHoursAgo: number;
  submittedHoursAgo?: number;
  decidedHoursAgo?: number;
  holdDaysAhead?: number;
  rejectionReason?: string;
  cancelledHoursAgo?: number;
  cancelReason?: string;
  reschedule?: { days: number; requestedHoursAgo: number };
  updatedHoursAgo?: number;
  ownerId?: string;
}

const SPECS: Spec[] = [
  {
    id: 'seed-draft',
    status: 'draft',
    facilityId: 'rothdene-hall',
    days: 21,
    from: '09:00',
    to: '13:00',
    eventTypeId: 'family-function',
    description: 'A family celebration (draft, details still to come)',
    createdHoursAgo: 24 * 7,
    updatedHoursAgo: 24 * 7,
  },
  {
    id: 'seed-pending',
    status: 'pending',
    facilityId: 'lakeside-hall',
    days: 14,
    from: '10:00',
    to: '14:00',
    eventTypeId: 'meeting',
    description: 'Ward committee quarterly meeting',
    attendeeCount: 60,
    seatingArrangementId: 'u-shape',
    resources: [
      ['chairs', 60],
      ['tables', 8],
    ],
    documents: ['agenda.pdf'],
    createdHoursAgo: 24 * 3 + 2,
    submittedHoursAgo: 24 * 3,
    holdDaysAhead: 7,
  },
  {
    id: 'seed-approved',
    status: 'approved',
    facilityId: 'rothdene-hall',
    days: 28,
    from: '08:00',
    to: '12:00',
    eventTypeId: 'workshop',
    description: 'Community skills workshop',
    attendeeCount: 80,
    seatingArrangementId: 'school-room',
    resources: [
      ['chairs', 80],
      ['tables', 10],
      ['stage', 1],
      ['kitchen-urn', 1],
      ['kitchen-cups', 80],
    ],
    documents: ['programme.pdf', 'permit.png'],
    createdHoursAgo: 24 * 12,
    submittedHoursAgo: 24 * 12 - 1,
    decidedHoursAgo: 24 * 9,
    reschedule: { days: 35, requestedHoursAgo: 24 },
  },
  {
    id: 'seed-approved-soon',
    status: 'approved',
    facilityId: 'activity-room',
    days: 2,
    from: '09:00',
    to: '11:00',
    eventTypeId: 'meeting',
    description: 'Youth club planning session',
    attendeeCount: 25,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 25]],
    createdHoursAgo: 24 * 20,
    submittedHoursAgo: 24 * 20 - 1,
    decidedHoursAgo: 24 * 18,
  },
  {
    id: 'seed-rejected',
    status: 'rejected',
    facilityId: 'vaal-marina-hall',
    days: 10,
    from: '18:00',
    to: '22:00',
    eventTypeId: 'wedding',
    description: 'Wedding reception',
    attendeeCount: 280,
    seatingArrangementId: 'banquet',
    resources: [['chairs', 280]],
    createdHoursAgo: 24 * 8,
    submittedHoursAgo: 24 * 8 - 1,
    decidedHoursAgo: 24 * 5,
    rejectionReason:
      'The hall is reserved for a municipal event on this date and cannot be released. We are unable to offer an alternative evening that week because the hall is closed for floor maintenance from Monday to Thursday. If your date is flexible, please submit a new request for any evening from the following Friday onwards and we will review it as quickly as we can.',
  },
  {
    id: 'seed-cancelled',
    status: 'cancelled',
    facilityId: 'lakeside-hall',
    days: 35,
    from: '09:00',
    to: '12:00',
    eventTypeId: 'fundraiser',
    description: 'School fundraiser breakfast',
    attendeeCount: 90,
    seatingArrangementId: 'banquet',
    createdHoursAgo: 24 * 15,
    submittedHoursAgo: 24 * 15 - 1,
    decidedHoursAgo: 24 * 13,
    cancelledHoursAgo: 24 * 4,
    cancelReason: 'The event has been postponed to next year.',
  },
  {
    id: 'seed-past',
    status: 'approved',
    facilityId: 'rothdene-hall',
    days: -21,
    from: '09:00',
    to: '13:00',
    eventTypeId: 'memorial',
    description: 'Memorial service',
    attendeeCount: 120,
    seatingArrangementId: 'cinema',
    resources: [['chairs', 120]],
    createdHoursAgo: 24 * 40,
    submittedHoursAgo: 24 * 40 - 1,
    decidedHoursAgo: 24 * 37,
  },
  {
    id: 'seed-other',
    status: 'approved',
    facilityId: 'city-hall',
    days: 12,
    from: '09:00',
    to: '12:00',
    eventTypeId: 'conference',
    description: "Another applicant's conference",
    attendeeCount: 200,
    seatingArrangementId: 'cinema',
    createdHoursAgo: 24 * 10,
    submittedHoursAgo: 24 * 10 - 1,
    decidedHoursAgo: 24 * 8,
    ownerId: 'someone-else',
  },
];

export const SEED_IDS = SPECS.map((s) => s.id);

export function seedBookings(now: DateTime = DateTime.now()) {
  const today = now.setZone(FACILITY_TIME_ZONE).startOf('day');
  const ago = (hours: number) =>
    now.minus({ hours }).toUTC().toISO({ suppressMilliseconds: true }) ?? '';
  const at = (days: number, time: string) => {
    const [h = 0, m = 0] = time.split(':').map(Number);
    return (
      today
        .plus({ days })
        .set({ hour: h, minute: m })
        .toUTC()
        .toISO({ suppressMilliseconds: true }) ?? ''
    );
  };

  SPECS.forEach((spec, index) => {
    const history: BookingHistoryEntry[] = [
      { id: 'h-1', type: 'created', at: ago(spec.createdHoursAgo), actor: 'applicant', note: null },
    ];
    if (spec.submittedHoursAgo !== undefined) {
      history.push({
        id: 'h-2',
        type: 'submitted',
        at: ago(spec.submittedHoursAgo),
        actor: 'applicant',
        note: null,
      });
    }
    if (spec.decidedHoursAgo !== undefined) {
      history.push({
        id: 'h-3',
        type: spec.status === 'rejected' ? 'rejected' : 'approved',
        at: ago(spec.decidedHoursAgo),
        actor: 'municipality',
        note: spec.rejectionReason ?? null,
      });
    }
    if (spec.reschedule) {
      history.push({
        id: 'h-4',
        type: 'reschedule_requested',
        at: ago(spec.reschedule.requestedHoursAgo),
        actor: 'applicant',
        note: null,
      });
    }
    if (spec.cancelledHoursAgo !== undefined) {
      history.push({
        id: 'h-5',
        type: 'cancelled',
        at: ago(spec.cancelledHoursAgo),
        actor: 'applicant',
        note: spec.cancelReason ?? null,
      });
    }

    const booking: StoredBooking = {
      id: spec.id,
      reference: `MVL-${now.year}-${String(9000 + index)}`,
      status: spec.status,
      facilityId: spec.facilityId,
      startsAt: at(spec.days, spec.from),
      endsAt: at(spec.days, spec.to),
      eventTypeId: spec.eventTypeId ?? null,
      description: spec.description ?? '',
      attendeeCount: spec.attendeeCount ?? null,
      seatingArrangementId: spec.seatingArrangementId ?? null,
      resources: (spec.resources ?? []).map(([resourceId, quantity]) => ({ resourceId, quantity })),
      acceptedTermsVersion: spec.status === 'draft' ? null : TERMS_VERSION,
      facility: {
        id: spec.facilityId,
        name: FACILITIES[spec.facilityId] ?? '',
        timeZone: FACILITY_TIME_ZONE,
      },
      documents: (spec.documents ?? []).map((name, n) => ({
        id: `doc-${n + 1}-${name}`,
        name,
        sizeBytes: 120_000 + n * 40_000,
        contentType: name.endsWith('.png') ? 'image/png' : 'application/pdf',
        uploadedAt: ago(spec.createdHoursAgo - 1),
      })),
      updatedAt: ago(
        spec.updatedHoursAgo ??
          spec.cancelledHoursAgo ??
          spec.decidedHoursAgo ??
          spec.submittedHoursAgo ??
          spec.createdHoursAgo,
      ),
      submittedAt: spec.submittedHoursAgo === undefined ? null : ago(spec.submittedHoursAgo),
      holdExpiresAt:
        spec.holdDaysAhead === undefined
          ? null
          : (now.plus({ days: spec.holdDaysAhead }).toUTC().toISO({ suppressMilliseconds: true }) ??
            null),
      decidedAt: spec.decidedHoursAgo === undefined ? null : ago(spec.decidedHoursAgo),
      rejectionReason: spec.rejectionReason ?? null,
      cancellation:
        spec.cancelledHoursAgo === undefined
          ? null
          : {
              cancelledAt: ago(spec.cancelledHoursAgo),
              cancelledBy: 'applicant',
              reason: spec.cancelReason ?? null,
            },
      history,
      rescheduleRequest: spec.reschedule
        ? {
            id: 'rs-seed',
            proposedStartsAt: at(spec.reschedule.days, spec.from),
            proposedEndsAt: at(spec.reschedule.days, spec.to),
            requestedAt: ago(spec.reschedule.requestedHoursAgo),
            status: 'pending',
          }
        : null,
    };
    bookingStore.set(booking, spec.ownerId ?? MOCK_USER_ID);
  });
}
