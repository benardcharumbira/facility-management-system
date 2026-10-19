import type { ReactNode } from 'react';

export interface ActivityEntry {
  key: string;
  /** What happened, in words. */
  title: string;
  /** When, already formatted. */
  when: string;
  /** The machine readable instant, for the `time` element. */
  dateTime?: string;
  /** Who did it, where known. */
  actor?: string;
  detail?: ReactNode;
  icon?: ReactNode;
}

/**
 * What has happened, oldest first, each with its time and actor. A plain ordered list: a history
 * has times, not durations, so it does not share the calendar's `Timeline`.
 */
export function ActivityLog({ entries, label }: { entries: ActivityEntry[]; label: string }) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col p-0">
      {entries.map((entry, index) => (
        <li key={entry.key} className="relative flex gap-3 pb-5 last:pb-0">
          {index < entries.length - 1 && (
            <span aria-hidden className="absolute top-6 bottom-0 left-3 w-px bg-line-strong" />
          )}
          <span
            aria-hidden
            className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-muted"
          >
            {entry.icon}
          </span>
          <div className="min-w-0">
            <p className="font-medium">
              {entry.title}
              {entry.actor && (
                <span className="font-normal text-muted">{` by ${entry.actor}`}</span>
              )}
            </p>
            <time dateTime={entry.dateTime} className="text-sm text-muted">
              {entry.when}
            </time>
            {entry.detail && (
              <div className="mt-1 [overflow-wrap:anywhere] text-muted">{entry.detail}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
