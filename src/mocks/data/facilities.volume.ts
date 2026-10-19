/**
 * VOLUME TEST DATA. Entirely fictional.
 *
 * Generated to exercise pagination, filter combinations and grid behaviour at scale. Nothing here
 * describes a Midvaal venue: every name carries "Volume Test" and every locality is an obviously
 * made up place. Selected with VITE_MOCK_DATASET=volume; off by default.
 */
import type { FacilitySummary } from '@/shared/api';

const TYPES = [
  { id: 'hall', name: 'Hall' },
  { id: 'civic-hall', name: 'Civic hall' },
  { id: 'hall-wing', name: 'Hall wing' },
  { id: 'committee-room', name: 'Committee room' },
  { id: 'board-room', name: 'Board room' },
  { id: 'council-chamber', name: 'Council chamber' },
  { id: 'activity-room', name: 'Activity room' },
] as const;

const LOCALITIES = ['Fictionville', 'Placeholder Park', 'Testdale', 'Exampleton', 'Mockbridge'];

const AMENITIES = [
  { id: 'tables', name: 'Tables' },
  { id: 'chairs', name: 'Chairs' },
  { id: 'stage', name: 'Stage' },
  { id: 'podium', name: 'Podium' },
  { id: 'sound-system', name: 'Sound system' },
  { id: 'kitchen', name: 'Kitchen' },
] as const;

const COUNT = 72;
const GROUP_SIZE = 12;
const ALL_FIELDS = [
  'id',
  'name',
  'code',
  'type',
  'parentFacility',
  'locality',
  'capacity',
  'shortDescription',
  'amenities',
  'status',
  'primaryImageUrl',
];

const pad = (n: number) => String(n).padStart(3, '0');

/**
 * Deterministic, so tests can rely on it. In every group of twelve the first venue is a parent of
 * the next two.
 */
export const VOLUME_FACILITIES: FacilitySummary[] = Array.from({ length: COUNT }, (_, index) => {
  const n = index + 1;
  const type = TYPES[index % TYPES.length] ?? TYPES[0];
  const parentIndex = index - (index % GROUP_SIZE);
  const isChild = index % GROUP_SIZE === 1 || index % GROUP_SIZE === 2;

  return {
    id: `volume-${pad(n)}`,
    name: `Volume Test Venue ${pad(n)}`,
    code: `VOL-${pad(n)}`,
    type: { ...type },
    parentFacility: isChild
      ? { id: `volume-${pad(parentIndex + 1)}`, name: `Volume Test Venue ${pad(parentIndex + 1)}` }
      : null,
    // Some venues have no capacity, as the real register may well.
    capacity: n % 9 === 0 ? null : 8 + ((n * 37) % 480),
    locality: LOCALITIES[index % LOCALITIES.length] ?? 'Fictionville',
    shortDescription: `Fictional test venue ${pad(n)} for volume testing. Not a real venue.`,
    primaryImageUrl: null,
    amenities: AMENITIES.filter((_, i) => (n + i) % 3 !== 0).map((a) => ({ ...a })),
    status: n % 11 === 0 ? 'unavailable' : 'active',
    provisionalFields: [...ALL_FIELDS],
  };
});
