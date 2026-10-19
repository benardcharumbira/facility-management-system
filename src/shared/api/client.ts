import { ApiProblem } from './problem';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

type BodylessMethod = 'GET' | 'DELETE';
type Method = BodylessMethod | 'POST' | 'PUT' | 'PATCH';

export interface ApiClientConfig {
  baseUrl: string;
  /** Resolves the current session token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

/**
 * The only HTTP entry point in the app. Call sites pass the response type as a generic;
 * once the OpenAPI contract exists, replace those with generated types from the endpoint
 * functions that wrap this client. Call sites above them do not change.
 */
export interface ApiClient {
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, options?: RequestOptions): Promise<T>;
  put<T>(path: string, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, options?: RequestOptions): Promise<T>;
}

export function createApiClient({
  baseUrl,
  getToken,
  fetch: fetchImpl,
}: ApiClientConfig): ApiClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(
    method: Method,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const doFetch = fetchImpl ?? fetch;
    try {
      const headers = new Headers(options.headers);
      headers.set('Accept', 'application/json');
      if (options.body !== undefined) headers.set('Content-Type', 'application/json');
      const token = await getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await doFetch(buildUrl(root, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });

      if (!response.ok) throw await ApiProblem.fromResponse(response);
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch (cause) {
        throw new ApiProblem({
          kind: 'unexpected',
          status: response.status,
          title: 'The server returned an invalid response',
          cause,
        });
      }
    } catch (error) {
      throw ApiProblem.from(error);
    }
  }

  return {
    get: (path, options) => request('GET', path, options),
    delete: (path, options) => request('DELETE', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
  };
}

function buildUrl(root: string, path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${root}${normalisedPath}${search ? `?${search}` : ''}`;
}
