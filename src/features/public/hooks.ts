import { useQuery } from '@tanstack/react-query';
import { isApiProblem, useApiClient, type ContentSlug } from '@/shared/api';
import { fetchContent, fetchFeatured, fetchPublishedTerms, publicKeys } from './api';

const FIVE_MINUTES = 5 * 60_000;

export function useFeatured() {
  const api = useApiClient();
  return useQuery({
    queryKey: publicKeys.featured(),
    queryFn: ({ signal }) => fetchFeatured(api, signal),
    staleTime: FIVE_MINUTES,
  });
}

export function usePublishedTerms() {
  const api = useApiClient();
  return useQuery({
    queryKey: publicKeys.terms(),
    queryFn: ({ signal }) => fetchPublishedTerms(api, signal),
    // Someone may have just published new terms; a stale copy is the wrong words.
    staleTime: 0,
    // No published version is an answer, not a fault to retry.
    retry: (count, error) => !(isApiProblem(error) && error.status === 404) && count < 2,
  });
}

export function useContentPage(slug: ContentSlug) {
  const api = useApiClient();
  return useQuery({
    queryKey: publicKeys.content(slug),
    queryFn: ({ signal }) => fetchContent(api, slug, signal),
    staleTime: FIVE_MINUTES,
  });
}
