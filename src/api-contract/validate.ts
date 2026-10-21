/**
 * Checks requests and responses against the contract. The test run uses it on every request the
 * client makes and every response a handler sends, so the mock cannot send what the contract does
 * not describe and the client cannot ask for what it does not allow.
 */
import { z } from 'zod';
import * as problems from '@/shared/api/schemas/problems';
import { PROBLEM_TYPES } from '@/shared/api/contracts/problem-types';
import type { Operation } from '@/shared/api/schemas/operation';
import { OPERATIONS } from '@/shared/api/schemas/operations';
import { problemStatusesOf } from './document';

const API_ROOT = '/api';

interface Matcher {
  operation: Operation;
  pattern: RegExp;
}

/** More specific paths first, so `/bookings/summary` is not read as a booking called "summary". */
const matchers: Matcher[] = [...OPERATIONS]
  .sort(
    (a, b) =>
      (a.path.match(/\{/g)?.length ?? 0) - (b.path.match(/\{/g)?.length ?? 0) ||
      b.path.length - a.path.length,
  )
  .map((operation) => ({
    operation,
    pattern: new RegExp(`^${API_ROOT}${operation.path.replace(/\{\w+\}/g, '([^/]+)')}/?$`),
  }));

export function matchOperation(method: string, pathname: string): Operation | null {
  const verb = method.toLowerCase();
  return (
    matchers.find((m) => m.operation.method === verb && m.pattern.test(pathname))?.operation ?? null
  );
}

const issuesOf = (error: z.ZodError) =>
  error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);

// --- requests -------------------------------------------------------------------------------

const shapes = new Map<string, Record<string, { array: boolean; type: string }>>();

function queryShape(operation: Operation) {
  let shape = shapes.get(operation.id);
  if (!shape && operation.query) {
    const json = z.toJSONSchema(operation.query, { unrepresentable: 'any' }) as {
      properties?: Record<string, { type?: string; items?: { type?: string } }>;
    };
    shape = Object.fromEntries(
      Object.entries(json.properties ?? {}).map(([name, schema]) => [
        name,
        {
          array: schema.type === 'array',
          type: (schema.type === 'array' ? schema.items?.type : schema.type) ?? 'string',
        },
      ]),
    );
    shapes.set(operation.id, shape);
  }
  return shape ?? {};
}

const coerce = (value: string, type: string): unknown =>
  type === 'integer' || type === 'number'
    ? value.trim() === '' || Number.isNaN(Number(value))
      ? value
      : Number(value)
    : type === 'boolean'
      ? value === 'true'
        ? true
        : value === 'false'
          ? false
          : value
      : value;

export interface RequestFacts {
  method: string;
  url: string;
  contentType: string;
  bodyText: string;
}

/** What is wrong with a request, in words. Empty when it is as the contract describes. */
export function validateRequest(facts: RequestFacts): string[] {
  const url = new URL(facts.url);
  if (!url.pathname.startsWith(API_ROOT)) return [];
  const operation = matchOperation(facts.method, url.pathname);
  const label = `${facts.method.toUpperCase()} ${url.pathname}`;
  if (!operation) return [`${label}: no such operation in the contract.`];

  const issues: string[] = [];

  // Query: every parameter is declared, and each has the right kind of value.
  const shape = queryShape(operation);
  const names = new Set(url.searchParams.keys());
  if (!operation.query && names.size > 0) {
    issues.push(`${label}: takes no query parameters, got ${[...names].join(', ')}.`);
  } else if (operation.query) {
    const parsed: Record<string, unknown> = {};
    for (const name of names) {
      const field = shape[name];
      if (!field) {
        issues.push(`${label}: unknown query parameter "${name}".`);
        continue;
      }
      parsed[name] = field.array
        ? url.searchParams.getAll(name).map((v) => coerce(v, field.type))
        : coerce(url.searchParams.get(name) ?? '', field.type);
    }
    const result = operation.query.safeParse(parsed);
    if (!result.success) issues.push(...issuesOf(result.error).map((m) => `${label} query: ${m}`));
  }

  // Body.
  const hasBody = facts.bodyText !== '';
  if (operation.multipart) {
    if (!facts.contentType.includes('multipart/form-data')) {
      issues.push(`${label}: expects multipart/form-data, got "${facts.contentType}".`);
    }
  } else if (operation.body) {
    let value: unknown = {};
    if (hasBody) {
      try {
        value = JSON.parse(facts.bodyText);
      } catch {
        issues.push(`${label}: the body is not JSON.`);
        return issues;
      }
    }
    const result = operation.body.safeParse(value);
    if (!result.success) issues.push(...issuesOf(result.error).map((m) => `${label} body: ${m}`));
  } else if (hasBody) {
    issues.push(`${label}: takes no body.`);
  }
  return issues;
}

// --- responses ------------------------------------------------------------------------------

export interface ResponseFacts {
  method: string;
  url: string;
  status: number;
  contentType: string;
  bodyText: string;
  headers: Headers;
}

const specificProblem: Record<string, z.ZodType> = {
  [PROBLEM_TYPES.validation]: problems.validationProblem,
  [PROBLEM_TYPES.slotConflict]: problems.slotConflictProblem,
  [PROBLEM_TYPES.alreadyDecided]: problems.alreadyDecidedProblem,
  [PROBLEM_TYPES.actionNotAllowed]: problems.actionNotAllowedProblem,
  [PROBLEM_TYPES.batchNotSaved]: problems.batchNotSavedProblem,
};

/** The statuses an operation may answer with. */
export function allowedStatuses(operation: Operation): Set<number> {
  const allowed = new Set<number>([
    operation.success.status,
    ...problemStatusesOf(operation).keys(),
  ]);
  if (operation.access !== 'public') allowed.add(401);
  if (Array.isArray(operation.access)) allowed.add(403);
  return allowed;
}

/** What is wrong with a response, in words. Empty when it is as the contract describes. */
export function validateResponse(facts: ResponseFacts): string[] {
  const url = new URL(facts.url);
  if (!url.pathname.startsWith(API_ROOT)) return [];
  const operation = matchOperation(facts.method, url.pathname);
  const label = `${facts.method.toUpperCase()} ${url.pathname} -> ${facts.status}`;
  if (!operation) return [`${label}: no such operation in the contract.`];

  const issues: string[] = [];
  const success = facts.status >= 200 && facts.status < 300;

  if (facts.status >= 500) {
    // Any operation may fail; the failure is still a problem document.
    return facts.contentType.includes('problem+json')
      ? []
      : [`${label}: a failure must be a problem document.`];
  }
  if (!allowedStatuses(operation).has(facts.status)) {
    issues.push(`${label}: the contract does not list this status for ${operation.id}.`);
  }

  if (success) {
    const body = operation.success.body;
    if (body.kind === 'json') {
      let value: unknown;
      try {
        value = JSON.parse(facts.bodyText);
      } catch {
        return [...issues, `${label}: the body is not JSON.`];
      }
      const result = body.schema.safeParse(value);
      if (!result.success) issues.push(...issuesOf(result.error).map((m) => `${label}: ${m}`));
    } else if (body.kind === 'empty' && facts.bodyText !== '') {
      issues.push(`${label}: expected no content.`);
    } else if (body.kind === 'csv') {
      if (!facts.contentType.includes('text/csv')) issues.push(`${label}: expected text/csv.`);
      if (!facts.headers.get('X-Row-Count'))
        issues.push(`${label}: missing the X-Row-Count header.`);
    }
    return issues;
  }

  // A problem document.
  if (!facts.contentType.includes('problem+json')) {
    return [
      ...issues,
      `${label}: an error must be application/problem+json, got "${facts.contentType}".`,
    ];
  }
  let value: unknown;
  try {
    value = JSON.parse(facts.bodyText);
  } catch {
    return [...issues, `${label}: the body is not JSON.`];
  }
  const general = problems.problem.safeParse(value);
  if (!general.success) {
    issues.push(...issuesOf(general.error).map((m) => `${label}: ${m}`));
  } else {
    const specific = specificProblem[general.data.type];
    const result = specific?.safeParse(value);
    if (result && !result.success)
      issues.push(...issuesOf(result.error).map((m) => `${label}: ${m}`));
    if (general.data.status !== facts.status)
      issues.push(`${label}: the document says ${general.data.status}.`);
  }
  return issues;
}
