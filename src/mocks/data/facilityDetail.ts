/**
 * Derives the detail record for a venue from its summary. Used for both fixtures, so every venue
 * has complete, internally consistent detail (a kitchen amenity means kitchen resources, and so
 * on). Everything produced here beyond what the summary already carries is PROVISIONAL:
 * invented to demonstrate the screen, and named in `provisionalFields`. Questions for the client
 * are in docs/facilities-data-gaps.md.
 *
 * There are no photographs, so `images` is always empty and the type placeholder is shown.
 */
import type {
  CapacityByArrangement,
  FacilityDetail,
  FacilityResource,
  FacilitySummary,
  OperatingDay,
} from '@/shared/api';

/** The fields this module adds. `images` is excluded: empty means absent, not invented. */
export const DETAIL_PROVISIONAL_FIELDS = [
  'description',
  'capacityByArrangement',
  'resources',
  'operatingSchedule',
  'managedBy',
  'bookingNotes',
  'childFacilities',
  'siblingFacilities',
] as const;

/** Venue resources that are present or absent, never counted. Everything else is a count. */
export const UNCOUNTED_VENUE_RESOURCES = new Set(['stage', 'podium', 'sound-system']);

const ROOM_TYPES = new Set(['committee-room', 'board-room', 'council-chamber']);
const HALL_TYPES = new Set(['hall', 'civic-hall', 'hall-wing']);

/**
 * The fourteen kitchen resources named in BRD section 8.4. The names are confirmed; the quantities
 * are provisional.
 */
export const KITCHEN_ITEMS: Array<{ id: string; name: string; perSeat: boolean; fixed: number }> = [
  { id: 'cups', name: 'Cups', perSeat: true, fixed: 0 },
  { id: 'teaspoons', name: 'Teaspoons', perSeat: true, fixed: 0 },
  { id: 'sugar-bowls', name: 'Sugar bowls', perSeat: false, fixed: 12 },
  { id: 'glasses', name: 'Glasses', perSeat: true, fixed: 0 },
  { id: 'jugs', name: 'Jugs', perSeat: false, fixed: 12 },
  { id: 'milk-jugs', name: 'Milk jugs', perSeat: false, fixed: 12 },
  { id: 'water-jars', name: 'Water jars', perSeat: false, fixed: 8 },
  { id: 'dining-forks', name: 'Dining forks', perSeat: true, fixed: 0 },
  { id: 'urn', name: 'Urn', perSeat: false, fixed: 2 },
  { id: 'side-plates', name: 'Side plates', perSeat: true, fixed: 0 },
  { id: 'dinner-plates', name: 'Dinner plates', perSeat: true, fixed: 0 },
  { id: 'knives', name: 'Knives', perSeat: true, fixed: 0 },
  { id: 'forks', name: 'Forks', perSeat: true, fixed: 0 },
  { id: 'bowls', name: 'Bowls', perSeat: false, fixed: 20 },
];

function arrangements(facility: FacilitySummary): CapacityByArrangement[] | null {
  const { capacity } = facility;
  if (capacity === null) return null;
  if (HALL_TYPES.has(facility.type.id)) {
    return [
      { arrangement: 'Cinema', capacity },
      { arrangement: 'Banquet', capacity: Math.round(capacity * 0.6) },
      { arrangement: 'School room', capacity: Math.round(capacity * 0.5) },
      { arrangement: 'U-shape', capacity: Math.round(capacity * 0.3) },
    ];
  }
  if (facility.type.id === 'committee-room' || facility.type.id === 'board-room') {
    return [
      { arrangement: 'Boardroom', capacity },
      { arrangement: 'U-shape', capacity: Math.round(capacity * 0.8) },
    ];
  }
  // Fixed seating or free space: arrangements do not apply.
  return null;
}

function resources(facility: FacilitySummary): FacilityResource[] {
  const seats = facility.capacity;
  const venue: FacilityResource[] = facility.amenities
    .filter((a) => a.id !== 'kitchen')
    .map((a) => ({
      id: a.id,
      name: a.name,
      category: 'venue' as const,
      quantified: !UNCOUNTED_VENUE_RESOURCES.has(a.id),
      quantity:
        a.id === 'chairs'
          ? seats
          : a.id === 'tables'
            ? seats === null
              ? null
              : Math.ceil(seats / 8)
            : 1,
    }));
  const kitchen: FacilityResource[] = facility.amenities.some((a) => a.id === 'kitchen')
    ? KITCHEN_ITEMS.map((item) => ({
        id: `kitchen-${item.id}`,
        name: item.name,
        category: 'kitchen' as const,
        quantified: true,
        quantity: item.perSeat ? seats : item.fixed,
      }))
    : [];
  return [...venue, ...kitchen];
}

/** Provisional: a venue that only opens at weekends, so that case is exercised. */
const WEEKEND_ONLY = new Set(['sicelo-hall']);

/** The single source of operating hours, shared by the detail record and the availability engine. */
export function scheduleFor(facility: FacilitySummary): OperatingDay[] {
  const office = ROOM_TYPES.has(facility.type.id);
  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    if (WEEKEND_ONLY.has(facility.id)) {
      const weekend = dayOfWeek >= 6;
      return { dayOfWeek, opensAt: weekend ? '08:00' : null, closesAt: weekend ? '22:00' : null };
    }
    if (office) {
      const weekday = dayOfWeek <= 5;
      return {
        dayOfWeek,
        opensAt: weekday ? '08:00' : null,
        closesAt: weekday ? '16:30' : null,
      };
    }
    return { dayOfWeek, opensAt: '07:00', closesAt: '23:00' };
  });
}

function description(facility: FacilitySummary): string {
  const place = facility.locality === 'To be confirmed' ? '' : ` in ${facility.locality}`;
  return [
    `${facility.name} is a ${facility.type.name.toLowerCase()}${place} that can be booked for events and meetings.`,
    'This is sample text. A full description of the venue will be supplied with the facilities register.',
  ].join('\n\n');
}

function bookingNotes(facility: FacilitySummary): string | null {
  if (facility.type.id === 'activity-room') return null;
  if (ROOM_TYPES.has(facility.type.id)) {
    return 'Bookings are subject to approval by the responsible department.';
  }
  return 'Include set-up and clean-up time in your requested booking window. Bookings are subject to approval by the responsible department.';
}

export function deriveDetail(
  facility: FacilitySummary,
  catalogue: readonly FacilitySummary[],
): FacilityDetail {
  const parentId = facility.parentFacility?.id;
  return {
    ...facility,
    description: description(facility),
    images: [],
    capacityByArrangement: arrangements(facility),
    resources: resources(facility),
    operatingSchedule: scheduleFor(facility),
    childFacilities: catalogue
      .filter((f) => f.parentFacility?.id === facility.id)
      .map((f) => ({ id: f.id, name: f.name, type: f.type.name, capacity: f.capacity })),
    siblingFacilities:
      parentId === undefined
        ? []
        : catalogue
            .filter((f) => f.parentFacility?.id === parentId && f.id !== facility.id)
            .map((f) => ({ id: f.id, name: f.name, type: f.type.name })),
    managedBy: ROOM_TYPES.has(facility.type.id) ? 'Corporate Services' : 'Community Services',
    bookingNotes: bookingNotes(facility),
    provisionalFields: [
      ...new Set([...(facility.provisionalFields ?? []), ...DETAIL_PROVISIONAL_FIELDS]),
    ],
  };
}
