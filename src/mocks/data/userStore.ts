/**
 * The mock's directory of users. Clerk would own the profile fields (name, email, phone, last
 * sign-in); this service owns the role and the status. Seeded with the staff the mock signs in as,
 * a few applicants, and a much larger applicant list generated deterministically, then changed
 * through the admin API. Everyone who owns a booking is in it. Lost on reload, like any mock.
 */
import type { UserStatus } from '@/shared/api';
import { ROLES, type Role } from '@/shared/auth/roles';
import { applicantName, bookingStore, MOCK_USER_ID } from './bookingStore';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastSignInAt: string | null;
}

/** The approver the mock signs in as, unless a token of the form `user:<id>` says otherwise. */
export const MOCK_APPROVER_ID = 'mock-approver-1';
export const MOCK_SYSADMIN_ID = 'mock-sysadmin';

const staff = (
  id: string,
  name: string,
  role: Role,
  lastSignInAt: string | null,
  phone: string | null = null,
  createdAt = '2025-08-04T07:30:00Z',
): StoredUser => ({
  id,
  name,
  email: `${name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/ /g, '.')}@example.org`,
  phone,
  role,
  status: 'active',
  createdAt,
  lastSignInAt,
});

/**
 * Municipal staff, PROVISIONAL and invented. Anyone not listed here is an applicant. The server
 * decides what a caller may do from this, never from the client.
 */
const SEED_STAFF = (): StoredUser[] => [
  staff(
    MOCK_APPROVER_ID,
    'Nomsa Dlamini',
    ROLES.facilityAdmin,
    '2026-11-02T06:12:00Z',
    '+27 16 360 7001',
  ),
  staff(
    'approver-vaal',
    'Pieter van Wyk',
    ROLES.facilityAdmin,
    '2026-11-01T14:40:00Z',
    '+27 16 360 7002',
  ),
  staff('approver-empty', 'Lerato Sithole', ROLES.facilityAdmin, '2026-10-29T09:05:00Z'),
  staff('approver-partial', 'Kagiso Mahlangu', ROLES.facilityAdmin, '2026-10-30T11:20:00Z'),
  // A facility administrator who has been designated against nothing yet.
  staff('approver-idle', 'Busisiwe Zulu', ROLES.facilityAdmin, null, null, '2026-10-12T08:00:00Z'),
  staff('staff-internal-1', 'Thandi Molefe', ROLES.internal, '2026-10-28T08:15:00Z'),
  staff(
    MOCK_SYSADMIN_ID,
    'Sipho Nkosi',
    ROLES.systemAdmin,
    '2026-11-02T07:45:00Z',
    '+27 16 360 7000',
  ),
  staff(
    'sysadmin-two',
    'Zodwa Khumalo',
    ROLES.systemAdmin,
    '2026-10-26T10:30:00Z',
    '+27 16 360 7003',
  ),
];

const FIRST = [
  'Thabo',
  'Lindiwe',
  'Sizwe',
  'Naledi',
  'Johan',
  'Anele',
  'Priya',
  'Mpho',
  'Elmarie',
  'Bongani',
  'Refilwe',
  'Dumisani',
  'Chantelle',
  'Tshepo',
  'Zanele',
  'Ruan',
  'Palesa',
  'Siyabonga',
  'Annelie',
  'Kabelo',
  'Nomvula',
  'Pieter',
  'Ayanda',
  'Charlene',
  'Themba',
  'Lebo',
  'Wian',
  'Ntombi',
  'Fatima',
  'Mandla',
];
const LAST = [
  'Mokoena',
  'Botha',
  'Naidoo',
  'Khoza',
  'van der Merwe',
  'Ndlovu',
  'Pretorius',
  'Mabaso',
  'Jacobs',
  'Sibiya',
  'Venter',
  'Maseko',
  'Smit',
  'Radebe',
  'Coetzee',
  'Tau',
  'du Plessis',
  'Ngcobo',
  'Steyn',
  'Motaung',
  'Pillay',
  'Mthembu',
  'Kruger',
  'Dube',
];
const APPLICANT_COUNT = 240;

function seedApplicants(): StoredUser[] {
  const users: StoredUser[] = [
    {
      id: MOCK_USER_ID,
      name: 'Mock User',
      email: 'mock.user@example.org',
      phone: '+27 82 555 0100',
      role: ROLES.applicant,
      status: 'active',
      createdAt: '2026-01-15T09:00:00Z',
      lastSignInAt: '2026-11-02T07:50:00Z',
    },
  ];
  const seen = new Set(users.map((u) => u.email));
  for (let i = 0; i < APPLICANT_COUNT; i += 1) {
    const first = FIRST[(i * 7) % FIRST.length] ?? 'Sam';
    const last = LAST[(i * 11 + Math.floor(i / FIRST.length)) % LAST.length] ?? 'Smith';
    let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.org';
    if (seen.has(email)) email = email.replace('@', `${i}@`);
    seen.add(email);
    const day = 1 + (i % 28);
    users.push({
      id: `applicant-${String(i + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email,
      phone: i % 3 === 0 ? `+27 8${i % 10} 555 ${String(1000 + i).slice(-4)}` : null,
      role: i % 40 === 5 ? ROLES.internal : ROLES.applicant,
      // A few accounts the service has switched off.
      status: i % 53 === 52 ? 'deactivated' : 'active',
      createdAt: `2026-0${1 + (i % 9)}-${String(day).padStart(2, '0')}T08:00:00Z`,
      lastSignInAt:
        i % 17 === 16
          ? null
          : new Date(Date.UTC(2026, 9, 31, 7) - i * 7 * 3_600_000)
              .toISOString()
              .replace('.000Z', 'Z'),
    });
  }
  return users;
}

const users = new Map<string, StoredUser>();

function seed() {
  users.clear();
  for (const user of [...SEED_STAFF(), ...seedApplicants()]) users.set(user.id, user);
}
seed();

/** Everyone who owns a booking is a user, even if the seed data did not list them. */
function syncOwners() {
  for (const { ownerId } of bookingStore.all()) {
    if (users.has(ownerId)) continue;
    const name = applicantName(ownerId);
    users.set(ownerId, {
      id: ownerId,
      name,
      email: `${name
        .toLowerCase()
        .replace(/[^a-z ]/g, '')
        .replace(/ /g, '.')}@example.org`,
      phone: null,
      role: ROLES.applicant,
      status: 'active',
      createdAt: '2026-02-01T08:00:00Z',
      lastSignInAt: '2026-10-20T08:00:00Z',
    });
  }
}

export const userStore = {
  all(): StoredUser[] {
    syncOwners();
    return [...users.values()];
  },
  get(id: string): StoredUser | undefined {
    syncOwners();
    return users.get(id);
  },
  set: (user: StoredUser) => users.set(user.id, user),
  activeSystemAdmins: () =>
    [...users.values()].filter((u) => u.role === ROLES.systemAdmin && u.status === 'active'),
  facilityAdmins: () =>
    [...users.values()].filter((u) => u.role === ROLES.facilityAdmin && u.status === 'active'),
  reset: seed,
};

export function resetUserStore() {
  userStore.reset();
}
