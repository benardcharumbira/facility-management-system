import { z } from 'zod';
import type { ApiClient } from '@/shared/api';
import { createQueryKeys } from '@/shared/api';
import { ROLES, type Role } from './roles';

const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(Object.values(ROLES) as [Role, ...Role[]]),
});

/** Shape of GET /me. Roles are owned by the backend, never by Clerk. */
export type Me = z.infer<typeof meSchema>;

export const meKeys = createQueryKeys('me');

export async function fetchMe(api: ApiClient, signal?: AbortSignal): Promise<Me> {
  return meSchema.parse(await api.get<unknown>('/me', { signal }));
}
