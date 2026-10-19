import { z } from 'zod';
import { ROLES, type Role } from '@/shared/auth/roles';

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
});

export interface Env {
  apiBaseUrl: string;
  clerkPublishableKey: string;
  enableApiMocking: boolean;
  /** Role returned by the mocked GET /me. Ignored when mocking is off. */
  mockRole: Role;
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
  };
}

let cached: Env | undefined;

/** Parsed once on first use. main.tsx calls it before rendering so a bad config fails fast. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env);
  return cached;
}
