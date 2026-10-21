import { Link } from 'react-router';
import { cn } from '@/shared/utils/cn';

const TABS = [
  {
    id: 'catalogue',
    to: '/admin/resources',
    label: 'Catalogue',
    meaning: 'What kinds of resource exist, defined once',
  },
  {
    id: 'allocation',
    to: '/admin/resources/allocation',
    label: 'Allocation',
    meaning: 'How many of each every facility holds',
  },
] as const;

/**
 * The two views of resources, kept visibly apart because they are routinely confused. The
 * catalogue is the vocabulary, used everywhere; an allocation is what one venue can offer.
 */
export function ResourceAreaTabs({ current }: { current: 'catalogue' | 'allocation' }) {
  return (
    <nav aria-label="Resources" className="mb-5">
      <ul className="m-0 flex list-none gap-2 border-b border-line p-0">
        {TABS.map((tab) => {
          const selected = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                to={tab.to}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  '-mb-px flex flex-col border-b-2 px-4 py-2',
                  selected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-ink',
                )}
              >
                <span className="font-semibold">{tab.label}</span>
                <span className="text-sm font-normal text-muted">{tab.meaning}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
