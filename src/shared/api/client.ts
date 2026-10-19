import { ApiProblem } from './problem';

export type QueryScalar = string | number | boolean | null | undefined;
/** Arrays are sent as repeated parameters (`a=1&a=2`). */
export type QueryValue = QueryScalar | readonly QueryScalar[];

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
  /**
   * Multipart upload with progress. Uses XMLHttpRequest, because fetch cannot report upload
   * progress, but still goes through this client: same base URL, token and problem handling.
   */
  upload<T>(path: string, body: FormData, options?: UploadOptions): Promise<T>;
}

export interface UploadOptions {
  /** Called with a fraction from 0 to 1 as the body is sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
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

  async function upload<T>(path: string, body: FormData, options: UploadOptions = {}): Promise<T> {
    try {
      const token = await getToken();
      return await new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', buildUrl(root, path));
        xhr.setRequestHeader('Accept', 'application/json');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
        };
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
        xhr.onload = () => {
          const response = new Response(xhr.status === 204 ? null : xhr.responseText, {
            status: xhr.status,
            headers: {
              'Content-Type': xhr.getResponseHeader('Content-Type') ?? 'application/json',
            },
          });
          if (xhr.status >= 200 && xhr.status < 300) {
            options.onProgress?.(1);
            response.json().then(
              (value) => resolve(value as T),
              (cause) =>
                reject(
                  new ApiProblem({
                    kind: 'unexpected',
                    status: xhr.status,
                    title: 'The server returned an invalid response',
                    cause,
                  }),
                ),
            );
          } else {
            ApiProblem.fromResponse(response).then(reject, reject);
          }
        };
        options.signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(body);
      });
    } catch (error) {
      throw ApiProblem.from(error);
    }
  }

  return {
    upload,
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
    const values = Array.isArray(value) ? value : [value];
    for (const item of values as QueryScalar[]) {
      if (item !== undefined && item !== null) params.append(key, String(item));
    }
  }
  const search = params.toString();
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${root}${normalisedPath}${search ? `?${search}` : ''}`;
}
