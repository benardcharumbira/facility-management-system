export type ApiProblemKind = 'problem' | 'network' | 'aborted' | 'unexpected';

export interface ApiProblemInit {
  kind: ApiProblemKind;
  status: number;
  title: string;
  type?: string;
  detail?: string;
  instance?: string;
  /** Validation errors keyed by field name (ASP.NET Core ValidationProblemDetails). */
  errors?: Record<string, string[]>;
  /** Any further RFC 7807 extension members. */
  extensions?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * The single error type produced by the API layer. RFC 7807 problem details, network
 * failures and unexpected responses are all normalised into this shape.
 */
export class ApiProblem extends Error {
  readonly kind: ApiProblemKind;
  /** HTTP status, or 0 when no response was received. */
  readonly status: number;
  readonly title: string;
  readonly type: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly errors: Record<string, string[]>;
  readonly extensions: Record<string, unknown>;

  constructor(init: ApiProblemInit) {
    super(init.detail ?? init.title, { cause: init.cause });
    this.name = 'ApiProblem';
    this.kind = init.kind;
    this.status = init.status;
    this.title = init.title;
    this.type = init.type ?? 'about:blank';
    this.detail = init.detail;
    this.instance = init.instance;
    this.errors = init.errors ?? {};
    this.extensions = init.extensions ?? {};
  }

  /** Normalise anything thrown while making a request into an ApiProblem. */
  static from(error: unknown): ApiProblem {
    if (error instanceof ApiProblem) return error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new ApiProblem({
        kind: 'aborted',
        status: 0,
        title: 'Request cancelled',
        cause: error,
      });
    }
    if (error instanceof TypeError) {
      return new ApiProblem({
        kind: 'network',
        status: 0,
        title: 'Network error',
        detail: 'The server could not be reached. Check your connection and try again.',
        cause: error,
      });
    }
    return new ApiProblem({
      kind: 'unexpected',
      status: 0,
      title: 'Unexpected error',
      detail: error instanceof Error ? error.message : undefined,
      cause: error,
    });
  }

  /** Build an ApiProblem from a non-2xx response, parsing problem details when present. */
  static async fromResponse(response: Response): Promise<ApiProblem> {
    const fallbackTitle = response.statusText || `Request failed (${response.status})`;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return new ApiProblem({ kind: 'unexpected', status: response.status, title: fallbackTitle });
    }
    if (!isRecord(body)) {
      return new ApiProblem({ kind: 'unexpected', status: response.status, title: fallbackTitle });
    }

    const { type, title, status, detail, instance, errors, ...extensions } = body;
    return new ApiProblem({
      kind: 'problem',
      status: typeof status === 'number' ? status : response.status,
      title: typeof title === 'string' ? title : fallbackTitle,
      type: typeof type === 'string' ? type : undefined,
      detail: typeof detail === 'string' ? detail : undefined,
      instance: typeof instance === 'string' ? instance : undefined,
      errors: parseFieldErrors(errors),
      extensions,
    });
  }
}

export function isApiProblem(error: unknown): error is ApiProblem {
  return error instanceof ApiProblem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFieldErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      result[field] = messages.filter((m): m is string => typeof m === 'string');
    }
  }
  return result;
}
