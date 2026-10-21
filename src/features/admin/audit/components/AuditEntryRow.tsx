import type { AuditEntry as AuditEntryData } from '@/shared/api';
import { Badge, Disclosure } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';
import { ACTION_LABELS, ENTITY_LABELS } from '../labels';
import { BeforeAfter } from './BeforeAfter';

const ZONE = 'Africa/Johannesburg';

/**
 * One thing that happened: when, who, what, and to which record. It expands to show the state
 * before and after, which is the evidence the trail exists to keep.
 */
export function AuditEntry({ entry }: { entry: AuditEntryData }) {
  return (
    <Disclosure
      summary={
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <time dateTime={entry.occurredAt} className="text-sm font-normal text-muted">
              {dateAndTime(entry.occurredAt, ZONE)}
            </time>
            <Badge>{ACTION_LABELS[entry.action]}</Badge>
            <span className="text-sm font-semibold">{entry.entityLabel}</span>
          </span>
          <span className="block font-normal">{entry.summary}</span>
          <span className="block text-sm font-normal text-muted">
            {entry.actor ? `By ${entry.actor.name}` : 'By the system'}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <dl className="m-0 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Record</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">
              {ENTITY_LABELS[entry.entityType]} · {entry.entityId}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Done by</dt>
            <dd className="m-0 [overflow-wrap:anywhere]">
              {entry.actor ? `${entry.actor.name} · ${entry.actor.id}` : 'The system'}
            </dd>
          </div>
        </dl>
        <BeforeAfter before={entry.before} after={entry.after} />
      </div>
    </Disclosure>
  );
}
