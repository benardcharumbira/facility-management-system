import { DateTime } from 'luxon';
import { Link } from 'react-router';

const LINKS = [
  { to: '/terms', label: 'Terms and conditions' },
  { to: '/privacy', label: 'Privacy notice' },
  { to: '/accessibility', label: 'Accessibility' },
  { to: '/help', label: 'Help' },
  { to: '/contact', label: 'Contact' },
] as const;

/**
 * Present on every route, signed in or not. It is not a second navigation: the public pages the
 * service owes everyone, the municipality's name and the year, and nothing else.
 */
export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-line bg-surface print:hidden ${className}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="About this service">
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-ink underline underline-offset-2">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted">© {DateTime.now().year} Midvaal Local Municipality</p>
      </div>
    </footer>
  );
}
