import { useId, type ReactNode } from 'react';

export interface LegendItem {
  key: string;
  label: string;
  /** What it means, in a phrase. */
  description?: string;
  swatch: ReactNode;
}

/** Names every status in words, beside its pattern. */
export function Legend({ title = 'Legend', items }: { title?: string; items: LegendItem[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 text-sm font-semibold">
        {title}
      </h3>
      <ul className="m-0 grid list-none gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2">
            <span className="mt-0.5">{item.swatch}</span>
            <span>
              <span className="font-medium">{item.label}</span>
              {item.description && <span className="text-muted">{`: ${item.description}`}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
