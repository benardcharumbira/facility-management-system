import { Link, useLocation } from 'react-router';
import type { Role } from '@/shared/auth';
import { cn } from '@/shared/utils/cn';
import { navItemsForRole } from './navigation';

interface NavListProps {
  role: Role;
  onNavigate?: () => void;
}

export function NavList({ role, onNavigate }: NavListProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Main navigation" className="p-3">
      <ul className="flex flex-col gap-1">
        {navItemsForRole(role).map((item) => {
          const selected = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={selected ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
                  selected
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {item.icon}
                {item.label}
                {item.badge}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
