import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Crumb } from '../page-header/PageHeaderContext';

export interface BreadcrumbsProps {
  /** The last item is the current page: give it no `to`. */
  items: Crumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />}
            {crumb.to ? (
              <Link
                to={crumb.to}
                state={crumb.state}
                className="rounded-sm hover:text-primary hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
