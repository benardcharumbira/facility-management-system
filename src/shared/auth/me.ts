import type { ApiClient } from '@/shared/api';
import { ApiProblem, createQueryKeys } from '@/shared/api';
import { isRole, type Role } from './roles';

/** Shape of GET /me. Roles are owned by the backend, never by Clerk. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export const meKeys = createQueryKeys('me');

/** Checked by hand rather than with a schema library, which the first screen would then have to download. */
function parseMe(value: unknown): Me {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.email !== 'string' ||
    typeof v.displayName !== 'string' ||
    !isRole(v.role)
  ) {
    throw new ApiProblem({
      kind: 'unexpected',
      status: 200,
      title: 'The server returned an invalid response',
    });
  }
  return { id: v.id, email: v.email, displayName: v.displayName, role: v.role };
}

export async function fetchMe(api: ApiClient, signal?: AbortSignal): Promise<Me> {
  return parseMe(await api.get<unknown>('/me', { signal }));
}
