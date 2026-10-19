import { Breadcrumbs } from '../detail/Breadcrumbs';
import { usePageHeaderValue } from './PageHeaderContext';

/** The shell's breadcrumb region. Routes populate it through PageLayout. */
export function ShellBreadcrumbs() {
  const { breadcrumbs } = usePageHeaderValue();
  if (breadcrumbs.length === 0) return null;
  return (
    <div className="mb-3">
      <Breadcrumbs items={breadcrumbs} />
    </div>
  );
}
