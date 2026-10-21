import type { ApiClient, MyProfile, UpdateMyProfileRequest } from '@/shared/api';

export const profileKeys = { me: () => ['my-profile'] as const };

export const fetchProfile = (api: ApiClient, signal?: AbortSignal) =>
  api.get<MyProfile>('/me/profile', { signal });

export const saveProfile = (api: ApiClient, body: UpdateMyProfileRequest) =>
  api.patch<MyProfile>('/me/profile', { body });
