import { Download, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/shared/api';
import {
  Alert,
  Button,
  DensityProvider,
  EmptyState,
  ErrorState,
  PageLayout,
  Pagination,
  SearchField,
  Skeleton,
  useSnackbar,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { saveBlob } from '@/shared/utils/saveBlob';
import { explain } from '../facilities/errors';
import { adminAuditKeys, exportAudit } from '../audit/api';
import { AuditEntry } from '../audit/components/AuditEntryRow';
import { AuditFilters } from '../audit/components/AuditFilters';
import { useAudit } from '../audit/hooks';
import { auditCodec, isFiltered, toFilters, toQuery } from '../audit/listState';

export default function AdminAuditPage() {
  const [state, update] = useUrlState(auditCodec);
  const list = useAudit(toQuery(state));
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const [exporting, setExporting] = useState(false);
  const data = list.data;

  const hasRange = state.from !== undefined && state.to !== undefined;

  const runExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAudit(api, toFilters(state));
      const rows = Math.max(0, (await blob.text()).split('\r\n').length - 2);
      saveBlob(blob, `audit-${state.from}-to-${state.to}.csv`);
      // The export is itself an entry in the trail, so show it.
      await queryClient.invalidateQueries({ queryKey: adminAuditKeys.all });
      notify(
        `Exported ${rows} ${rows === 1 ? 'entry' : 'entries'}. The export is recorded in the audit trail.`,
        'success',
      );
    } catch (failure) {
      notify(explain(failure), 'error');
    } finally {
      setExporting(false);
    }
  };

  const renderResults = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load the audit trail"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!data) return <Skeleton className="h-40" />;
    if (data.items.length === 0) {
      return (
        <EmptyState
          title={isFiltered(state) ? 'Nothing matches' : 'The audit trail is empty'}
          description={
            isFiltered(state)
              ? 'No entries fit the search and filters you have chosen. Widen the dates, or clear the filters.'
              : 'Nothing has been recorded yet.'
          }
        />
      );
    }
    return (
      <ol aria-label="Audit entries" className="m-0 flex list-none flex-col gap-2 p-0">
        {data.items.map((entry) => (
          <li key={entry.id}>
            <AuditEntry entry={entry} />
          </li>
        ))}
      </ol>
    );
  };

  return (
    <PageLayout
      title="Audit trail"
      description="What happened to bookings, people and the lists they depend on: who did it, when, and what changed."
    >
      <DensityProvider density="compact">
        <div className="flex flex-col gap-3">
          <Alert severity="info" title="This contains personal information">
            <span className="flex items-start gap-2">
              <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>
                Only system administrators can see it. Every export is itself recorded here, with
                who made it, the filters used and how many rows it held.
              </span>
            </span>
          </Alert>
          <SearchField
            label="Booking reference"
            placeholder="For example MVL-2026-00417"
            value={state.reference}
            onChange={(reference) => update({ reference, page: 1 }, { replace: true })}
          />
          <AuditFilters
            key={JSON.stringify([
              state.from,
              state.to,
              state.actor,
              state.entityType,
              state.entityId,
              state.action,
            ])}
            state={state}
            onApply={update}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-muted">
              {data ? `${data.totalItems} ${data.totalItems === 1 ? 'entry' : 'entries'}` : ' '}
            </p>
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                disabled={!hasRange || exporting}
                aria-describedby="audit-export-hint"
                onClick={() => void runExport()}
              >
                <Download aria-hidden className="size-4" />
                {exporting ? 'Exporting…' : 'Export as CSV'}
              </Button>
              <p id="audit-export-hint" className="text-sm text-muted">
                {hasRange
                  ? `Exports everything from ${state.from} to ${state.to} that matches the filters.`
                  : 'Choose a first and last day to export. There is no export of everything.'}
              </p>
            </div>
          </div>
          <section aria-label="Results" aria-busy={list.isFetching}>
            {renderResults()}
          </section>
          {data && <Pagination envelope={data} onChange={(page) => update({ page })} />}
        </div>
      </DensityProvider>
    </PageLayout>
  );
}
