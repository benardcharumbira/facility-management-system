import { useId, type ReactNode } from 'react';

export interface SectionProps {
  title: string;
  /** One sentence of context under the heading. */
  description?: ReactNode;
  children?: ReactNode;
}

/** A titled region of a detail page, labelled by its `h2`. */
export function Section({ title, description, children }: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 max-w-prose text-muted">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
