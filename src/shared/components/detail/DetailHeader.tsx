import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Crumb } from '../page-header/PageHeaderContext';
import { Breadcrumbs } from './Breadcrumbs';

export interface DetailHeaderProps {
  breadcrumbs: Crumb[];
  /** Returns to where the user came from, e.g. the browse screen with its query string. */
  back?: { label: string; to: string; state?: unknown };
  title: string;
  /** Under the title, e.g. type and locality. */
  subtitle?: ReactNode;
  /** A status indicator shown beside the title. Must carry its meaning in text. */
  status?: ReactNode;
  /** Free content under the subtitle, e.g. a statement of how this item relates to others. */
  children?: ReactNode;
}

/** The page's one `h1`, with breadcrumb and back action above it. */
export function DetailHeader({
  breadcrumbs,
  back,
  title,
  subtitle,
  status,
  children,
}: DetailHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Breadcrumbs items={breadcrumbs} />
        {back && (
          <Link
            to={back.to}
            state={back.state}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h1>
        {status}
      </div>
      {subtitle && <p className="text-base text-muted">{subtitle}</p>}
      {children}
    </header>
  );
}
