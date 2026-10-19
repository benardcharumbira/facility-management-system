import type { ReactNode } from 'react';

export interface DetailLayoutProps {
  /** Key facts and the primary action. First in the source order, so it follows the header on small screens and is a sticky sidebar from `lg`. */
  aside: ReactNode;
  /** Description, resources, relationships and everything else. */
  children: ReactNode;
}

/** The two column frame shared by the loaded page and its skeleton, so they cannot drift apart. */
export function DetailLayout({ aside, children }: DetailLayoutProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">{aside}</div>
      <div className="flex min-w-0 flex-col gap-8 lg:order-1">{children}</div>
    </div>
  );
}
