import type { ReactNode } from 'react';
import { usePageHeader, type Crumb } from './page-header/PageHeaderContext';

interface PageLayoutProps {
  title: string;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
}

/** Every routed page renders inside this. It publishes the title and breadcrumbs to the shell. */
export function PageLayout({ title, breadcrumbs, children }: PageLayoutProps) {
  usePageHeader(title, breadcrumbs);
  return <>{children}</>;
}
