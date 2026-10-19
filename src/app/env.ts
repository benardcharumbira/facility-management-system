import { z } from 'zod';
import { ROLES, type Role } from '@/shared/auth/roles';

export const MOCK_DATASETS = ['real', 'volume'] as const;
export type MockDataset = (typeof MOCK_DATASETS)[number];

const roleValues = Object.values(ROLES) as [Role, ...Role[]];

const envSchema = z.object({
  VITE_API_BASE_URL: z.url({ error: 'must be an absolute URL, e.g. http://localhost:5000/api' }),
  VITE_CLERK_PUBLISHABLE_KEY: z
    .string({ error: 'is required' })
    .startsWith('pk_', { error: 'must be a Clerk publishable key starting with "pk_"' }),
  VITE_ENABLE_API_MOCKING: z
    .enum(['true', 'false'], { error: 'must be "true" or "false"' })
    .default('false'),
  VITE_MOCK_ROLE: z.enum(roleValues).default(ROLES.applicant),
  VITE_MOCK_DATASET: z.enum(MOCK_DATASETS, { error: 'must be "real" or "volume"' }).default('real'),
  VITE_SHOW_SAMPLE_DATA_BANNER: z
    .enum(['true', 'false'], { error: 'must be "true" or "false"' })
    .default('true'),
});

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
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`));
  }
  const data = result.data;
  return {
    apiBaseUrl: data.VITE_API_BASE_URL,
    clerkPublishableKey: data.VITE_CLERK_PUBLISHABLE_KEY,
    enableApiMocking: data.VITE_ENABLE_API_MOCKING === 'true',
    mockRole: data.VITE_MOCK_ROLE,
    mockDataset: data.VITE_MOCK_DATASET,
    showSampleDataBanner: data.VITE_SHOW_SAMPLE_DATA_BANNER === 'true',
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
