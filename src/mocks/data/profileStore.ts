/**
 * The application owned part of a user's profile: a contact telephone number. Clerk owns the rest.
 * Seeded for one applicant so both the filled in and the empty state exist. Lost on reload.
 */
export interface StoredProfile {
  telephone: string | null;
  updatedAt: string | null;
}

const seed = (): Map<string, StoredProfile> =>
  new Map([['applicant-priya', { telephone: '082 555 0142', updatedAt: '2026-09-14T08:00:00Z' }]]);

let profiles = seed();

export const profileStore = {
  get: (userId: string): StoredProfile =>
    profiles.get(userId) ?? { telephone: null, updatedAt: null },
  set: (userId: string, profile: StoredProfile) => profiles.set(userId, profile),
  reset: () => {
    profiles = seed();
  },
};

export function resetProfileStore() {
  profileStore.reset();
}
