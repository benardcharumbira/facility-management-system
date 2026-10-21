/**
 * Bookings that give each retroactive change in facility administration something to find. All
 * PROVISIONAL and invented. Dates are relative to "now". Approved bookings unless said otherwise.
 *
 * - 9201, 9202, 9203: Rothdene Hall across one weekend, so a blackout on those days reaches three.
 * - 9210: the Activity Room, overlapping 9201 in time. Moving the Activity Room into Rothdene Hall
 *   makes the two share a building and clash.
 * - 9204, 9205: Lakeside Hall, back to back with twenty minutes between. A thirty minute set-up
 *   buffer makes them clash.
 * - 9206: Vaal Marina Hall until 22:45. Closing at 22:00 leaves it outside the hours.
 *   9207 there ends at midday and is untouched by any such change.
 * - 9208: the Vaal Marina Board Room, so archiving it has a booking to list.
 * - 9209: Rothdene Hall banquet for 140. Cutting banquet seating to 120 puts it over.
 *
 * Also: a blackout on City Hall that is in effect now (and so on its three spaces), for the list.
 * The Activity Room, Bantu Bonke Hall and the Council Chambers have no approver, from the fixture.
 */
import { DateTime } from 'luxon';
import type { BookingHistoryEntry } from '@/shared/api';
import { FACILITY_TIME_ZONE } from './bookingLedger';
import { TERMS_VERSION } from './bookingOptions';
import { bookingStore, registerApplicant, type StoredBooking } from './bookingStore';
import { facilityStore } from './facilityStore';

const FACILITIES: Record<string, string> = {
  'rothdene-hall': 'Rothdene Hall',
  'activity-room': 'Activity Room',
  'lakeside-hall': 'Lakeside Hall',
  'vaal-marina-hall': 'Vaal Marina Hall',
  'vaal-marina-board-room': 'Vaal Marina Board Room',
};

const APPLICANTS: Record<string, string> = {
  'applicant-grace': 'Grace Mthembu',
  'applicant-dawie': 'Dawie Steyn',
  'applicant-priya': 'Priya Naidoo',
  'applicant-tebogo': 'Tebogo Molefe',
};

interface Spec {
  n: number;
  owner: keyof typeof APPLICANTS;
  facilityId: keyof typeof FACILITIES;
  days: number;
  from: string;
  to: string;
  attendees: number;
  seating: string;
  description: string;
  /** Hours before now that it was submitted: later submissions are the ones a clash names. */
  submittedHoursAgo: number;
}

const SPECS: Spec[] = [
  {
    n: 9201,
    owner: 'applicant-grace',
    facilityId: 'rothdene-hall',
    days: 40,
    from: '09:00',
    to: '13:00',
    attendees: 90,
    seating: 'school-room',
    description: 'Community market, Saturday morning',
    submittedHoursAgo: 24 * 14,
  },
  {
    n: 9202,
    owner: 'applicant-dawie',
    facilityId: 'rothdene-hall',
    days: 40,
    from: '14:00',
    to: '18:00',
    attendees: 100,
    seating: 'banquet',
    description: 'Wedding reception',
    submittedHoursAgo: 24 * 13,
  },
  {
    n: 9203,
    owner: 'applicant-priya',
    facilityId: 'rothdene-hall',
    days: 41,
    from: '10:00',
    to: '14:00',
    attendees: 60,
    seating: 'cinema',
    description: 'Church service and lunch',
    submittedHoursAgo: 24 * 12,
  },
  {
    n: 9210,
    owner: 'applicant-tebogo',
    facilityId: 'activity-room',
    days: 40,
    from: '10:00',
    to: '12:00',
    attendees: 20,
    seating: 'school-room',
    description: 'Pottery class',
    submittedHoursAgo: 24 * 6,
  },
  {
    n: 9204,
    owner: 'applicant-grace',
    facilityId: 'lakeside-hall',
    days: 45,
    from: '09:00',
    to: '12:00',
    attendees: 70,
    seating: 'school-room',
    description: 'Training workshop',
    submittedHoursAgo: 24 * 10,
  },
  {
    n: 9205,
    owner: 'applicant-dawie',
    facilityId: 'lakeside-hall',
    days: 45,
    from: '12:20',
    to: '15:00',
    attendees: 70,
    seating: 'school-room',
    description: 'Afternoon seminar',
    submittedHoursAgo: 24 * 8,
  },
  {
    n: 9206,
    owner: 'applicant-priya',
    facilityId: 'vaal-marina-hall',
    days: 30,
    from: '21:30',
    to: '22:45',
    attendees: 120,
    seating: 'banquet',
    description: 'Evening dinner and speeches',
    submittedHoursAgo: 24 * 9,
  },
  {
    n: 9207,
    owner: 'applicant-tebogo',
    facilityId: 'vaal-marina-hall',
    days: 30,
    from: '10:00',
    to: '12:00',
    attendees: 40,
    seating: 'school-room',
    description: 'Morning meeting',
    submittedHoursAgo: 24 * 7,
  },
  {
    n: 9208,
    owner: 'applicant-grace',
    facilityId: 'vaal-marina-board-room',
    days: 33,
    from: '14:00',
    to: '16:00',
    attendees: 10,
    seating: 'boardroom',
    description: 'Marina committee meeting',
    submittedHoursAgo: 24 * 5,
  },
  {
    n: 9209,
    owner: 'applicant-dawie',
    facilityId: 'rothdene-hall',
    days: 50,
    from: '12:00',
    to: '17:00',
    attendees: 140,
    seating: 'banquet',
    description: 'Anniversary lunch',
    submittedHoursAgo: 24 * 4,
  },
];

export function seedFacilityAdmin(now: DateTime = DateTime.now()) {
  for (const [id, name] of Object.entries(APPLICANTS)) registerApplicant(id, name);

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

  for (const spec of SPECS) {
    const id = `adm-${spec.n}`;
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
      {
        id: 'h-3',
        type: 'approved',
        at: ago(spec.submittedHoursAgo - 24),
        actor: 'municipality',
        note: null,
      },
    ];
    const booking: StoredBooking = {
      id,
      reference: `MVL-${now.year}-${spec.n}`,
      status: 'approved',
      facilityId: spec.facilityId,
      startsAt: at(spec.days, spec.from),
      endsAt: at(spec.days, spec.to),
      eventTypeId: 'meeting',
      description: spec.description,
      attendeeCount: spec.attendees,
      seatingArrangementId: spec.seating,
      resources: [],
      acceptedTermsVersion: TERMS_VERSION,
      facility: {
        id: spec.facilityId,
        name: FACILITIES[spec.facilityId] ?? '',
        timeZone: FACILITY_TIME_ZONE,
      },
      documents: [],
      updatedAt: ago(spec.submittedHoursAgo - 24),
      submittedAt: ago(spec.submittedHoursAgo),
      holdExpiresAt: null,
      decidedAt: ago(spec.submittedHoursAgo - 24),
      rejectionReason: null,
      cancellation: null,
      history,
      rescheduleRequest: null,
    };
    bookingStore.set(booking, spec.owner);
  }

  // City Hall is closed for repairs from yesterday until the day after tomorrow, and so are its spaces.
  const cityHall = facilityStore.get('city-hall');
  if (cityHall) {
    facilityStore.set({
      ...cityHall,
      blackouts: [
        ...cityHall.blackouts,
        {
          id: facilityStore.nextId('bo'),
          startsAt: at(-1, '00:00'),
          endsAt: at(3, '00:00'),
          allDay: true,
          reason: 'Closed while the roof is repaired',
        },
      ],
    });
  }
}
