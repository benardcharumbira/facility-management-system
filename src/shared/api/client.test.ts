import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server, TEST_API_BASE_URL } from '@/mocks/server';
import type { Paginated } from '@/shared/types/pagination';
import { createApiClient } from './client';
import { ApiProblem } from './problem';

const client = createApiClient({
  baseUrl: TEST_API_BASE_URL,
  getToken: async () => 'session-token',
});

describe('api client', () => {
  it('turns an RFC 7807 response into a typed ApiProblem', async () => {
    server.use(
      http.post(`${TEST_API_BASE_URL}/bookings`, () =>
        HttpResponse.json(
          {
            type: 'https://example.org/problems/conflict',
            title: 'Slot unavailable',
            status: 409,
            detail: 'The requested window overlaps an existing booking.',
            instance: '/bookings',
            errors: { startsAt: ['Overlaps another booking'] },
            traceId: 'abc123',
          },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );

    const error = await client.post('/bookings', { body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiProblem);
    expect(error).toMatchObject({
      kind: 'problem',
      status: 409,
      title: 'Slot unavailable',
      type: 'https://example.org/problems/conflict',
      detail: 'The requested window overlaps an existing booking.',
      instance: '/bookings',
      errors: { startsAt: ['Overlaps another booking'] },
      extensions: { traceId: 'abc123' },
    });
  });

  it('normalises network failures into an ApiProblem', async () => {
    server.use(http.get(`${TEST_API_BASE_URL}/me`, () => HttpResponse.error()));
    await expect(client.get('/me')).rejects.toMatchObject({ kind: 'network', status: 0 });
  });

  it('normalises non-problem error bodies into an ApiProblem', async () => {
    server.use(
      http.get(
        `${TEST_API_BASE_URL}/me`,
        () => new HttpResponse('<html>boom</html>', { status: 502 }),
      ),
    );
    await expect(client.get('/me')).rejects.toMatchObject({ kind: 'unexpected', status: 502 });
  });

  it('sends array query values as repeated parameters and omits empty ones', async () => {
    let search = '';
    server.use(
      http.get(`${TEST_API_BASE_URL}/echo`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({});
      }),
    );
    await client.get('/echo', { query: { type: ['a', 'b'], empty: [], none: undefined, n: 2 } });
    expect(search).toBe('?type=a&type=b&n=2');
  });

  it('attaches the session token to every request', async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${TEST_API_BASE_URL}/me`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );
    await client.get('/me');
    expect(authorization).toBe('Bearer session-token');
  });

  it('returns the pagination envelope from the facilities endpoint', async () => {
    const page = await client.get<Paginated<{ id: string }>>('/facilities', {
      query: { page: 1, pageSize: 10 },
    });
    expect(page).toMatchObject({ page: 1, pageSize: 10 });
    expect(page.totalPages).toBe(Math.ceil(page.totalItems / 10));
    expect(page.items).toHaveLength(10);
  });
});
