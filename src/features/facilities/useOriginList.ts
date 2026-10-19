import { useLocation } from 'react-router';

/**
 * The browse screen's query string, carried in router state by the links that lead to a detail
 * page (and onward between related details), so "back" returns to the exact result set rather
 * than a reconstruction of it. Empty when the page was opened directly.
 */
export function useOriginList(): string {
  const state: unknown = useLocation().state;
  if (typeof state === 'object' && state !== null && 'fromList' in state) {
    const { fromList } = state;
    if (typeof fromList === 'string') return fromList;
  }
  return '';
}
