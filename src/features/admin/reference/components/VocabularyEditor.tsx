import { Archive, Pencil, Plus, Undo2 } from 'lucide-react';
import { useId, useState } from 'react';
import {
  useApiClient,
  type ReferenceEntry,
  type ReferenceImpactResult,
  type ReferenceList,
} from '@/shared/api';
import {
  Alert,
  ArchiveConfirm,
  Badge,
  Button,
  controlStyles,
  EmptyState,
  ErrorState,
  FormField,
  Section,
  Skeleton,
  useSnackbar,
} from '@/shared/components';
import { fieldErrors, explain } from '../../facilities/errors';
import {
  archiveEntry,
  checkSeatingImpact,
  createEntry,
  restoreEntry,
  updateEntry,
  type Vocabulary,
} from '../api';
import { useRefreshAfterReferenceChange, useVocabulary } from '../hooks';

export interface VocabularyEditorProps {
  path: Vocabulary;
  title: string;
  /** What one entry is called, in the singular: "seating arrangement". */
  noun: string;
  description: string;
  /** Where the entries are used, in a sentence each, for the archive confirmation. */
  archiveEffect: (name: string) => string;
  /** Said under the list, such as a question for the client. */
  footnote?: string;
}

interface EntryValues {
  name: string;
  displayOrder?: number;
}

type Mode = { kind: 'add' } | { kind: 'edit'; id: string } | null;

function usageText(path: Vocabulary, entry: ReferenceEntry): string[] {
  const parts: string[] = [];
  if (path === 'seating-arrangements') {
    parts.push(
      entry.usage.facilities === 1
        ? '1 facility holds a capacity for it'
        : `${entry.usage.facilities} facilities hold a capacity for it`,
    );
  }
  parts.push(
    entry.usage.bookings === 1 ? 'used by 1 booking' : `used by ${entry.usage.bookings} bookings`,
  );
  return parts;
}

/**
 * A short ordered vocabulary: add, rename, reorder by a number, archive and restore. Seating
 * arrangements and event types are the same shape, so they share it. Archiving never deletes,
 * and for an arrangement that facilities hold figures against it runs the impact check first.
 */
export function VocabularyEditor({
  path,
  title,
  noun,
  description,
  archiveEffect,
  footnote,
}: VocabularyEditorProps) {
  const list = useVocabulary(path);
  const [mode, setMode] = useState<Mode>(null);
  const [archiving, setArchiving] = useState<{
    entry: ReferenceEntry;
    impact: ReferenceImpactResult | null;
  } | null>(null);
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterReferenceChange();

  const startArchive = async (entry: ReferenceEntry) => {
    try {
      const impact =
        path === 'seating-arrangements' ? await checkSeatingImpact(api, entry.id) : null;
      setArchiving({ entry, impact });
    } catch (failure) {
      notify(explain(failure), 'error');
    }
  };

  return (
    <Section title={title} description={description}>
      <div className="flex max-w-3xl flex-col gap-4">
        <div>
          <Button
            variant="secondary"
            disabled={mode?.kind === 'add'}
            onClick={() => setMode({ kind: 'add' })}
          >
            <Plus aria-hidden className="size-4" />
            Add a {noun}
          </Button>
        </div>
        {mode?.kind === 'add' && (
          <EntryForm
            key="add"
            noun={noun}
            submitLabel={`Add ${noun}`}
            onCancel={() => setMode(null)}
            onSubmit={async (values) => {
              await createEntry(api, path, values);
              await refresh();
              notify(`${values.name} added.`, 'success');
              setMode(null);
            }}
          />
        )}
        {list.isError ? (
          <ErrorState
            title={`We could not load the ${noun}s`}
            problem={list.error}
            onRetry={() => void list.refetch()}
          />
        ) : !list.data ? (
          <Skeleton className="h-32" />
        ) : (
          <Entries
            data={list.data}
            path={path}
            noun={noun}
            editing={mode?.kind === 'edit' ? mode.id : null}
            onEdit={(id) => setMode({ kind: 'edit', id })}
            onCancelEdit={() => setMode(null)}
            onSave={async (entry, values) => {
              await updateEntry(api, path, entry.id, values);
              await refresh();
              notify(`${values.name} saved.`, 'success');
              setMode(null);
            }}
            onArchive={(entry) => void startArchive(entry)}
            onRestore={async (entry) => {
              try {
                await restoreEntry(api, path, entry.id);
                await refresh();
                notify(`${entry.name} restored.`, 'success');
              } catch (failure) {
                notify(explain(failure), 'error');
              }
            }}
          />
        )}
        {footnote && <p className="text-sm text-muted">{footnote}</p>}
      </div>
      {archiving && (
        <ArchiveConfirm
          open
          onOpenChange={(open) => !open && setArchiving(null)}
          facilityName={archiving.entry.name}
          description={archiveEffect(archiving.entry.name)}
          details={
            archiving.impact && archiving.impact.facilitiesAffected.length > 0 ? (
              <div>
                <p className="font-medium text-ink">
                  {archiving.impact.facilitiesAffected.length === 1
                    ? '1 facility holds a capacity figure for it, which will no longer be offered:'
                    : `${archiving.impact.facilitiesAffected.length} facilities hold a capacity figure for it, which will no longer be offered:`}
                </p>
                <ul
                  aria-label="Facilities with a figure"
                  className="m-0 mt-1 list-disc pl-5 text-ink"
                >
                  {archiving.impact.facilitiesAffected.map((f) => (
                    <li key={f.id}>
                      {f.name}: {f.capacity} people
                    </li>
                  ))}
                </ul>
              </div>
            ) : undefined
          }
          impact={archiving.impact ?? { affectedBookings: [], totalAffected: 0 }}
          onConfirm={async () => {
            await archiveEntry(api, path, archiving.entry.id);
            await refresh();
            notify(`${archiving.entry.name} archived.`, 'success');
          }}
        />
      )}
    </Section>
  );
}

function Entries({
  data,
  path,
  noun,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onArchive,
  onRestore,
}: {
  data: ReferenceList;
  path: Vocabulary;
  noun: string;
  editing: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (entry: ReferenceEntry, values: EntryValues) => Promise<void>;
  onArchive: (entry: ReferenceEntry) => void;
  onRestore: (entry: ReferenceEntry) => Promise<void>;
}) {
  if (data.length === 0) {
    return <EmptyState title={`No ${noun}s yet`} description={`Add the first ${noun}.`} />;
  }
  return (
    <ul
      aria-label={`${noun[0]?.toUpperCase()}${noun.slice(1)}s`}
      className="m-0 flex list-none flex-col gap-2 p-0"
    >
      {data.map((entry) => (
        <li key={entry.id}>
          {editing === entry.id ? (
            <EntryForm
              noun={noun}
              initial={entry}
              submitLabel="Save"
              onCancel={onCancelEdit}
              onSubmit={(values) => onSave(entry, values)}
            />
          ) : (
            <article
              className={`flex flex-col gap-2 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between ${
                entry.status === 'archived' ? 'opacity-80' : ''
              }`}
            >
              <div className="min-w-0">
                <h3 className="font-semibold">{entry.name}</h3>
                <p className="text-sm text-muted">
                  Shown in position {entry.displayOrder} · {usageText(path, entry).join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {entry.status === 'archived' && (
                  <Badge tone="warning" className="gap-1">
                    <Archive aria-hidden className="size-3" />
                    Archived
                  </Badge>
                )}
                {entry.status === 'active' ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Edit ${entry.name}`}
                      onClick={() => onEdit(entry.id)}
                    >
                      <Pencil aria-hidden className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Archive ${entry.name}`}
                      onClick={() => onArchive(entry)}
                    >
                      <Archive aria-hidden className="size-4" />
                      Archive
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Restore ${entry.name}`}
                    onClick={() => void onRestore(entry)}
                  >
                    <Undo2 aria-hidden className="size-4" />
                    Restore
                  </Button>
                )}
              </div>
            </article>
          )}
        </li>
      ))}
    </ul>
  );
}

function EntryForm({
  noun,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  noun: string;
  initial?: ReferenceEntry;
  submitLabel: string;
  onSubmit: (values: EntryValues) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [order, setOrder] = useState(initial ? String(initial.displayOrder) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErrors({});
    setFailure(null);
    if (name.trim() === '') {
      setErrors({ name: `Enter the name of the ${noun}.` });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        displayOrder: order.trim() === '' ? undefined : Number(order),
      });
    } catch (error) {
      const fields = fieldErrors(error);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFailure(explain(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label={initial ? `Edit ${initial.name}` : `Add a ${noun}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3 rounded-md border border-primary bg-surface p-3"
    >
      {failure && <Alert severity="error">{failure}</Alert>}
      <div className="flex flex-wrap items-start gap-3">
        <FormField
          id={`${id}-name`}
          label="Name"
          required
          error={errors.name}
          className="min-w-48 flex-1"
        >
          {(control) => (
            <input
              {...control}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField
          id={`${id}-order`}
          label="Display order"
          hint="Lowest first. Leave blank to add at the end."
          error={errors.displayOrder}
          className="w-44"
        >
          {(control) => (
            <input
              {...control}
              type="number"
              min={0}
              inputMode="numeric"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
