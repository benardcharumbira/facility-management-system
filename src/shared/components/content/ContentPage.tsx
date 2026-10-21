import type { ReactNode } from 'react';

export interface ContentPageProps {
  title: string;
  /** Under the title: a version, a date. */
  meta?: ReactNode;
  /** A status notice, placed above the words. */
  notice?: ReactNode;
  /** Controls that are left off the printed page. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The layout of a page that is mostly words: a title, readable measure, headed sections. Prints as
 * a clean document with the municipality's name above it and the surrounding chrome left out.
 */
export function ContentPage({ title, meta, notice, actions, children }: ContentPageProps) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <p className="hidden text-sm font-semibold print:block">
        Midvaal Local Municipality · Facilities Booking
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {meta && <p className="text-muted">{meta}</p>}
        {actions && <div className="mt-1 print:hidden">{actions}</div>}
      </header>
      {notice && <div className="mt-5">{notice}</div>}
      <div className="mt-6 flex flex-col gap-7">{children}</div>
    </article>
  );
}

/** A headed section of a content page. */
export function ContentSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="break-inside-avoid">
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {heading}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}
