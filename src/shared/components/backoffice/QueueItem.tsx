import type { ReactNode, Ref } from 'react';
import { Link } from 'react-router';
import { cn } from '@/shared/utils/cn';

export interface QueueItemProps {
  to: string;
  state?: unknown;
  selected: boolean;
  /** The link's accessible name: enough to tell this item from its neighbours. */
  label: string;
  /** A mark that tells the kind of item at a glance. */
  leading?: ReactNode;
  /** Headline: usually the reference. */
  title: ReactNode;
  /** Short lines of detail, densest first. */
  lines: ReactNode[];
  /** Flags that ask for attention, each carrying its meaning in text. */
  flags?: ReactNode;
  /** The element that takes focus when the item is selected by keyboard. */
  linkRef?: Ref<HTMLAnchorElement>;
  /** Identifies the item to the screen's keyboard handling. */
  itemId: string;
}

/**
 * One item in a work queue. Dense: the headline, a few lines and any flags, with the whole row
 * as the link. The selected item is marked by a bar and a fill and announced as current, so it
 * never relies on colour alone.
 */
export function QueueItem({
  to,
  state,
  selected,
  label,
  leading,
  title,
  lines,
  flags,
  linkRef,
  itemId,
}: QueueItemProps) {
  return (
    <article
      className={cn(
        'relative flex w-full gap-2.5 rounded-md border-l-4 py-2 pr-2.5 pl-2 transition-colors',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-1 has-[a:focus-visible]:outline-primary',
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-transparent bg-surface hover:bg-sunken',
      )}
    >
      {leading && <div className="shrink-0 pt-0.5">{leading}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-sm leading-5 font-semibold">
          <Link
            ref={linkRef}
            to={to}
            state={state}
            aria-label={label}
            aria-current={selected ? 'true' : undefined}
            data-queue-item={itemId}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </Link>
        </h3>
        {lines.map((line, index) => (
          <p key={index} className="text-sm leading-5 [overflow-wrap:anywhere] text-muted">
            {line}
          </p>
        ))}
        {flags && <div className="mt-1 flex flex-wrap gap-1">{flags}</div>}
      </div>
    </article>
  );
}
