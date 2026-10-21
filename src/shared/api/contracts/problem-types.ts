/**
 * The catalogue of problem `type` URIs. A client that handles an error specifically keys on one of
 * these. The three that carry extension members (slot conflict, already decided, action not
 * allowed) predate the catalogue and keep their URIs. See api/BEHAVIOUR.md for what each means.
 */
const ROOT = 'https://midvaal.example/problems';

export const PROBLEM_TYPES = {
  /** 422. Field level `errors`, which the client maps back onto form fields. */
  validation: `${ROOT}/validation-failed`,
  /** 409. A submission whose window is no longer free. Carries the conflicting window. */
  slotConflict: `${ROOT}/slot-conflict`,
  /** 409. Someone else decided the work item first. Carries the decision. */
  alreadyDecided: `${ROOT}/already-decided`,
  /** 409. A cancellation or reschedule the rules do not allow, or an action blocked by a guard rail. */
  actionNotAllowed: `${ROOT}/action-not-allowed`,
  /** 409. An allocation batch was refused or rolled back; nothing in it was saved. */
  batchNotSaved: `${ROOT}/batch-not-saved`,
  /** 400. A malformed or unsupported query parameter. */
  invalidQuery: `${ROOT}/invalid-query`,
  /** 401. No valid session. */
  unauthenticated: `${ROOT}/unauthenticated`,
  /** 403. The caller's role does not allow this. */
  forbidden: `${ROOT}/forbidden`,
  /** 404. No such record, or one the caller may not know exists. */
  notFound: `${ROOT}/not-found`,
  /** 409. A state conflict that is not one of the above: an archived record, a published version. */
  conflict: `${ROOT}/conflict`,
  /** 5xx. */
  internal: `${ROOT}/internal-error`,
} as const;

export type ProblemType = (typeof PROBLEM_TYPES)[keyof typeof PROBLEM_TYPES];

/** The type a problem has when nothing more specific applies to it, by status. */
export function problemTypeFor(status: number): ProblemType {
  switch (status) {
    case 400:
      return PROBLEM_TYPES.invalidQuery;
    case 401:
      return PROBLEM_TYPES.unauthenticated;
    case 403:
      return PROBLEM_TYPES.forbidden;
    case 404:
      return PROBLEM_TYPES.notFound;
    case 409:
      return PROBLEM_TYPES.conflict;
    case 422:
      return PROBLEM_TYPES.validation;
    default:
      return PROBLEM_TYPES.internal;
  }
}
