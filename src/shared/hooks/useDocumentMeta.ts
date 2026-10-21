import { useEffect } from 'react';
import { setDocumentMeta } from '../utils/documentMeta';

/** Gives the route its document title and, for the public pages, a meta description. */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    setDocumentMeta(title, description);
  }, [title, description]);
}
