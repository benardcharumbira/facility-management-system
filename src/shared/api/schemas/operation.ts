import type { z } from 'zod';

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Who may call it. `public` needs no session; `authenticated` needs any; the rest name roles. */
export type Access =
  | 'public'
  | 'authenticated'
  | readonly ('applicant' | 'internal' | 'facility_admin' | 'system_admin')[];

/** The problems an operation can answer with, beyond the ones every operation can. */
export type ProblemKey =
  | 'invalidQuery'
  | 'validation'
  | 'notFound'
  | 'conflict'
  | 'slotConflict'
  | 'alreadyDecided'
  | 'actionNotAllowed'
  | 'batchNotSaved';

/** What a success sends. */
export type SuccessBody =
  | { kind: 'json'; schema: z.ZodType }
  | { kind: 'empty' }
  | { kind: 'binary'; contentType: string }
  | { kind: 'csv' };

/** A request made against the mock to capture a real response for the published examples. */
export interface ExampleScenario {
  name: string;
  summary: string;
  /** The user the request is made as, by id. Defaults to a caller who is allowed. */
  as?: string;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: unknown;
  /** A file to send, for multipart operations. */
  file?: { name: string; content: string; type: string; caption?: string };
  /** Runs before the request, against the mock, to bring about the case being shown. */
  setup?: string;
  /** The status the example shows. Defaults to the operation's success status. */
  status?: number;
  /** Values to keep from the response for later examples: name -> path (`items.0.id`). */
  capture?: Record<string, string>;
}

export interface Operation {
  /** Unique, camel case: becomes the OpenAPI operationId. */
  id: string;
  method: Method;
  /** OpenAPI style: `/bookings/{id}`. Relative to the API base URL. */
  path: string;
  /** The slice that defined it, for the inventory. */
  slice: number;
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  /** Query parameters, as a strict object. Anything not listed is refused by the contract tests. */
  query?: z.ZodObject;
  /** The JSON request body, or a multipart one. */
  body?: z.ZodType;
  multipart?: z.ZodType;
  /** The success status and what it sends. */
  success: { status: 200 | 201 | 204; body: SuccessBody; headers?: Record<string, string> };
  /** Further problems this operation answers with. */
  problems?: ProblemKey[];
  examples?: ExampleScenario[];
}
