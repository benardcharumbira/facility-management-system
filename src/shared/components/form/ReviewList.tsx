import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export interface ReviewItem {
  key: string;
  label: string;
  value: ReactNode;
  /** Returns to where this answer was given. */
  onEdit?: () => void;
}

/** Every answer as a label, its value and an edit action. A definition list. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  return (
    <dl className="m-0 divide-y divide-line rounded-lg border border-line bg-surface">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
        >
          <dt className="text-sm font-medium text-muted sm:w-48 sm:shrink-0">{item.label}</dt>
          <dd className="m-0 min-w-0 flex-1 [overflow-wrap:anywhere]">{item.value}</dd>
          {item.onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={item.onEdit}
              aria-label={`Edit ${item.label}`}
              className="self-start"
            >
              Edit
            </Button>
          )}
        </div>
      ))}
    </dl>
  );
}
