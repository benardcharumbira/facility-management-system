import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { usePageHeaderValue } from './PageHeaderContext';

/** The shell's breadcrumb region. Routes populate it through PageLayout. */
export function ShellBreadcrumbs() {
  const { breadcrumbs } = usePageHeaderValue();
  if (breadcrumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {breadcrumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />}
            {crumb.to ? (
              <Link to={crumb.to} className="rounded-sm hover:text-primary hover:underline">
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
