import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Crumb {
  label: string;
  /** Omit for the current page. */
  to?: string;
}

export interface PageHeaderValue {
  title: string;
  breadcrumbs: Crumb[];
}

interface PageHeaderContextValue {
  header: PageHeaderValue;
  setHeader: (value: PageHeaderValue) => void;
}

const EMPTY: PageHeaderValue = { title: '', breadcrumbs: [] };

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

/** Holds the title and breadcrumbs that routes publish and the shell renders. */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderValue>(EMPTY);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext value={value}>{children}</PageHeaderContext>;
}

export function usePageHeaderValue(): PageHeaderValue {
  return use(PageHeaderContext)?.header ?? EMPTY;
}

/** Publish this page's title and breadcrumbs to the shell. Cleared on unmount. */
export function usePageHeader(title: string, breadcrumbs: Crumb[] = []) {
  const setHeader = use(PageHeaderContext)?.setHeader;
  // Breadcrumbs are small and usually literals; key on content so callers need not memoise.
  const crumbsKey = JSON.stringify(breadcrumbs);

  useEffect(() => {
    setHeader?.({ title, breadcrumbs: JSON.parse(crumbsKey) as Crumb[] });
    document.title = title ? `${title} · Facilities Booking` : 'Facilities Booking';
    return () => setHeader?.(EMPTY);
  }, [setHeader, title, crumbsKey]);
}
