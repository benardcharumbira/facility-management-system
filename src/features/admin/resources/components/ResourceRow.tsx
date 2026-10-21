import { Archive, Hash, ToggleRight } from 'lucide-react';
import { Link } from 'react-router';
import type { AdminResourceRow } from '@/shared/api';
import { Badge } from '@/shared/components';

/** One entry in the catalogue: its name, how it is recorded, how many facilities hold it, and its state. */
export function ResourceRow({ row }: { row: AdminResourceRow }) {
  return (
    <article
      className={`flex w-full flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 sm:flex-row sm:items-start sm:justify-between ${
        row.status === 'archived' ? 'opacity-80' : ''
      }`}
    >
      <div className="min-w-0">
        <h3 className="text-sm leading-5 font-semibold">
          <Link
            to={`/admin/resources/${encodeURIComponent(row.id)}`}
            className="text-primary underline underline-offset-2"
          >
            {row.name}
          </Link>
        </h3>
        {row.description && <p className="text-sm text-muted">{row.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <Badge className="gap-1">
          {row.quantified ? (
            <Hash aria-hidden className="size-3" />
          ) : (
            <ToggleRight aria-hidden className="size-3" />
          )}
          {row.quantified ? 'Counted' : 'Available or not'}
        </Badge>
        <Badge>
          {row.facilitiesHolding === 1
            ? 'Held by 1 facility'
            : `Held by ${row.facilitiesHolding} facilities`}
        </Badge>
        {row.status === 'archived' && (
          <Badge tone="warning" className="gap-1">
            <Archive aria-hidden className="size-3" />
            Archived
          </Badge>
        )}
      </div>
    </article>
  );
}
