import {
  createQueryKeys,
  type ApiClient,
  type ContentPageData,
  type ContentSlug,
  type FeaturedFacility,
  type PublishedTerms,
} from '@/shared/api';

export const publicKeys = {
  ...createQueryKeys('public'),
  featured: () => ['public', 'featured'] as const,
  terms: () => ['public', 'terms'] as const,
  content: (slug: ContentSlug) => ['public', 'content', slug] as const,
};

export const fetchFeatured = (api: ApiClient, signal?: AbortSignal) =>
  api.get<FeaturedFacility[]>('/public/facilities/featured', { signal });

export const fetchPublishedTerms = (api: ApiClient, signal?: AbortSignal) =>
  api.get<PublishedTerms>('/public/terms', { signal });

export const fetchContent = (api: ApiClient, slug: ContentSlug, signal?: AbortSignal) =>
  api.get<ContentPageData>(`/public/content/${slug}`, { signal });
