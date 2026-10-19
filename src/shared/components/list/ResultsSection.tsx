import { useId, type ReactNode } from 'react';

export interface ResultsSectionProps {
  title: string;
  /** How many results are in this section on this page. */
  count?: number;
  children: ReactNode;
}

/** A titled group within one list of results, e.g. "Upcoming" and "Past". */
export function ResultsSection({ title, count, children }: ResultsSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-sm font-normal text-muted">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
