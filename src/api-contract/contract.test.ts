/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { SetupServer } from 'msw/node';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import { OPERATIONS } from '@/shared/api/schemas/operations';
import { PROBLEM_TYPES } from '@/shared/api/contracts/problem-types';
import { installContractChecks, sendsInvalidRequests } from '@/test/contract';
import { createCaller } from './examples';
import { generateArtifacts, seedMock } from './generate';
import { matchOperation, validateRequest, validateResponse } from './validate';

const API = resolve(import.meta.dirname, '..', '..', 'api');
const read = (name: string) => readFileSync(resolve(API, name), 'utf8');

const response = (over: Partial<Parameters<typeof validateResponse>[0]> = {}) =>
  validateResponse({
    method: 'GET',
    url: `${TEST_API_BASE_URL}/me`,
    status: 200,
    contentType: 'application/json',
    bodyText: JSON.stringify({ id: 'u1', email: 'a@b.org', displayName: 'A', role: 'applicant' }),
    headers: new Headers(),
    ...over,
  });

describe('the operations', () => {
  it('are exactly the routes the mock serves: nothing served is missing, nothing described is not served', () => {
    const served = server
      .listHandlers()
      .map((h) => {
        const info = (h as unknown as { info: { method: string; path: string } }).info;
        return `${info.method.toLowerCase()} ${info.path.replace(TEST_API_BASE_URL, '').replace(/:(\w+)/g, '{$1}')}`;
      })
      // The two vocabularies share their handlers, which are registered once per vocabulary.
      .sort();
    const described = OPERATIONS.map((o) => `${o.method} ${o.path}`).sort();
    expect([...new Set(served)]).toEqual(described);
  });

  it('have unique ids and unique method and path pairs', () => {
    expect(new Set(OPERATIONS.map((o) => o.id)).size).toBe(OPERATIONS.length);
    expect(new Set(OPERATIONS.map((o) => `${o.method} ${o.path}`)).size).toBe(OPERATIONS.length);
  });

  it('are matched most specific first: a summary is not a booking called summary', () => {
    expect(matchOperation('get', '/api/bookings/summary')?.id).toBe('getBookingsSummary');
    expect(matchOperation('get', '/api/bookings/bk-1')?.id).toBe('getBooking');
    expect(matchOperation('get', '/api/facilities/filter-options')?.id).toBe(
      'getFacilityFilterOptions',
    );
    expect(matchOperation('get', '/api/approvals/counts')?.id).toBe('getApprovalCounts');
    expect(matchOperation('post', '/api/admin/event-types/x/archive')?.id).toBe('archiveEventType');
    expect(matchOperation('delete', '/api/facilities/x')).toBeNull();
  });
});

describe('a response that differs from the contract', () => {
  it('passes when it is as described', () => {
    expect(response()).toEqual([]);
  });

  it('fails for a field the contract does not describe', () => {
    const issues = response({
      bodyText: JSON.stringify({
        id: 'u1',
        email: 'a@b.org',
        displayName: 'A',
        role: 'applicant',
        extra: 1,
      }),
    });
    expect(issues.join()).toMatch(/Unrecognized key.*extra/);
  });

  it('fails for a missing field or a wrong kind of value', () => {
    expect(response({ bodyText: JSON.stringify({ id: 'u1' }) }).length).toBeGreaterThan(0);
    expect(
      response({
        bodyText: JSON.stringify({ id: 'u1', email: 'a@b.org', displayName: 'A', role: 'janitor' }),
      }).join(),
    ).toMatch(/role/);
  });

  it('fails for an instant that is not UTC', () => {
    const issues = validateResponse({
      method: 'GET',
      url: `${TEST_API_BASE_URL}/public/terms`,
      status: 200,
      contentType: 'application/json',
      bodyText: JSON.stringify({
        version: '1',
        title: 'T',
        paragraphs: [],
        publishedAt: '2026-02-01T08:00:00+02:00',
        placeholder: false,
      }),
      headers: new Headers(),
    });
    expect(issues.join()).toMatch(/publishedAt/);
  });

  it('fails for a status the contract does not list for the operation', () => {
    expect(
      response({ status: 409, contentType: 'application/problem+json', bodyText: '{}' }).join(),
    ).toMatch(/does not list this status/);
  });

  it('fails for a route that is not in the contract', () => {
    expect(response({ url: `${TEST_API_BASE_URL}/surprise` }).join()).toMatch(/no such operation/);
  });

  it('fails for a problem that is not typed, or is not a problem document at all', () => {
    const untyped = {
      method: 'GET',
      url: `${TEST_API_BASE_URL}/bookings/x`,
      status: 404,
      contentType: 'application/problem+json',
      headers: new Headers(),
    };
    expect(
      validateResponse({
        ...untyped,
        bodyText: JSON.stringify({ type: 'about:blank', title: 'No', status: 404 }),
      }).join(),
    ).toMatch(/type/);
    expect(
      validateResponse({
        ...untyped,
        contentType: 'application/json',
        bodyText: '{"title":"No"}',
      }).join(),
    ).toMatch(/problem\+json/);
  });

  it('fails for a slot conflict that does not say which window is taken', () => {
    const issues = validateResponse({
      method: 'POST',
      url: `${TEST_API_BASE_URL}/bookings/x/submit`,
      status: 409,
      contentType: 'application/problem+json',
      bodyText: JSON.stringify({ type: PROBLEM_TYPES.slotConflict, title: 'Taken', status: 409 }),
      headers: new Headers(),
    });
    expect(issues.join()).toMatch(/conflictingWindow/);
  });

  it('fails for an error that says one status in its document and another on the wire', () => {
    const issues = validateResponse({
      method: 'GET',
      url: `${TEST_API_BASE_URL}/bookings/x`,
      status: 404,
      contentType: 'application/problem+json',
      bodyText: JSON.stringify({ type: PROBLEM_TYPES.notFound, title: 'No', status: 410 }),
      headers: new Headers(),
    });
    expect(issues.join()).toMatch(/document says 410/);
  });
});

describe('a request that differs from the contract', () => {
  const request = (over: Partial<Parameters<typeof validateRequest>[0]>) =>
    validateRequest({
      method: 'GET',
      url: `${TEST_API_BASE_URL}/facilities`,
      contentType: '',
      bodyText: '',
      ...over,
    });

  it('passes with repeated parameters and numbers read as numbers', () => {
    expect(
      request({
        url: `${TEST_API_BASE_URL}/facilities?type=a&type=b&minCapacity=50&sort=-capacity`,
      }),
    ).toEqual([]);
  });

  it('fails for a parameter the contract does not describe', () => {
    expect(request({ url: `${TEST_API_BASE_URL}/facilities?color=red` }).join()).toMatch(
      /unknown query parameter "color"/,
    );
  });

  it('fails for a parameter that scopes by a user the client names', () => {
    expect(request({ url: `${TEST_API_BASE_URL}/bookings?userId=someone-else` }).join()).toMatch(
      /unknown query parameter "userId"/,
    );
  });

  it('fails for a value outside what a parameter allows', () => {
    expect(request({ url: `${TEST_API_BASE_URL}/facilities?sort=cheapest` }).join()).toMatch(
      /sort/,
    );
    expect(request({ url: `${TEST_API_BASE_URL}/facilities?pageSize=500` }).join()).toMatch(
      /pageSize/,
    );
  });

  it('fails for a body that is not the one described, and for a body where none is taken', () => {
    expect(
      request({
        method: 'POST',
        url: `${TEST_API_BASE_URL}/bookings`,
        contentType: 'application/json',
        bodyText: JSON.stringify({ facilityId: 'x' }),
      }).join(),
    ).toMatch(/startsAt/);
    expect(
      request({
        method: 'POST',
        url: `${TEST_API_BASE_URL}/bookings/x/submit`,
        bodyText: '{}',
      }).join(),
    ).toMatch(/takes no body/);
  });
});

/**
 * A stand-in for the server that records the listeners the check installs, so the check can be
 * driven by hand. (A second real server would take the interception away from the first.)
 */
function fakeServer() {
  const listeners = new Map<string, (event: never) => void>();
  const server = {
    use: () => {},
    events: {
      on: (name: string, listener: (event: never) => void) => listeners.set(name, listener),
    },
  } as unknown as SetupServer;
  const emit = (name: string, event: unknown) => listeners.get(name)?.(event as never);
  return { server, emit };
}

const answer = (url: string, body: unknown, status = 200, type = 'application/json') => {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': type },
  });
  return { request: new Request(url), response };
};

describe('the check that runs on every test', () => {
  it('fails a test whose handler sends something the contract does not describe', async () => {
    const { server: stub, emit } = fakeServer();
    const checks = installContractChecks(stub);
    emit('response:mocked', answer(`${TEST_API_BASE_URL}/me`, { id: 'u1', surprise: true }));
    await expect(checks.assertClean()).rejects.toThrow(/The API contract was broken/);
  });

  it('passes a handler that sends what the contract describes', async () => {
    const { server: stub, emit } = fakeServer();
    const checks = installContractChecks(stub);
    emit(
      'response:mocked',
      answer(`${TEST_API_BASE_URL}/me`, {
        id: 'u1',
        email: 'a@b.org',
        displayName: 'A',
        role: 'applicant',
      }),
    );
    await expect(checks.assertClean()).resolves.toBeUndefined();
  });

  it('fails a test that makes a request the contract does not allow', async () => {
    const { server: stub, emit } = fakeServer();
    const checks = installContractChecks(stub);
    emit('request:start', { request: new Request(`${TEST_API_BASE_URL}/facilities?color=red`) });
    await expect(checks.assertClean()).rejects.toThrow(/unknown query parameter "color"/);
  });

  it('leaves out responses of a test that installed handlers of its own, but not its requests', async () => {
    const { server: stub, emit } = fakeServer();
    const checks = installContractChecks(stub);
    stub.use();
    emit('response:mocked', answer(`${TEST_API_BASE_URL}/me`, { nonsense: true }));
    await expect(checks.assertClean()).resolves.toBeUndefined();
    emit('request:start', { request: new Request(`${TEST_API_BASE_URL}/facilities?color=red`) });
    await expect(checks.assertClean()).rejects.toThrow(/color/);
  });

  it('lets a test that provokes a refusal say so, and still checks the refusal', async () => {
    const { server: stub, emit } = fakeServer();
    const checks = installContractChecks(stub);
    sendsInvalidRequests();
    emit('request:start', {
      request: new Request(`${TEST_API_BASE_URL}/facilities?sort=cheapest`),
    });
    emit(
      'response:mocked',
      answer(
        `${TEST_API_BASE_URL}/facilities?sort=cheapest`,
        { type: PROBLEM_TYPES.invalidQuery, title: 'Invalid query', status: 400 },
        400,
        'application/problem+json',
      ),
    );
    await expect(checks.assertClean()).resolves.toBeUndefined();
    // A refusal that is not a documented problem is still caught.
    emit(
      'response:mocked',
      answer(`${TEST_API_BASE_URL}/facilities`, { title: 'No' }, 400, 'application/json'),
    );
    await expect(checks.assertClean()).rejects.toThrow(/problem\+json/);
  });
});

describe('the published contract', () => {
  // The same capture the generator runs, against this test run's mock, at the same instant.
  let artifacts: Awaited<ReturnType<typeof generateArtifacts>>;
  const generate = async () => {
    sendsInvalidRequests();
    seedMock();
    artifacts ??= await generateArtifacts(createCaller(TEST_API_BASE_URL, fetch));
    return artifacts;
  };

  it('is what the schemas and the mock produce now: the committed copy is not stale', async () => {
    const fresh = await generate();
    expect(
      fresh.openapi === read('openapi.yaml'),
      'api/openapi.yaml is stale: run `npm run api:generate`',
    ).toBe(true);
    expect(
      fresh.inventory === read('INVENTORY.md'),
      'api/INVENTORY.md is stale: run `npm run api:generate`',
    ).toBe(true);
  });

  it('is a valid OpenAPI 3.1 document', async () => {
    const api = await SwaggerParser.validate(parse(read('openapi.yaml')));
    expect(api.openapi).toBe('3.1.0');
    expect(Object.values(api.paths ?? {}).flatMap((p) => Object.keys(p as object))).toHaveLength(
      OPERATIONS.length,
    );
  });

  it('describes every operation, each with an example drawn from the mock', () => {
    const doc = parse(read('openapi.yaml')) as {
      paths: Record<
        string,
        Record<
          string,
          {
            operationId: string;
            responses: Record<string, { content?: Record<string, { examples?: object }> }>;
          }
        >
      >;
    };
    for (const operation of OPERATIONS) {
      const described = doc.paths[operation.path]?.[operation.method];
      expect(described?.operationId, `${operation.method} ${operation.path}`).toBe(operation.id);
      const withExample = Object.entries(described?.responses ?? {}).filter(
        ([status, r]) =>
          Object.values(r.content ?? {}).some(
            (c) => c.examples && Object.keys(c.examples).length > 0,
          ) && Number(status) < 300,
      );
      // A file or an empty answer has nothing to show, but its request is still exemplified.
      const kind = operation.success.body.kind;
      if (kind === 'json' || kind === 'csv') {
        expect(withExample.length, `${operation.id} has no example`).toBeGreaterThan(0);
      }
    }
  });

  it('shows the awkward cases a backend developer needs', () => {
    const text = read('openapi.yaml');
    const doc = parse(text) as {
      paths: Record<
        string,
        Record<
          string,
          {
            responses: Record<
              string,
              {
                content: Record<
                  string,
                  { examples: Record<string, { value: Record<string, unknown> }> }
                >;
              }
            >;
          }
        >
      >;
    };
    const examples = (path: string, method: string, status: string, type = 'application/json') =>
      doc.paths[path]?.[method]?.responses[status]?.content[type]?.examples ?? {};

    // All five segment statuses, and a closed day, in one availability response.
    const six = examples('/facilities/{id}/availability', 'get', '200').allSixStatuses?.value as {
      days: Array<{ status: string; closedBy?: string; segments: Array<{ status: string }> }>;
    };
    expect(new Set(six.days.flatMap((d) => d.segments.map((s) => s.status)))).toEqual(
      new Set(['booked', 'held', 'buffer', 'blocked_by_related', 'closure']),
    );
    expect(six.days.some((d) => d.status === 'closed' && d.closedBy === 'blackout')).toBe(true);

    // An impact check listing affected bookings, one of them over several days.
    const impact = examples('/admin/facilities/{id}/impact', 'post', '200').default?.value as {
      affectedBookings: Array<{ reason: string; day?: string }>;
      totalAffected: number;
    };
    expect(impact.totalAffected).toBeGreaterThan(0);
    expect(impact.affectedBookings[0]).toMatchObject({
      reason: 'inside_blackout',
      day: '2027-01-09',
    });

    // A slot conflict problem with the window and the facility that caused it.
    const conflict = examples('/bookings/{id}/submit', 'post', '409', 'application/problem+json')
      .slotConflict?.value as Record<string, unknown>;
    expect(conflict).toMatchObject({ type: PROBLEM_TYPES.slotConflict, status: 409 });
    expect(conflict.conflictingWindow).toBeDefined();
    expect(conflict.relatedFacility).toMatchObject({ name: 'City Hall', relationship: 'parent' });

    // Competing requests spanning a parent and a child.
    const competing = examples('/approvals/{id}', 'get', '200').parentAndChildren?.value as {
      context: { competingRequests: Array<{ relationship: string }> };
    };
    expect(new Set(competing.context.competingRequests.map((c) => c.relationship))).toEqual(
      new Set(['child']),
    );
    const child = examples('/approvals/{id}', 'get', '200').default?.value as {
      context: {
        competingRequests: Array<{ relationship: string }>;
        blockedBy: Array<{ relationship: string }>;
      };
    };
    expect(
      [...child.context.competingRequests, ...child.context.blockedBy].some(
        (c) => c.relationship === 'parent',
      ),
    ).toBe(true);

    // The other problems the client handles specifically.
    expect(
      examples('/bookings/{id}/submit', 'post', '422', 'application/problem+json').incomplete,
    ).toBeDefined();
    expect(
      examples('/bookings/{id}/approve', 'post', '409', 'application/problem+json').alreadyDecided,
    ).toBeDefined();
    expect(
      examples('/admin/resource-allocations', 'put', '409', 'application/problem+json')
        .partialFailure,
    ).toBeDefined();
    expect(
      examples('/bookings/{id}', 'get', '404', 'application/problem+json').someoneElses,
    ).toBeDefined();
  });
});
