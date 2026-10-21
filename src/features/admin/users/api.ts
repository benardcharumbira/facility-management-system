import {
  createQueryKeys,
  type AdminUser,
  type AdminUserList,
  type AdminUserListParams,
  type ApiClient,
  type ChangeRoleRequest,
  type ProposedUserChange,
  type UserImpactResult,
} from '@/shared/api';

export const adminUserKeys = createQueryKeys('admin-users');

const base = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export const fetchUsers = (api: ApiClient, params: AdminUserListParams, signal?: AbortSignal) =>
  api.get<AdminUserList>('/admin/users', { query: { ...params }, signal });

export const fetchUser = (api: ApiClient, id: string, signal?: AbortSignal) =>
  api.get<AdminUser>(base(id), { signal });

/** What a change to a person would strand. Decides nothing. */
export const checkUserImpact = (api: ApiClient, id: string, change: ProposedUserChange) =>
  api.post<UserImpactResult>(`${base(id)}/roles/impact`, { body: change });

export const changeRole = (api: ApiClient, id: string, body: ChangeRoleRequest) =>
  api.put<AdminUser>(`${base(id)}/roles`, { body });

export const saveDesignations = (api: ApiClient, id: string, facilityIds: string[]) =>
  api.put<AdminUser>(`${base(id)}/facilities`, { body: { facilityIds } });

export const deactivateUser = (api: ApiClient, id: string) =>
  api.post<AdminUser>(`${base(id)}/deactivate`);

export const reactivateUser = (api: ApiClient, id: string) =>
  api.post<AdminUser>(`${base(id)}/reactivate`);
