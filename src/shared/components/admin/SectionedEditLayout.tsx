import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/shared/utils/cn';

export interface EditSection {
  id: string;
  label: string;
  /** A short mark beside the label, e.g. a count or a warning. Carry its meaning in text. */
  flag?: ReactNode;
}

export interface SectionedEditLayoutProps {
  sections: EditSection[];
  current: string;
  /** Sections are addressable, so one can be linked and survives a reload. */
  hrefFor: (sectionId: string) => string;
  /** Accessible name of the section list. */
  label?: string;
  children: ReactNode;
}

/**
 * An edit screen divided into sections, one shown at a time and named in the URL. A list of
 * links to the left from tablet width, a scrolling row above on a phone. Each section saves on
 * its own, so a change is small enough to be understood before it is made.
 */
export function SectionedEditLayout({
  sections,
  current,
  hrefFor,
  label = 'Sections',
  children,
}: SectionedEditLayoutProps) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label={label} className="md:sticky md:top-20">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 md:flex-col md:overflow-visible">
          {sections.map((section) => {
            const selected = section.id === current;
            return (
              <li key={section.id} className="shrink-0">
                <Link
                  to={hrefFor(section.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                    selected
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-sunken hover:text-ink',
                  )}
                >
                  {section.label}
                  {section.flag}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
