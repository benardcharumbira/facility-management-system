/**
 * Contract for the signed in user's own profile. Clerk owns identity (name, email address,
 * verification, credentials); this service owns only what Clerk does not hold.
 *
 * ```
 * GET   /api/me/profile
 * PATCH /api/me/profile
 * ```
 *
 * **A contact telephone number** is the one application owned field: the municipality uses it when
 * it needs to phone about a booking. It is not in the client's field list, so it is an addition to
 * confirm. It is separate from any phone number held by Clerk, and optional. Validation failures
 * are 422 problem documents with field level `errors`.
 */
export interface MyProfile {
  telephone: string | null;
  /** A UTC instant, or null if it has never been set. */
  updatedAt: string | null;
}

export interface UpdateMyProfileRequest {
  telephone: string | null;
}
