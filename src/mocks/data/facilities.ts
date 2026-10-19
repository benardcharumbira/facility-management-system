import type { FacilitySummary, FacilityStatus } from '@/shared/api';

export const FACILITY_TYPES = [
  { id: 'community-hall', name: 'Community hall' },
  { id: 'civic-hall', name: 'Civic hall' },
  { id: 'board-room', name: 'Board room' },
  { id: 'committee-room', name: 'Committee room' },
  { id: 'sports-field', name: 'Sports field' },
  { id: 'court', name: 'Court' },
  { id: 'swimming-pool', name: 'Swimming pool' },
  { id: 'open-space', name: 'Open space' },
] as const;

export const AMENITIES = [
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'stage', name: 'Stage' },
  { id: 'sound-system', name: 'Sound system' },
  { id: 'projector', name: 'Projector' },
  { id: 'parking', name: 'Parking' },
  { id: 'wheelchair-access', name: 'Wheelchair access' },
  { id: 'air-conditioning', name: 'Air conditioning' },
  { id: 'changing-rooms', name: 'Changing rooms' },
  { id: 'floodlights', name: 'Floodlights' },
] as const;

type TypeId = (typeof FACILITY_TYPES)[number]['id'];
type AmenityId = (typeof AMENITIES)[number]['id'];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface Seed {
  code: string;
  name: string;
  type: TypeId;
  locality: string;
  capacity: number | null;
  description: string;
  amenities: AmenityId[];
  parent?: string;
  image?: false;
  status?: FacilityStatus;
}

const SEEDS: Seed[] = [
  // Civic Centre and the spaces inside it.
  {
    code: 'CC-MAIN',
    name: 'Civic Centre',
    type: 'civic-hall',
    locality: 'Central',
    capacity: 420,
    description:
      'The main civic hall with a raised stage and tiered seating, suited to large meetings and ceremonies.',
    amenities: [
      'stage',
      'sound-system',
      'projector',
      'parking',
      'wheelchair-access',
      'air-conditioning',
    ],
  },
  {
    code: 'CC-EAST',
    name: 'Civic Centre East Wing',
    type: 'civic-hall',
    locality: 'Central',
    capacity: 150,
    description: 'Flexible hall with its own entrance, used for functions and training days.',
    amenities: ['kitchen', 'sound-system', 'parking', 'wheelchair-access', 'air-conditioning'],
    parent: 'CC-MAIN',
  },
  {
    code: 'CC-WEST',
    name: 'Civic Centre West Wing',
    type: 'civic-hall',
    locality: 'Central',
    capacity: 150,
    description: 'Mirror of the east wing with a sprung floor for dance and exercise classes.',
    amenities: ['sound-system', 'parking', 'wheelchair-access', 'air-conditioning'],
    parent: 'CC-MAIN',
  },
  {
    code: 'CC-CR1',
    name: 'Civic Centre Committee Room',
    type: 'committee-room',
    locality: 'Central',
    capacity: 20,
    description: 'Formal committee room with a fixed horseshoe table.',
    amenities: ['projector', 'wheelchair-access', 'air-conditioning'],
    parent: 'CC-MAIN',
  },

  // Riverside Sports Complex and its courts.
  {
    code: 'RSC-MAIN',
    name: 'Riverside Sports Complex',
    type: 'sports-field',
    locality: 'Riverside',
    capacity: 800,
    description:
      'Full size turf field with spectator stands, used for league matches and school events.',
    amenities: ['floodlights', 'changing-rooms', 'parking', 'wheelchair-access'],
  },
  {
    code: 'RSC-NC1',
    name: 'Riverside Netball Court 1',
    type: 'court',
    locality: 'Riverside',
    capacity: 60,
    description: 'Outdoor netball court with a rubberised surface.',
    amenities: ['floodlights', 'changing-rooms'],
    parent: 'RSC-MAIN',
  },
  {
    code: 'RSC-NC2',
    name: 'Riverside Netball Court 2',
    type: 'court',
    locality: 'Riverside',
    capacity: 60,
    description: 'Second outdoor netball court, also marked for basketball.',
    amenities: ['floodlights', 'changing-rooms'],
    parent: 'RSC-MAIN',
    status: 'unavailable',
  },

  // Standalone community halls.
  {
    code: 'HC-HALL',
    name: 'Hillcrest Community Hall',
    type: 'community-hall',
    locality: 'Hillcrest',
    capacity: 200,
    description:
      'Well loved hall with a full commercial kitchen, popular for weddings and markets.',
    amenities: ['kitchen', 'stage', 'sound-system', 'parking', 'wheelchair-access'],
  },
  {
    code: 'LS-HALL',
    name: 'Lakeside Community Hall',
    type: 'community-hall',
    locality: 'Lakeside',
    capacity: 120,
    description: 'Bright hall overlooking the water with a covered veranda.',
    amenities: ['kitchen', 'parking', 'wheelchair-access', 'air-conditioning'],
  },
  {
    code: 'NG-HALL',
    name: 'Northgate Community Hall',
    type: 'community-hall',
    locality: 'Northgate',
    capacity: 90,
    description: 'Compact hall for clubs, classes and children’s parties.',
    amenities: ['kitchen', 'parking'],
    image: false,
  },
  {
    code: 'OT-HALL',
    name: 'Old Town Hall',
    type: 'community-hall',
    locality: 'Old Town',
    capacity: 300,
    description: 'Heritage listed hall with a sprung timber floor and a gallery.',
    amenities: ['stage', 'sound-system', 'wheelchair-access'],
    status: 'unavailable',
  },
  {
    code: 'RS-HALL',
    name: 'Riverside Memorial Hall',
    type: 'community-hall',
    locality: 'Riverside',
    capacity: 160,
    description: 'Hall beside the river park, with a small stage and a serving hatch.',
    amenities: ['kitchen', 'stage', 'parking'],
  },

  // Meeting rooms.
  {
    code: 'BR-1',
    name: 'Boardroom One',
    type: 'board-room',
    locality: 'Central',
    capacity: 12,
    description: 'Executive boardroom on the second floor of the municipal offices.',
    amenities: ['projector', 'air-conditioning', 'wheelchair-access'],
  },
  {
    code: 'BR-2',
    name: 'Boardroom Two',
    type: 'board-room',
    locality: 'Central',
    capacity: 6,
    description: 'Small meeting room with a screen and video conferencing.',
    amenities: ['projector', 'air-conditioning'],
    image: false,
  },
  {
    code: 'BR-3',
    name: 'Lakeside Boardroom',
    type: 'board-room',
    locality: 'Lakeside',
    capacity: 16,
    description: 'Boardroom with lake views at the Lakeside depot.',
    amenities: ['projector', 'air-conditioning', 'parking'],
  },
  {
    code: 'CR-HC',
    name: 'Hillcrest Committee Room',
    type: 'committee-room',
    locality: 'Hillcrest',
    capacity: 30,
    description: 'Committee room attached to the Hillcrest library.',
    amenities: ['projector', 'wheelchair-access'],
  },
  {
    code: 'CR-NG',
    name: 'Northgate Committee Room',
    type: 'committee-room',
    locality: 'Northgate',
    capacity: 24,
    description: 'Quiet room used by ward committees and residents’ associations.',
    amenities: ['wheelchair-access', 'parking'],
  },
  {
    code: 'CR-OT',
    name: 'Old Town Council Chamber',
    type: 'committee-room',
    locality: 'Old Town',
    capacity: 45,
    description: 'Historic chamber with tiered seating and a public gallery.',
    amenities: ['sound-system', 'projector', 'wheelchair-access'],
  },

  // Sports.
  {
    code: 'SF-HC',
    name: 'Hillcrest Rugby Field',
    type: 'sports-field',
    locality: 'Hillcrest',
    capacity: 500,
    description: 'Grass rugby field with floodlights and a clubhouse.',
    amenities: ['floodlights', 'changing-rooms', 'parking'],
  },
  {
    code: 'SF-LS',
    name: 'Lakeside Soccer Field',
    type: 'sports-field',
    locality: 'Lakeside',
    capacity: 300,
    description: 'Well drained soccer field next to the lake path.',
    amenities: ['changing-rooms', 'parking'],
  },
  {
    code: 'SF-NG',
    name: 'Northgate Practice Field',
    type: 'sports-field',
    locality: 'Northgate',
    capacity: null,
    description: 'Open practice field with no fixed seating.',
    amenities: ['floodlights'],
    image: false,
  },
  {
    code: 'CT-TEN1',
    name: 'Hillcrest Tennis Court',
    type: 'court',
    locality: 'Hillcrest',
    capacity: 8,
    description: 'Hard court, bookable by the hour.',
    amenities: ['floodlights', 'changing-rooms'],
  },
  {
    code: 'CT-BB',
    name: 'Old Town Basketball Court',
    type: 'court',
    locality: 'Old Town',
    capacity: 40,
    description: 'Covered court with line markings for basketball and volleyball.',
    amenities: ['floodlights', 'wheelchair-access'],
  },
  {
    code: 'CT-SQ',
    name: 'Central Squash Courts',
    type: 'court',
    locality: 'Central',
    capacity: 4,
    description: 'Two glass backed squash courts.',
    amenities: ['changing-rooms', 'air-conditioning'],
    status: 'unavailable',
  },
  {
    code: 'SP-CEN',
    name: 'Central Aquatic Centre',
    type: 'swimming-pool',
    locality: 'Central',
    capacity: 150,
    description: 'Twenty five metre indoor pool with a learner pool.',
    amenities: ['changing-rooms', 'parking', 'wheelchair-access', 'air-conditioning'],
  },
  {
    code: 'SP-LS',
    name: 'Lakeside Outdoor Pool',
    type: 'swimming-pool',
    locality: 'Lakeside',
    capacity: 100,
    description: 'Seasonal outdoor pool with a shaded deck.',
    amenities: ['changing-rooms', 'parking'],
  },

  // Open spaces.
  {
    code: 'OS-RIV',
    name: 'Riverside Park Lawn',
    type: 'open-space',
    locality: 'Riverside',
    capacity: null,
    description: 'Large open lawn for markets, fun runs and picnics.',
    amenities: ['parking', 'wheelchair-access'],
  },
  {
    code: 'OS-OT',
    name: 'Old Town Square',
    type: 'open-space',
    locality: 'Old Town',
    capacity: 1000,
    description: 'Paved public square for festivals and parades.',
    amenities: ['sound-system', 'wheelchair-access'],
    image: false,
  },
  {
    code: 'OS-LS',
    name: 'Lakeside Amphitheatre',
    type: 'open-space',
    locality: 'Lakeside',
    capacity: 350,
    description: 'Grass amphitheatre facing a small stage.',
    amenities: ['stage', 'sound-system', 'parking'],
  },
  {
    code: 'OS-HC',
    name: 'Hillcrest Picnic Area',
    type: 'open-space',
    locality: 'Hillcrest',
    capacity: null,
    description: 'Shaded picnic area with braai stands.',
    amenities: ['parking'],
  },
  {
    code: 'OS-NG',
    name: 'Northgate Community Garden',
    type: 'open-space',
    locality: 'Northgate',
    capacity: 50,
    description: 'Walled garden for small outdoor gatherings.',
    amenities: ['wheelchair-access'],
  },
];

const byCode = new Map(SEEDS.map((seed) => [seed.code, seed]));
const idFor = (code: string) => `fac-${slugify(code)}`;

function toSummary(seed: Seed): FacilitySummary {
  const type = FACILITY_TYPES.find((t) => t.id === seed.type);
  const parent = seed.parent ? byCode.get(seed.parent) : undefined;
  if (!type) throw new Error(`Unknown type ${seed.type}`);
  return {
    id: idFor(seed.code),
    name: seed.name,
    code: seed.code,
    type: { id: type.id, name: type.name },
    parentFacility: parent ? { id: idFor(parent.code), name: parent.name } : null,
    capacity: seed.capacity,
    locality: seed.locality,
    shortDescription: seed.description,
    primaryImageUrl:
      seed.image === false ? null : `https://picsum.photos/seed/${slugify(seed.code)}/640/360`,
    amenities: seed.amenities.map((id) => {
      const amenity = AMENITIES.find((a) => a.id === id);
      if (!amenity) throw new Error(`Unknown amenity ${id}`);
      return { id: amenity.id, name: amenity.name };
    }),
    status: seed.status ?? 'active',
  };
}

export const FACILITY_FIXTURES: FacilitySummary[] = SEEDS.map(toSummary);
