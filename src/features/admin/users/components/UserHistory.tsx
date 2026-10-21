import { History } from 'lucide-react';
import { ActivityLog, EmptyState, ErrorState, Section, Skeleton } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';
import { useAudit } from '../../audit/hooks';

const ZONE = 'Africa/Johannesburg';

/** The changes made to this person's access, from the audit trail: who, what and when. */
export function UserHistory({ userId }: { userId: string }) {
  const history = useAudit({ entityType: ['user'], entityId: userId, pageSize: 10 });
  return (
    <Section
      title="History"
      description="Changes to this person’s role, facilities and account, newest first."
    >
      <div className="max-w-2xl">
        {history.isError ? (
          <ErrorState
            title="We could not load the history"
            problem={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : !history.data ? (
          <Skeleton className="h-16" />
        ) : history.data.items.length === 0 ? (
          <EmptyState
            title="No changes recorded"
            description="Nothing has been changed on this account since it was created."
          />
        ) : (
          <ActivityLog
            label="History of changes"
            entries={history.data.items.map((entry) => ({
              key: entry.id,
              title: entry.summary,
              actor: entry.actor?.name,
              when: dateAndTime(entry.occurredAt, ZONE),
              dateTime: entry.occurredAt,
              icon: <History aria-hidden className="size-3.5" />,
            }))}
          />
        )}
      </div>
    </Section>
  );
}
