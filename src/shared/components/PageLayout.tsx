import type { ReactNode } from 'react';
import { PageHeader, type PageHeaderProps } from './PageHeader';
import { usePageHeader, type Crumb } from './page-header/PageHeaderContext';

interface PageLayoutProps extends PageHeaderProps {
  breadcrumbs?: Crumb[];
  children?: ReactNode;
}

/**
 * Every routed page renders inside this: it renders the page header and publishes the
 * breadcrumbs and document title to the shell.
 */
export function PageLayout({ breadcrumbs, children, ...header }: PageLayoutProps) {
  usePageHeader(header.title, breadcrumbs);
  return (
    <>
      <PageHeader {...header} />
      {children}
    </>
  );
}
