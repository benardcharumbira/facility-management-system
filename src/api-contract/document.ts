/**
 * Builds the OpenAPI 3.1 document from the schemas and the operation registry. Nothing in the
 * document is written by hand: shapes come from the Zod schemas, paths, parameters and responses
 * from the registry, and examples from real responses captured from the mock.
 */
import { z } from 'zod';
import { PROBLEM_TYPES } from '@/shared/api/contracts/problem-types';
import * as problems from '@/shared/api/schemas/problems';
import type { Access, Operation, ProblemKey } from '@/shared/api/schemas/operation';
import { OPERATIONS } from '@/shared/api/schemas/operations';
import { componentNames, refTo, registry } from './components';
import type { CapturedExample } from './examples';

type Json = Record<string, unknown>;

const TAG_DESCRIPTIONS: Record<string, string> = {
  Session: 'Who the caller is, and their own profile.',
  Public: 'Unauthenticated content: the landing page, the terms and the static pages.',
  Facilities: 'Browsing the public estate.',
  Availability: 'What is free, day by day. The server resolves hierarchy, buffers and holds.',
  Bookings: 'An applicant’s own bookings, from draft to cancellation.',
  Approvals: 'The approver’s queue and decisions.',
  'Facility administration': 'Facilities, their hours, closures, images, capacity and approvers.',
  Resources: 'The resource catalogue and what each facility holds.',
  Users: 'Roles, designation and account status. Clerk owns the profile.',
  'Reference data': 'Seating arrangements, event types and the terms and conditions.',
  Audit: 'The audit trail and its export.',
};

const ROLE_LABEL: Record<string, string> = {
  applicant: 'applicant',
  internal: 'internal user',
  facility_admin: 'facility administrator',
  system_admin: 'system administrator',
};

export const accessSentence = (access: Access): string =>
  access === 'public'
    ? 'No session needed.'
    : access === 'authenticated'
      ? 'Any signed in user.'
      : `Roles: ${access.map((r) => ROLE_LABEL[r]).join(', ')}.`;

// --- JSON Schema ---------------------------------------------------------------------------

/** The registry's schemas, converted once, as components. */
let componentSchemas: Record<string, Json> | undefined;

function tidy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(tidy) as T;
  if (value && typeof value === 'object') {
    const out: Json = {};
    for (const [key, item] of Object.entries(value)) {
      // The contract tests keep objects strict; the published schemas stay open to additions.
      if (key === '$schema' || key === '$id') continue;
      if (key === 'additionalProperties' && item === false) continue;
      out[key] = tidy(item);
    }
    return out as T;
  }
  return value;
}

function components(): Record<string, Json> {
  const converted = tidy(
    (
      z.toJSONSchema(registry, {
        uri: (id) => `#/components/schemas/${id}`,
        unrepresentable: 'any',
      }) as { schemas: Record<string, Json> }
    ).schemas,
  );
  componentSchemas ??= Object.fromEntries(
    Object.entries(converted).sort(([a], [b]) => a.localeCompare(b)),
  );
  return componentSchemas;
}

/** A schema as it appears inside an operation: a reference if it is a component, else inline. */
export function schemaFor(schema: z.ZodType): Json {
  const named = componentNames.get(schema);
  if (named) return refTo(named);
  // Anonymous: register it briefly so nested components become references.
  const temporary = z.registry<{ id: string }>();
  for (const [s, id] of componentNames) temporary.add(s, { id });
  temporary.add(schema, { id: '__anonymous__' });
  const out = z.toJSONSchema(temporary, {
    uri: (id) => `#/components/schemas/${id}`,
    unrepresentable: 'any',
  }) as { schemas: Record<string, Json> };
  return tidy(out.schemas.__anonymous__ ?? {});
}

// --- parameters ----------------------------------------------------------------------------

function pathParameters(path: string): Json[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description: match[1] === 'id' ? 'The identifier of the record.' : `The ${match[1]}.`,
  }));
}

function queryParameters(operation: Operation): Json[] {
  if (!operation.query) return [];
  const json = tidy(
    z.toJSONSchema(operation.query, { unrepresentable: 'any' }) as {
      properties?: Record<string, Json>;
      required?: string[];
    },
  );
  return Object.entries(json.properties ?? {}).map(([name, schema]) => {
    const { description, ...rest } = schema as Json & { description?: string };
    const isArray = (schema as Json).type === 'array';
    return {
      name,
      in: 'query',
      required: (json.required ?? []).includes(name),
      ...(description ? { description } : {}),
      ...(isArray ? { style: 'form', explode: true } : {}),
      schema: rest,
    };
  });
}

// --- responses -----------------------------------------------------------------------------

const PROBLEM_JSON = 'application/problem+json';

const problemSchema: Record<ProblemKey, { status: number; schema: z.ZodType }> = {
  invalidQuery: { status: 400, schema: problems.problem },
  validation: { status: 422, schema: problems.validationProblem },
  notFound: { status: 404, schema: problems.problem },
  conflict: { status: 409, schema: problems.problem },
  slotConflict: { status: 409, schema: problems.slotConflictProblem },
  alreadyDecided: { status: 409, schema: problems.alreadyDecidedProblem },
  actionNotAllowed: { status: 409, schema: problems.actionNotAllowedProblem },
  batchNotSaved: { status: 409, schema: problems.batchNotSavedProblem },
};

/** The problem statuses an operation can answer with, from its registry entry. */
export function problemStatusesOf(operation: Operation): Map<number, ProblemKey[]> {
  const keys = new Set<ProblemKey>(operation.problems ?? []);
  if (operation.query) keys.add('invalidQuery');
  if (operation.body || operation.multipart) keys.add('validation');
  if (/\{\w+\}/.test(operation.path)) keys.add('notFound');
  const byStatus = new Map<number, ProblemKey[]>();
  for (const key of keys) {
    const { status } = problemSchema[key];
    byStatus.set(status, [...(byStatus.get(status) ?? []), key]);
  }
  return byStatus;
}

const DESCRIPTIONS: Record<number, string> = {
  400: 'A malformed or unsupported query parameter.',
  404: 'No such record, or one the caller may not know exists.',
  409: 'The request conflicts with the state of the record. The problem `type` says how.',
  422: 'Validation failed. `errors` maps each field at fault to its messages.',
};

function exampleValue(example: CapturedExample) {
  return example.response.body;
}

function exampleDescription(example: CapturedExample): string {
  const { method, path, query, as } = example.request;
  const qs = Object.entries(query ?? {})
    .flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((item) => `${k}=${item}`))
    .join('&');
  return `\`${method.toUpperCase()} ${path}${qs ? `?${qs}` : ''}\`${as ? ` as ${as}` : ''}`;
}

function responsesFor(operation: Operation, examples: CapturedExample[]): Json {
  const out: Json = {};
  const withStatus = (status: number) => examples.filter((e) => e.response.status === status);
  const asExamples = (list: CapturedExample[]) =>
    Object.fromEntries(
      list.map((e) => [
        e.name,
        { summary: e.summary, description: exampleDescription(e), value: exampleValue(e) },
      ]),
    );

  // Success.
  const { status, body, headers } = operation.success;
  const successExamples = withStatus(status);
  const headerObject = headers
    ? Object.fromEntries(
        Object.entries(headers).map(([name, description]) => [
          name,
          { description, schema: { type: 'string' } },
        ]),
      )
    : undefined;
  if (body.kind === 'json') {
    out[String(status)] = {
      description: status === 201 ? 'Created.' : 'Success.',
      content: {
        'application/json': {
          schema: schemaFor(body.schema),
          ...(successExamples.length > 0 ? { examples: asExamples(successExamples) } : {}),
        },
      },
    };
  } else if (body.kind === 'empty') {
    out[String(status)] = { description: 'Done. No content.' };
  } else if (body.kind === 'csv') {
    out[String(status)] = {
      description:
        'The rows as CSV, with a header row. Cells a spreadsheet would run as a formula are neutralised.',
      ...(headerObject ? { headers: headerObject } : {}),
      content: {
        'text/csv': {
          schema: { type: 'string' },
          ...(successExamples.length > 0 ? { examples: asExamples(successExamples) } : {}),
        },
      },
    };
  } else {
    out[String(status)] = {
      description: 'The file.',
      content: { [body.contentType]: { schema: { type: 'string', format: 'binary' } } },
    };
  }

  // Problems.
  for (const [code, keys] of problemStatusesOf(operation)) {
    const schemas = [...new Set(keys.map((k) => problemSchema[k].schema))];
    const schema =
      schemas.length === 1 ? schemaFor(schemas[0] as z.ZodType) : { oneOf: schemas.map(schemaFor) };
    const list = withStatus(code);
    out[String(code)] = {
      description: DESCRIPTIONS[code] ?? 'A problem.',
      content: {
        [PROBLEM_JSON]: {
          schema,
          ...(list.length > 0 ? { examples: asExamples(list) } : {}),
        },
      },
    };
  }

  // Examples for statuses no listed problem accounts for (a 5xx a scenario provokes).
  for (const example of examples) {
    const code = example.response.status;
    if (out[String(code)] || code < 400) continue;
    out[String(code)] = {
      description: 'A problem.',
      content: {
        [PROBLEM_JSON]: {
          schema: schemaFor(problems.problem),
          examples: asExamples(withStatus(code)),
        },
      },
    };
  }

  if (operation.access !== 'public')
    out['401'] = { $ref: '#/components/responses/Unauthenticated' };
  if (Array.isArray(operation.access)) out['403'] = { $ref: '#/components/responses/Forbidden' };
  out['5XX'] = { $ref: '#/components/responses/ServerError' };
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

// --- document ------------------------------------------------------------------------------

export function buildOpenApi(
  captured: CapturedExample[],
  operations: Operation[] = OPERATIONS,
): Json {
  const paths: Record<string, Json> = {};
  for (const operation of operations) {
    const mine = captured.filter((e) => e.operationId === operation.id);
    const bodyExamples = mine.filter((e) => e.request.body !== undefined);
    const requestBody = operation.body
      ? {
          required: true,
          content: {
            'application/json': {
              schema: schemaFor(operation.body),
              ...(bodyExamples.length > 0
                ? {
                    examples: Object.fromEntries(
                      bodyExamples.map((e) => [
                        e.name,
                        { summary: e.summary, value: e.request.body },
                      ]),
                    ),
                  }
                : {}),
            },
          },
        }
      : operation.multipart
        ? {
            required: true,
            content: { 'multipart/form-data': { schema: schemaFor(operation.multipart) } },
          }
        : undefined;

    paths[operation.path] ??= {};
    (paths[operation.path] as Json)[operation.method] = {
      operationId: operation.id,
      tags: [operation.tag],
      summary: operation.summary,
      description: [operation.description, accessSentence(operation.access)]
        .filter(Boolean)
        .join('\n\n'),
      'x-slice': operation.slice,
      ...(operation.access === 'public' ? { security: [] } : {}),
      parameters: [...pathParameters(operation.path), ...queryParameters(operation)],
      ...(requestBody ? { requestBody } : {}),
      responses: responsesFor(operation, mine),
    };
  }

  const problemResponse = (description: string, status: number) => ({
    description,
    content: {
      [PROBLEM_JSON]: {
        schema: refTo('Problem'),
        examples: {
          default: {
            value: {
              type: PROBLEM_TYPES[
                status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal'
              ],
              title: description,
              status,
            },
          },
        },
      },
    },
  });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Facilities Booking API',
      version: '1.0.0',
      description: [
        'The API for the Midvaal facilities booking service. **Generated** from the schemas in `src/shared/api/schemas`; do not edit by hand. Examples are real responses captured from the mock.',
        'Read `api/BEHAVIOUR.md` alongside this document: it carries the rules a schema cannot, such as that the server resolves facility hierarchy and that an impact check never changes anything.',
        '**Conventions.** Collections use one envelope (`items`, `page`, `pageSize`, `totalItems`, `totalPages`). Multi value filters repeat the parameter. `sort` takes a field, with a leading `-` for descending. Every instant is UTC ISO 8601 ending in `Z`; a date with no time is an ISO date in the facility time zone; wall clock times are `HH:mm` in the facility time zone. Errors are RFC 7807 problem documents with a stable `type` URI.',
      ].join('\n\n'),
    },
    servers: [{ url: '/api', description: 'Relative to the host' }],
    tags: Object.entries(TAG_DESCRIPTIONS).map(([name, description]) => ({ name, description })),
    security: [{ bearerAuth: [] }],
    paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'A Clerk issued session token, validated against Clerk’s published JWKS. The application role is resolved on the server from the token’s subject. The mock accepts `Bearer user:<id>` instead.',
        },
      },
      responses: {
        Unauthenticated: problemResponse('No valid session.', 401),
        Forbidden: problemResponse('The caller’s role does not allow this.', 403),
        ServerError: problemResponse('The service failed.', 500),
      },
      schemas: components(),
    },
  };
}
