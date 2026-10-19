import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FilterSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Number of values selected in this group, shown beside the title. */
  activeCount?: number;
}

/** A collapsible group of related filter controls, built on the native disclosure element. */
export function FilterSection({
  title,
  children,
  defaultExpanded = true,
  activeCount = 0,
}: FilterSectionProps) {
  return (
    <details open={defaultExpanded} className="group border-b border-line py-1 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold">
          {title}
          {activeCount > 0 && (
            <span className="ml-1 font-normal text-primary">({activeCount})</span>
          )}
        </h3>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-1 pb-3">{children}</div>
    </details>
  );
}
