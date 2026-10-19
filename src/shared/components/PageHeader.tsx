import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Short supporting text under the description, such as a result count. */
  meta?: ReactNode;
  /** Page level actions, aligned to the end on wide screens. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1 text-base text-muted">{description}</p>}
        {meta && <p className="mt-1 text-sm text-subtle">{meta}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
