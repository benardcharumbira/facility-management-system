/**
 * Sample requests for the approval queue, so every behaviour of the screen can be seen. All
 * PROVISIONAL and invented, including the applicants. Dates are relative to "now".
 *
 * Seen by the default mock approver (City Hall and its three spaces, Rothdene Hall, Lakeside Hall):
 * - 9101, 9102, 9103: City Hall, Mitchell Wing and Loch Wing for the same Saturday. City Hall
 *   competes with both wings; the wings do not compete with each other (they are separate rooms).
 *   9101 has also waited longer than the turnaround target.
 * - 9104, 9105: two requests for Rothdene Hall at the same time.
 * - 9106: a hold that lapses within a day, with more people and chairs than the hall holds.
 * - 9107: a committee room request from someone who has booked it before.
 * - 9108, 9109: requests to move an approved booking.
 * - 9110: cannot be approved, because 9111 is already approved at an overlapping time.
 * - 9115: another approver decides it first, so the first attempt on it comes back as taken.
 * - 9116: a plain, unremarkable request.
 * - 9112 and 9113: Vaal Marina and the Activity Room, outside the default approver's scope.
 * - 9114, 9117: already decided, to review.
 */
import { DateTime } from 'luxon';
import type { BookingHistoryEntry } from '@/shared/api';
import { FACILITY_TIME_ZONE } from './bookingLedger';
import { TERMS_VERSION } from './bookingOptions';
import { bookingStore, registerApplicant, type StoredBooking } from './bookingStore';

const FACILITIES: Record<string, string> = {
  'city-hall': 'City Hall',
  'mitchell-wing': 'Mitchell Wing',
  'loch-wing': 'Loch Wing',
  'city-hall-committee-room': 'City Hall Committee Room',
  'rothdene-hall': 'Rothdene Hall',
  'lakeside-hall': 'Lakeside Hall',
  'vaal-marina-hall': 'Vaal Marina Hall',
  'activity-room': 'Activity Room',
};

const APPLICANTS: Record<string, string> = {
  'applicant-thandi': 'Thandi Nkosi',
  'applicant-johan': 'Johan Pretorius',
  'applicant-aisha': 'Aisha Patel',
  'applicant-sipho': 'Sipho Dlamini',
  'applicant-maria': 'Maria van der Merwe',
  'applicant-bongani': 'Bongani Khumalo',
  'applicant-lerato': 'Lerato Mokoena',
  'applicant-ruth': 'Ruth Naidoo',
  'applicant-pieter': 'Pieter Botha',
};

interface Spec {
  n: number;
  owner: keyof typeof APPLICANTS;
  facilityId: keyof typeof FACILITIES;
  days: number;
  from: string;
  to: string;
  eventTypeId: string;
  description: string;
  attendeeCount: number;
  seatingArrangementId: string;
  resources?: Array<[string, number]>;
  documents?: string[];
  submittedHoursAgo: number;
  /** Hours from now until the hold lapses. Pending requests only. */
  holdHoursAhead?: number;
  decided?: { hoursAgo: number; outcome: 'approved' | 'rejected'; by: string; reason?: string };
  /** Asks to move to this many days from today, same times. */
  reschedule?: { days: number; requestedHoursAgo: number };
  /** Another approver decides this first. */
  contested?: boolean;
}

const SPECS: Spec[] = [
  {
    n: 9101,
    owner: 'applicant-thandi',
    facilityId: 'city-hall',
    days: 12,
    from: '08:00',
    to: '17:00',
    eventTypeId: 'wedding',
    description:
      'Wedding reception for about 300 guests, with a sit-down lunch and a band. We would like to set up from the early morning.',
    attendeeCount: 300,
    seatingArrangementId: 'banquet',
    resources: [
      ['chairs', 300],
      ['tables', 38],
      ['stage', 1],
      ['kitchen-cups', 300],
    ],
    documents: ['catering-plan.pdf', 'floor-layout.png'],
    submittedHoursAgo: 24 * 6 + 3,
    holdHoursAhead: 40,
  },
  {
    n: 9102,
    owner: 'applicant-johan',
    facilityId: 'mitchell-wing',
    days: 12,
    from: '10:00',
    to: '15:00',
    eventTypeId: 'fundraiser',
    description: 'Church fundraiser lunch for the building fund.',
    attendeeCount: 90,
    seatingArrangementId: 'banquet',
    resources: [
      ['chairs', 90],
      ['tables', 12],
    ],
    submittedHoursAgo: 24 * 3 + 5,
    holdHoursAhead: 70,
  },
  {
    n: 9103,
    owner: 'applicant-aisha',
    facilityId: 'loch-wing',
    days: 12,
    from: '12:00',
    to: '16:00',
    eventTypeId: 'family-function',
    description: 'A birthday celebration for my mother, with family travelling in.',
    attendeeCount: 60,
    seatingArrangementId: 'banquet',
    resources: [['chairs', 60]],
    submittedHoursAgo: 24 + 6,
    holdHoursAhead: 55,
  },
  {
    n: 9104,
    owner: 'applicant-sipho',
    facilityId: 'rothdene-hall',
    days: 20,
    from: '09:00',
    to: '13:00',
    eventTypeId: 'workshop',
    description: 'Youth skills workshop run with the local college.',
    attendeeCount: 70,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 70]],
    documents: ['programme.pdf'],
    submittedHoursAgo: 24 * 2 + 1,
    holdHoursAhead: 46,
  },
  {
    n: 9105,
    owner: 'applicant-maria',
    facilityId: 'rothdene-hall',
    days: 20,
    from: '10:00',
    to: '14:00',
    eventTypeId: 'meeting',
    description: 'Ratepayers association annual general meeting.',
    attendeeCount: 110,
    seatingArrangementId: 'cinema',
    resources: [['chairs', 110]],
    submittedHoursAgo: 30,
    holdHoursAhead: 42,
  },
  {
    n: 9106,
    owner: 'applicant-bongani',
    facilityId: 'lakeside-hall',
    days: 9,
    from: '09:00',
    to: '17:00',
    eventTypeId: 'conference',
    description:
      'Regional sports federation conference. Expecting delegates from six clubs, plus visitors.',
    attendeeCount: 400,
    seatingArrangementId: 'cinema',
    resources: [
      ['chairs', 400],
      ['tables', 20],
    ],
    submittedHoursAgo: 24 * 2 + 4,
    holdHoursAhead: 20,
  },
  {
    n: 9107,
    owner: 'applicant-lerato',
    facilityId: 'city-hall-committee-room',
    days: 7,
    from: '14:00',
    to: '16:00',
    eventTypeId: 'meeting',
    description: 'Quarterly ward committee planning meeting.',
    attendeeCount: 12,
    seatingArrangementId: 'boardroom',
    resources: [['chairs', 12]],
    submittedHoursAgo: 18,
    holdHoursAhead: 54,
  },
  {
    n: 9108,
    owner: 'applicant-ruth',
    facilityId: 'lakeside-hall',
    days: 30,
    from: '09:00',
    to: '13:00',
    eventTypeId: 'workshop',
    description: 'Seniors wellness morning.',
    attendeeCount: 50,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 50]],
    submittedHoursAgo: 24 * 10,
    decided: { hoursAgo: 24 * 8, outcome: 'approved', by: 'Nomsa Dlamini' },
    reschedule: { days: 37, requestedHoursAgo: 20 },
  },
  {
    n: 9109,
    owner: 'applicant-sipho',
    facilityId: 'rothdene-hall',
    days: 45,
    from: '13:00',
    to: '17:00',
    eventTypeId: 'family-function',
    description: 'Engagement party.',
    attendeeCount: 120,
    seatingArrangementId: 'banquet',
    resources: [['chairs', 120]],
    submittedHoursAgo: 24 * 12,
    decided: { hoursAgo: 24 * 10, outcome: 'approved', by: 'Nomsa Dlamini' },
    reschedule: { days: 59, requestedHoursAgo: 24 * 4 },
  },
  {
    n: 9110,
    owner: 'applicant-aisha',
    facilityId: 'loch-wing',
    days: 25,
    from: '10:00',
    to: '14:00',
    eventTypeId: 'meeting',
    description: 'Neighbourhood watch information evening.',
    attendeeCount: 80,
    seatingArrangementId: 'cinema',
    resources: [['chairs', 80]],
    submittedHoursAgo: 24 * 4,
    holdHoursAhead: 24,
  },
  {
    n: 9111,
    owner: 'applicant-pieter',
    facilityId: 'city-hall',
    days: 25,
    from: '09:00',
    to: '15:00',
    eventTypeId: 'conference',
    description: 'Provincial business forum.',
    attendeeCount: 200,
    seatingArrangementId: 'cinema',
    resources: [['chairs', 200]],
    submittedHoursAgo: 24 * 9,
    decided: { hoursAgo: 24 * 3, outcome: 'approved', by: 'Nomsa Dlamini' },
  },
  {
    n: 9112,
    owner: 'applicant-thandi',
    facilityId: 'vaal-marina-hall',
    days: 15,
    from: '18:00',
    to: '22:00',
    eventTypeId: 'family-function',
    description: 'Anniversary dinner.',
    attendeeCount: 150,
    seatingArrangementId: 'banquet',
    resources: [['chairs', 150]],
    submittedHoursAgo: 24 * 2,
    holdHoursAhead: 24,
  },
  {
    n: 9113,
    owner: 'applicant-ruth',
    facilityId: 'activity-room',
    days: 6,
    from: '09:00',
    to: '11:00',
    eventTypeId: 'meeting',
    description: 'Craft club.',
    attendeeCount: 20,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 20]],
    submittedHoursAgo: 24 * 7,
    holdHoursAhead: 5,
  },
  {
    n: 9114,
    owner: 'applicant-johan',
    facilityId: 'rothdene-hall',
    days: 40,
    from: '18:00',
    to: '23:00',
    eventTypeId: 'family-function',
    description: 'Late night disco for a 21st birthday.',
    attendeeCount: 150,
    seatingArrangementId: 'banquet',
    submittedHoursAgo: 24 * 5,
    decided: {
      hoursAgo: 24 * 2,
      outcome: 'rejected',
      by: 'Nomsa Dlamini',
      reason:
        'We cannot approve events that run past 22:00 at Rothdene Hall because of the residents next door. If you can finish by 22:00, please submit a new request for the same date.',
    },
  },
  {
    n: 9115,
    owner: 'applicant-maria',
    facilityId: 'lakeside-hall',
    days: 16,
    from: '10:00',
    to: '14:00',
    eventTypeId: 'meeting',
    description: 'School governing body workshop.',
    attendeeCount: 70,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 70]],
    submittedHoursAgo: 8,
    holdHoursAhead: 64,
    contested: true,
  },
  {
    n: 9116,
    owner: 'applicant-lerato',
    facilityId: 'rothdene-hall',
    days: 33,
    from: '09:00',
    to: '12:00',
    eventTypeId: 'workshop',
    description: 'Computer basics class for pensioners.',
    attendeeCount: 25,
    seatingArrangementId: 'school-room',
    resources: [['chairs', 25]],
    submittedHoursAgo: 24 * 2 + 14,
    holdHoursAhead: 30,
  },
  {
    // Booked here before, so the committee room request shows a previous booking.
    n: 9117,
    owner: 'applicant-lerato',
    facilityId: 'city-hall-committee-room',
    days: -30,
    from: '14:00',
    to: '16:00',
    eventTypeId: 'meeting',
    description: 'Ward committee planning meeting.',
    attendeeCount: 10,
    seatingArrangementId: 'boardroom',
    submittedHoursAgo: 24 * 60,
    decided: { hoursAgo: 24 * 58, outcome: 'approved', by: 'Kagiso Mahlangu' },
  },
];

export function seedApprovals(now: DateTime = DateTime.now()) {
  for (const [id, name] of Object.entries(APPLICANTS)) registerApplicant(id, name);

  const today = now.setZone(FACILITY_TIME_ZONE).startOf('day');
  const ago = (hours: number) =>
    now.minus({ hours }).toUTC().toISO({ suppressMilliseconds: true }) ?? '';
  const ahead = (hours: number) =>
    now.plus({ hours }).toUTC().toISO({ suppressMilliseconds: true }) ?? '';
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

  for (const spec of SPECS) {
    const id = `appr-${spec.n}`;
    const history: BookingHistoryEntry[] = [
      {
        id: 'h-1',
        type: 'created',
        at: ago(spec.submittedHoursAgo + 1),
        actor: 'applicant',
        note: null,
      },
      {
        id: 'h-2',
        type: 'submitted',
        at: ago(spec.submittedHoursAgo),
        actor: 'applicant',
        note: null,
      },
    ];
    if (spec.decided) {
      history.push({
        id: 'h-3',
        type: spec.decided.outcome === 'rejected' ? 'rejected' : 'approved',
        at: ago(spec.decided.hoursAgo),
        actor: 'municipality',
        note: spec.decided.reason ?? null,
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

    const booking: StoredBooking = {
      id,
      reference: `MVL-${now.year}-${spec.n}`,
      status: spec.decided?.outcome ?? 'pending',
      facilityId: spec.facilityId,
      startsAt: at(spec.days, spec.from),
      endsAt: at(spec.days, spec.to),
      eventTypeId: spec.eventTypeId,
      description: spec.description,
      attendeeCount: spec.attendeeCount,
      seatingArrangementId: spec.seatingArrangementId,
      resources: (spec.resources ?? []).map(([resourceId, quantity]) => ({ resourceId, quantity })),
      acceptedTermsVersion: TERMS_VERSION,
      facility: {
        id: spec.facilityId,
        name: FACILITIES[spec.facilityId] ?? '',
        timeZone: FACILITY_TIME_ZONE,
      },
      documents: (spec.documents ?? []).map((name, index) => ({
        id: `doc-${index + 1}-${name}`,
        name,
        sizeBytes: 150_000 + index * 70_000,
        contentType: name.endsWith('.png') ? 'image/png' : 'application/pdf',
        uploadedAt: ago(spec.submittedHoursAgo + 1),
      })),
      updatedAt: ago(spec.decided?.hoursAgo ?? spec.submittedHoursAgo),
      submittedAt: ago(spec.submittedHoursAgo),
      holdExpiresAt:
        spec.holdHoursAhead === undefined || spec.decided ? null : ahead(spec.holdHoursAhead),
      decidedAt: spec.decided ? ago(spec.decided.hoursAgo) : null,
      rejectionReason: spec.decided?.reason ?? null,
      cancellation: null,
      history,
      rescheduleRequest: spec.reschedule
        ? {
            id: `rs-${id}`,
            proposedStartsAt: at(spec.reschedule.days, spec.from),
            proposedEndsAt: at(spec.reschedule.days, spec.to),
            requestedAt: ago(spec.reschedule.requestedHoursAgo),
            status: 'pending',
          }
        : null,
    };
    bookingStore.set(booking, spec.owner);

    if (spec.decided) {
      bookingStore.recordDecision({
        workItemId: id,
        type: 'booking_request',
        bookingId: id,
        outcome: spec.decided.outcome,
        decidedBy: spec.decided.by,
        decidedAt: ago(spec.decided.hoursAgo),
        internalNote: null,
        reason: spec.decided.reason ?? null,
      });
    }
    if (spec.contested) bookingStore.contest(id);
  }
}

export const APPROVAL_SEED_REFERENCES = SPECS.map((s) => s.n);
