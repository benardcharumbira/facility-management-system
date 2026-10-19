/**
 * THE MIDVAAL VENUES
 *
 * Confirmed data: the twelve venue NAMES below, taken from the client's Business Requirements
 * Document v2.0, section 7 ("drawn from the current internal venue application form"), on
 * 2026-10-19. They are reproduced exactly, spelling included. Nothing else about these venues
 * has been supplied.
 *
 * Everything else on every record is PROVISIONAL: invented or inferred so the browse screen can
 * demonstrate properly. Each record lists those fields in `provisionalFields`, and the
 * development banner warns while any are displayed. Do not read a capacity, locality, amenity,
 * description, code, type or parent here as fact. The questions to put to the client are in
 * docs/facilities-data-gaps.md.
 *
 * Basis for the inferences:
 * - Parent/child: "Mitchell Wing" and "Loch Wing" are named as wings and the committee room's
 *   name states City Hall, so containment is implied. Vaal Marina Board Room shares a site name
 *   with Vaal Marina Hall. Council Chambers and Activity Room are treated as standalone.
 * - Locality: several venue names carry one. Midvaal is in the Sedibeng district of Gauteng with
 *   Meyerton as its seat, so City Hall, its spaces and Council Chambers are placed there. Bantu
 *   Bonke Hall and Activity Room have no locality evidence and read "To be confirmed".
 *   Locality names only: no street addresses or coordinates.
 * - Type: derived from the venue names.
 * - Amenities: from the resources in BRD section 8.4 (tables, chairs, stage, podium, sound
 *   system, kitchen), assigned plausibly by venue type. The itemised kitchen inventory is a
 *   booking form concern and is collapsed to one "kitchen" amenity.
 * - Capacity: plausible figures scaled to the venue type.
 * - Images: none. There are no photographs, so the type based placeholder is shown.
 *   Never add a borrowed photograph of these public buildings.
 */
import type { FacilitySummary } from '@/shared/api';
import { slugify } from './slug';

export const LOCALITY_TO_BE_CONFIRMED = 'To be confirmed';

/** The only fields that are not provisional. `primaryImageUrl` is simply absent, not invented. */
export const CONFIRMED_FIELDS = ['name', 'primaryImageUrl'] as const;

/** Every other field on a record. Kept in step with FacilitySummary by a test. */
export const PROVISIONAL_FIELDS = [
  'id',
  'code',
  'type',
  'parentFacility',
  'locality',
  'capacity',
  'shortDescription',
  'amenities',
  'status',
] as const;

const TYPES = {
  civicHall: { id: 'civic-hall', name: 'Civic hall' },
  hall: { id: 'hall', name: 'Hall' },
  hallWing: { id: 'hall-wing', name: 'Hall wing' },
  committeeRoom: { id: 'committee-room', name: 'Committee room' },
  boardRoom: { id: 'board-room', name: 'Board room' },
  councilChamber: { id: 'council-chamber', name: 'Council chamber' },
  activityRoom: { id: 'activity-room', name: 'Activity room' },
} as const;

const AMENITIES = {
  tables: { id: 'tables', name: 'Tables' },
  chairs: { id: 'chairs', name: 'Chairs' },
  stage: { id: 'stage', name: 'Stage' },
  podium: { id: 'podium', name: 'Podium' },
  soundSystem: { id: 'sound-system', name: 'Sound system' },
  kitchen: { id: 'kitchen', name: 'Kitchen' },
} as const;

type TypeKey = keyof typeof TYPES;
type AmenityKey = keyof typeof AMENITIES;

interface Seed {
  /** Confirmed. */
  name: string;
  type: TypeKey;
  /** Name of the (inferred) parent venue. */
  parent?: string;
  locality: string;
  capacity: number | null;
  amenities: AmenityKey[];
}

const SEEDS: Seed[] = [
  {
    name: 'City Hall',
    type: 'civicHall',
    locality: 'Meyerton',
    capacity: 500,
    amenities: ['tables', 'chairs', 'stage', 'podium', 'soundSystem', 'kitchen'],
  },
  {
    name: 'Mitchell Wing',
    type: 'hallWing',
    parent: 'City Hall',
    locality: 'Meyerton',
    capacity: 150,
    amenities: ['tables', 'chairs', 'stage', 'soundSystem', 'kitchen'],
  },
  {
    name: 'City Hall Committee Room',
    type: 'committeeRoom',
    parent: 'City Hall',
    locality: 'Meyerton',
    capacity: 20,
    amenities: ['tables', 'chairs'],
  },
  {
    name: 'Loch Wing',
    type: 'hallWing',
    parent: 'City Hall',
    locality: 'Meyerton',
    capacity: 150,
    amenities: ['tables', 'chairs', 'podium', 'soundSystem', 'kitchen'],
  },
  {
    name: 'Council Chambers',
    type: 'councilChamber',
    locality: 'Meyerton',
    capacity: 60,
    amenities: ['chairs', 'podium', 'soundSystem'],
  },
  {
    name: 'Rothdene Hall',
    type: 'hall',
    locality: 'Rothdene',
    capacity: 250,
    amenities: ['tables', 'chairs', 'stage', 'kitchen'],
  },
  {
    name: 'Vaal Marina Hall',
    type: 'hall',
    locality: 'Vaal Marina',
    capacity: 300,
    amenities: ['tables', 'chairs', 'stage', 'soundSystem', 'kitchen'],
  },
  {
    name: 'Vaal Marina Board Room',
    type: 'boardRoom',
    parent: 'Vaal Marina Hall',
    locality: 'Vaal Marina',
    capacity: 14,
    amenities: ['tables', 'chairs'],
  },
  {
    name: 'Activity Room',
    type: 'activityRoom',
    locality: LOCALITY_TO_BE_CONFIRMED,
    capacity: 40,
    amenities: ['tables', 'chairs'],
  },
  {
    name: 'Bantu Bonke Hall',
    type: 'hall',
    locality: LOCALITY_TO_BE_CONFIRMED,
    capacity: 350,
    amenities: ['tables', 'chairs', 'stage', 'podium', 'soundSystem', 'kitchen'],
  },
  {
    name: 'Sicelo Hall',
    type: 'hall',
    locality: 'Sicelo',
    capacity: 200,
    amenities: ['tables', 'chairs', 'stage', 'kitchen'],
  },
  {
    name: 'Lakeside Hall',
    type: 'hall',
    locality: 'Lakeside',
    capacity: 180,
    amenities: ['tables', 'chairs', 'stage', 'soundSystem', 'kitchen'],
  },
];

const idFor = (name: string) => slugify(name);

function toFacility(seed: Seed): FacilitySummary {
  const type = TYPES[seed.type];
  return {
    id: idFor(seed.name),
    name: seed.name,
    code: idFor(seed.name).toUpperCase(),
    type: { ...type },
    parentFacility: seed.parent ? { id: idFor(seed.parent), name: seed.parent } : null,
    capacity: seed.capacity,
    locality: seed.locality,
    shortDescription: `${type.name} available for hire. Description pending the facilities register.`,
    primaryImageUrl: null,
    amenities: seed.amenities.map((key) => ({ ...AMENITIES[key] })),
    status: 'active',
    provisionalFields: [...PROVISIONAL_FIELDS],
  };
}

export const REAL_FACILITIES: FacilitySummary[] = SEEDS.map(toFacility);
