import type {
  ApiClient,
  CreateReferenceRequest,
  CreateTermsRequest,
  ReferenceEntry,
  ReferenceImpactResult,
  ReferenceList,
  TermsVersion,
  UpdateReferenceRequest,
  UpdateTermsRequest,
} from '@/shared/api';

export const adminReferenceKeys = {
  all: ['admin-reference'] as const,
  vocabulary: (path: Vocabulary) => ['admin-reference', 'vocabulary', path] as const,
  terms: () => ['admin-reference', 'terms'] as const,
};

/** The two vocabularies, named as their endpoints are. */
export type Vocabulary = 'seating-arrangements' | 'event-types';

const base = (path: Vocabulary, id?: string) =>
  `/admin/${path}${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;

export const fetchVocabulary = (api: ApiClient, path: Vocabulary, signal?: AbortSignal) =>
  api.get<ReferenceList>(base(path), { signal });

export const createEntry = (api: ApiClient, path: Vocabulary, body: CreateReferenceRequest) =>
  api.post<ReferenceEntry>(base(path), { body });

export const updateEntry = (
  api: ApiClient,
  path: Vocabulary,
  id: string,
  body: UpdateReferenceRequest,
) => api.patch<ReferenceEntry>(base(path, id), { body });

/** What archiving a seating arrangement would reach. Decides nothing. */
export const checkSeatingImpact = (api: ApiClient, id: string) =>
  api.post<ReferenceImpactResult>(`${base('seating-arrangements', id)}/impact`);

export const archiveEntry = (api: ApiClient, path: Vocabulary, id: string) =>
  api.post<ReferenceEntry>(`${base(path, id)}/archive`);

export const restoreEntry = (api: ApiClient, path: Vocabulary, id: string) =>
  api.post<ReferenceEntry>(`${base(path, id)}/restore`);

export const fetchTerms = (api: ApiClient, signal?: AbortSignal) =>
  api.get<TermsVersion[]>('/admin/terms', { signal });

export const createTerms = (api: ApiClient, body: CreateTermsRequest) =>
  api.post<TermsVersion>('/admin/terms', { body });

export const updateTerms = (api: ApiClient, id: string, body: UpdateTermsRequest) =>
  api.patch<TermsVersion>(`/admin/terms/${encodeURIComponent(id)}`, { body });

export const publishTerms = (api: ApiClient, id: string) =>
  api.post<TermsVersion>(`/admin/terms/${encodeURIComponent(id)}/publish`);
