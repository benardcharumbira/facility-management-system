import { useId, type ReactNode } from 'react';

export interface KeyFact {
  label: string;
  value: ReactNode;
}

export interface KeyFactsProps {
  title?: string;
  items: KeyFact[];
}

/** A scannable definition list: the block read before deciding whether to read on. */
export function KeyFacts({ title = 'Key facts', items }: KeyFactsProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-lg border border-line bg-surface p-5">
      <h2 id={id} className="mb-4 text-base font-semibold">
        {title}
      </h2>
      <dl className="m-0 flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-medium tracking-wide text-subtle uppercase">
              {item.label}
            </dt>
            <dd className="m-0 mt-0.5 [overflow-wrap:anywhere]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
