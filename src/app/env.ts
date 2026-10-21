import { ROLES, type Role } from '@/shared/auth/roles';

export const MOCK_DATASETS = ['real', 'volume'] as const;
export type MockDataset = (typeof MOCK_DATASETS)[number];

const TRUE_FALSE = ['true', 'false'] as const;

/**
 * Read by hand rather than with a schema library: this runs before anything is drawn, so whatever
 * it imports is on the path of the very first screen.
 */
function readEnv(raw: Record<string, unknown>): {
  values: Record<string, string>;
  issues: string[];
} {
  const issues: string[] = [];
  const values: Record<string, string> = {};
  const read = (name: string, check: (value: string) => string | null, fallback?: string): void => {
    const value = raw[name];
    if (value === undefined || value === '') {
      if (fallback === undefined) issues.push(`${name} is required`);
      else values[name] = fallback;
      return;
    }
    const problem = typeof value === 'string' ? check(value) : 'must be text';
    if (problem) issues.push(`${name} ${problem}`);
    else values[name] = String(value);
  };
  const oneOf = (options: readonly string[]) => (value: string) =>
    options.includes(value) ? null : `must be one of: ${options.join(', ')}`;
  const trueFalse = oneOf(TRUE_FALSE);

  read('VITE_API_BASE_URL', (v) =>
    URL.canParse(v) ? null : 'must be an absolute URL, e.g. http://localhost:5000/api',
  );
  read('VITE_CLERK_PUBLISHABLE_KEY', (v) =>
    v.startsWith('pk_') ? null : 'must be a Clerk publishable key starting with "pk_"',
  );
  read(
    'VITE_ENABLE_API_MOCKING',
    (v) => (trueFalse(v) ? 'must be "true" or "false"' : null),
    'false',
  );
  read('VITE_MOCK_ROLE', oneOf(Object.values(ROLES)), ROLES.applicant);
  read(
    'VITE_MOCK_DATASET',
    (v) => (oneOf(MOCK_DATASETS)(v) ? 'must be "real" or "volume"' : null),
    'real',
  );
  read(
    'VITE_SHOW_SAMPLE_DATA_BANNER',
    (v) => (trueFalse(v) ? 'must be "true" or "false"' : null),
    'true',
  );
  return { values, issues };
}

export interface Env {
  apiBaseUrl: string;
  clerkPublishableKey: string;
  enableApiMocking: boolean;
  /** Role returned by the mocked GET /me. Ignored when mocking is off. */
  mockRole: Role;
  /** Which fixture the mocked facilities endpoints serve. Ignored when mocking is off. */
  mockDataset: MockDataset;
  /**
   * Whether to show the sample data banner. Development builds only: production builds never
   * show it, whatever this says.
   */
  showSampleDataBanner: boolean;
}

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}\n` +
        'Copy .env.example to .env and fill in the values.',
    );
    this.name = 'EnvError';
  }
}

export function parseEnv(raw: Record<string, unknown>): Env {
  const { values, issues } = readEnv(raw);
  if (issues.length > 0) throw new EnvError(issues);
  return {
    apiBaseUrl: values.VITE_API_BASE_URL as string,
    clerkPublishableKey: values.VITE_CLERK_PUBLISHABLE_KEY as string,
    enableApiMocking: values.VITE_ENABLE_API_MOCKING === 'true',
    mockRole: values.VITE_MOCK_ROLE as Role,
    mockDataset: values.VITE_MOCK_DATASET as MockDataset,
    showSampleDataBanner: values.VITE_SHOW_SAMPLE_DATA_BANNER === 'true',
  };
}

let cached: Env | undefined;

/** Tests only: forget the parsed environment so changed variables are re-read. */
export function resetEnvCache() {
  cached = undefined;
}

/** Parsed once on first use. main.tsx calls it before rendering so a bad config fails fast. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env);
  return cached;
}
