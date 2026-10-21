/**
 * Captures the published examples by making each scenario's request against the mock and keeping
 * the real response. Nothing in an example is written by hand: if the mock changes what it
 * answers, the example changes with it, and a scenario whose answer is not what the registry says
 * it should be fails the capture.
 */
import { DateTime } from 'luxon';
import type { ExampleScenario, Operation } from '@/shared/api/schemas/operation';
import { OPERATIONS } from '@/shared/api/schemas/operations';
import { SETUPS, type Caller } from './setups';

export interface CapturedExample {
  operationId: string;
  name: string;
  summary: string;
  request: {
    method: string;
    path: string;
    query?: Record<string, string | string[]>;
    body?: unknown;
    as?: string;
  };
  response: { status: number; contentType: string; body: unknown };
}

/** The instant every example is captured at: the same as the test clock. */
export const EXAMPLE_NOW = DateTime.fromISO('2026-11-02T08:00:00Z', { zone: 'utc' });

type Context = Record<string, string>;

function substitute<T>(value: T, context: Context): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      const found = context[name];
      if (found === undefined)
        throw new Error(`An example uses {{${name}}} before anything captured it.`);
      return found;
    }) as T;
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, context)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substitute(item, context)]),
    ) as T;
  }
  return value;
}

const pick = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);

/** A multipart body built by hand, so it travels through any `fetch` whatever its environment. */
function multipart(file: NonNullable<ExampleScenario['file']>) {
  const boundary = '----contract-example';
  const part = (name: string, value: string, filename?: string, type?: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ''}\r\n${type ? `Content-Type: ${type}\r\n` : ''}\r\n${value}\r\n`;
  const body =
    part('file', file.content, file.name, file.type) +
    (file.caption !== undefined ? part('caption', file.caption) : '') +
    `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

export function resolvePath(path: string, params: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const found = params[name];
    if (found === undefined) throw new Error(`The path ${path} needs ${name}.`);
    return encodeURIComponent(found);
  });
}

export function createCaller(baseUrl: string, fetchImpl: typeof fetch): Caller {
  return async ({ method, path, query, body, as, rawBody, contentType }) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
    }
    const headers = new Headers();
    if (as) headers.set('Authorization', `Bearer user:${as}`);
    let payload: string | undefined;
    if (rawBody !== undefined) {
      payload = rawBody;
      if (contentType) headers.set('Content-Type', contentType);
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetchImpl(`${baseUrl}${path}${search.size > 0 ? `?${search}` : ''}`, {
      method: method.toUpperCase(),
      headers,
      body: payload,
    });
    const type = response.headers.get('Content-Type') ?? '';
    const text = await response.text();
    const parsed: unknown = type.includes('json') && text !== '' ? JSON.parse(text) : text;
    return { status: response.status, contentType: type, body: parsed };
  };
}

export async function captureExamples(
  call: Caller,
  operations: Operation[] = OPERATIONS,
): Promise<CapturedExample[]> {
  const context: Context = {};
  const captured: CapturedExample[] = [];

  for (const operation of operations) {
    for (const scenario of operation.examples ?? []) {
      const label = `${operation.id} / ${scenario.name}`;
      if (scenario.setup) {
        const setup = SETUPS[scenario.setup];
        if (!setup) throw new Error(`${label}: there is no setup called ${scenario.setup}.`);
        Object.assign(context, await setup(call));
      }
      const params = substitute(scenario.params ?? {}, context);
      const query = substitute(scenario.query, context);
      const body = substitute(scenario.body, context);
      const path = resolvePath(operation.path, params);
      const upload = scenario.file ? multipart(scenario.file) : undefined;
      const as = scenario.as === '' ? undefined : scenario.as;

      const response = await call({
        method: operation.method,
        path,
        query,
        body,
        as,
        rawBody: upload?.body,
        contentType: upload?.contentType,
      });
      const expected = scenario.status ?? operation.success.status;
      if (response.status !== expected) {
        throw new Error(
          `${label}: expected ${expected} and the mock answered ${response.status}: ${JSON.stringify(response.body).slice(0, 400)}`,
        );
      }
      for (const [name, from] of Object.entries(scenario.capture ?? {})) {
        const found = pick(response.body, from);
        if (typeof found !== 'string')
          throw new Error(`${label}: nothing at ${from} to capture as ${name}.`);
        context[name] = found;
      }

      const kind = operation.success.body.kind;
      const isSuccess = response.status < 300;
      captured.push({
        operationId: operation.id,
        name: scenario.name,
        summary: scenario.summary,
        request: {
          method: operation.method,
          path,
          ...(query ? { query } : {}),
          ...(body !== undefined ? { body } : {}),
          ...(as ? { as } : {}),
        },
        response: {
          status: response.status,
          contentType: response.contentType,
          body:
            isSuccess && kind === 'binary'
              ? null
              : kind === 'csv' && isSuccess
                ? String(response.body).split('\r\n').slice(0, 4).join('\r\n')
                : response.body,
        },
      });
    }
  }
  return captured;
}
