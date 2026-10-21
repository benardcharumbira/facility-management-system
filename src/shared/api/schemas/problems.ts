/**
 * RFC 7807 problem documents. Every error the API sends is one of these, with a stable `type` URI
 * and, where the client acts on it specifically, a machine readable `code` or typed extension
 * members. A generic problem where a specific one is documented is a bug.
 */
import { z } from 'zod';
import { PROBLEM_TYPES } from '../contracts/problem-types';
import { fieldErrors, instant, int } from './common';

const base = {
  title: z.string().meta({ description: 'A short, human readable summary of the problem type.' }),
  status: int.meta({ description: 'The HTTP status.' }),
  detail: z
    .string()
    .optional()
    .meta({ description: 'This occurrence, in words an end user can read.' }),
  instance: z.string().optional(),
};

/** Any problem: the `type` is one of the catalogue. Extension members are allowed. */
export const problem = z.looseObject({
  type: z.enum(Object.values(PROBLEM_TYPES) as [string, ...string[]]),
  ...base,
  code: z
    .string()
    .optional()
    .meta({ description: 'A machine readable code, where one is documented.' }),
  errors: fieldErrors.optional(),
});

export const validationProblem = z.looseObject({
  type: z.literal(PROBLEM_TYPES.validation),
  ...base,
  errors: fieldErrors.meta({ description: 'Messages keyed by the name of the field at fault.' }),
});

export const slotConflictProblem = z.looseObject({
  type: z.literal(PROBLEM_TYPES.slotConflict),
  ...base,
  conflictingWindow: z.strictObject({ startsAt: instant, endsAt: instant }),
  relatedFacility: z
    .strictObject({
      id: z.string(),
      name: z.string(),
      relationship: z.enum(['parent', 'child']),
    })
    .optional(),
  reason: z.string(),
});

export const alreadyDecidedProblem = z.looseObject({
  type: z.literal(PROBLEM_TYPES.alreadyDecided),
  ...base,
  decision: z.strictObject({
    outcome: z.enum(['approved', 'rejected']),
    decidedBy: z.string().nullable(),
    decidedAt: instant,
  }),
});

export const actionNotAllowedProblem = z.looseObject({
  type: z.literal(PROBLEM_TYPES.actionNotAllowed),
  ...base,
});

export const batchNotSavedProblem = z.looseObject({
  type: z.literal(PROBLEM_TYPES.batchNotSaved),
  ...base,
});

/** The status each documented problem is sent with. */
export const problemStatuses = {
  validation: 422,
  slotConflict: 409,
  alreadyDecided: 409,
  actionNotAllowed: 409,
  batchNotSaved: 409,
} as const;
