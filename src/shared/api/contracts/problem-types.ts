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

export interface ProblemCatalogueEntry {
  type: ProblemType;
  title: string;
  status: number;
  /** When the server sends it. */
  when: string;
  /** Extension members, beyond the RFC 7807 ones, that the client reads. */
  members: string;
  /** What the client does with it. */
  client: string;
}

/**
 * Every problem the client handles specifically. This is the error catalogue published in
 * `api/ERRORS.md`, so a backend that sends a different `type` or status for one of these is
 * behaviourally wrong even if its shape matches.
 */
export const PROBLEM_CATALOGUE: ProblemCatalogueEntry[] = [
  {
    type: PROBLEM_TYPES.slotConflict,
    title: 'That time is no longer available',
    status: 409,
    when: 'A booking is submitted, or a move requested, for a window that is no longer free on any day it covers. Includes a day taken by a related facility.',
    members:
      '`conflictingWindow` (the part no longer free), `relatedFacility` (when the block comes from a parent or child), `reason` (in words).',
    client:
      'Keeps every answer on the form, explains which time and why, names the related facility, and offers the calendar with the draft carried back.',
  },
  {
    type: PROBLEM_TYPES.alreadyDecided,
    title: 'Already decided',
    status: 409,
    when: 'An approver decides a work item that someone else has already decided.',
    members: '`decision` (`outcome`, `decidedBy`, `decidedAt`).',
    client:
      'Says who decided it, what they decided and when, and refreshes the item. Keeps the text the approver wrote.',
  },
  {
    type: PROBLEM_TYPES.actionNotAllowed,
    title: 'That is not allowed',
    status: 409,
    when: 'A cancellation or move the rules do not allow; approving a request an approved booking already stands in the way of; removing a role or deactivating an account a guard rail protects.',
    members:
      '`code` for the guard rails: `own_system_administrator_role`, `last_system_administrator`, `self`. The `detail` is the reason, in words.',
    client:
      'Shows the reason. For the guard rails the interface has already declined to offer the action, using `protections`, so this is the backstop.',
  },
  {
    type: PROBLEM_TYPES.validation,
    title: 'Validation failed',
    status: 422,
    when: 'A request body is understood but a field is not acceptable.',
    members:
      '`errors`: messages keyed by the name of the field at fault (for a list, `field.index`).',
    client:
      'Puts each message on its field, moves focus to the first, and keeps what the person typed.',
  },
  {
    type: PROBLEM_TYPES.batchNotSaved,
    title: 'The batch was not saved',
    status: 409,
    when: 'An allocation batch passed validation but failed while being applied. Everything has been put back.',
    members: 'None. `detail` names the facility at fault.',
    client: 'Keeps every pending edit, says nothing was saved, and names the facility.',
  },
  {
    type: PROBLEM_TYPES.notFound,
    title: 'Not found',
    status: 404,
    when: 'No such record; or one the caller must not be able to tell exists (another applicant’s booking, a work item outside the approver’s scope).',
    members: 'None.',
    client: 'Shows a not found state. Never distinguishes "does not exist" from "not yours".',
  },
  {
    type: PROBLEM_TYPES.forbidden,
    title: 'Forbidden',
    status: 403,
    when: 'The caller is signed in but their role does not allow the operation (a facility administrator calling a system administrator route).',
    members: 'None.',
    client: 'The interface already hides what the role cannot reach; this is the backstop.',
  },
  {
    type: PROBLEM_TYPES.unauthenticated,
    title: 'No valid session',
    status: 401,
    when: 'The token is missing, expired or not valid.',
    members: 'None.',
    client: 'Sends the person to sign in.',
  },
  {
    type: PROBLEM_TYPES.invalidQuery,
    title: 'Invalid query',
    status: 400,
    when: 'A query parameter is malformed, unknown to the endpoint, or outside what it allows.',
    members: 'None. `detail` names the parameter.',
    client: 'A bug in the client, not a case it handles. Shown as a general failure.',
  },
  {
    type: PROBLEM_TYPES.conflict,
    title: 'Conflict',
    status: 409,
    when: 'A state conflict that none of the above covers: changing an archived record, editing a published terms version (`code: terms_immutable`), publishing a version that is not a draft (`code: terms_not_draft`).',
    members: '`code`, where one is documented.',
    client: 'Shows the `detail`.',
  },
  {
    type: PROBLEM_TYPES.internal,
    title: 'Internal error',
    status: 500,
    when: 'The service failed. Any 5xx.',
    members: 'None.',
    client: 'Shows a general failure with a retry; a failed save keeps what was entered.',
  },
];
