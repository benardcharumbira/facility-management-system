import { ArrowLeft, FilePlus2, Lock, Send } from 'lucide-react';
import { useState } from 'react';
import { useApiClient, type TermsStatus, type TermsVersion } from '@/shared/api';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Section,
  Skeleton,
  useSnackbar,
} from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';
import { createTerms, publishTerms, updateTerms } from '../api';
import { useRefreshAfterReferenceChange, useTerms } from '../hooks';
import { TermsPreview } from './TermsPreview';
import { VersionedContentEditor } from './VersionedContentEditor';

const ZONE = 'Africa/Johannesburg';

const STATUS: Record<TermsStatus, { label: string; tone: 'primary' | 'warning' | 'neutral' }> = {
  draft: { label: 'Draft', tone: 'warning' },
  published: { label: 'Published', tone: 'primary' },
  superseded: { label: 'Superseded', tone: 'neutral' },
};

type View =
  | { kind: 'list' }
  | { kind: 'view'; id: string }
  | { kind: 'edit'; id: string }
  | { kind: 'new'; from: TermsVersion };

export function TermsSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const terms = useTerms();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [publishing, setPublishing] = useState<TermsVersion | null>(null);
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterReferenceChange();

  const back = () => {
    onDirtyChange(false);
    setView({ kind: 'list' });
  };

  const body = () => {
    if (terms.isError) {
      return (
        <ErrorState
          title="We could not load the terms"
          problem={terms.error}
          onRetry={() => void terms.refetch()}
        />
      );
    }
    if (!terms.data) return <Skeleton className="h-40" />;
    const versions = terms.data;
    const current = versions.find((v) => v.status === 'published');
    const find = (id: string) => versions.find((v) => v.id === id);
    // Only a draft is ever opened for editing; anything else is shown, not edited.
    const readOnly = (version: TermsVersion) => (
      <ReadOnly
        version={version}
        versions={versions}
        onBack={back}
        onNewDraft={(from) => setView({ kind: 'new', from })}
        onEdit={(v) => setView({ kind: 'edit', id: v.id })}
        onPublish={setPublishing}
      />
    );

    if (view.kind === 'new') {
      return (
        <Editing
          heading="New draft"
          note={`Started from version ${view.from.version}. Nothing is published until you publish it.`}
          initial={{ title: view.from.title, paragraphs: view.from.paragraphs }}
          saveLabel="Save draft"
          onBack={back}
          onDirtyChange={onDirtyChange}
          onSave={async (values) => {
            const created = await createTerms(api, values);
            await refresh();
            notify(`Draft ${created.version} saved.`, 'success');
            onDirtyChange(false);
            setView({ kind: 'view', id: created.id });
          }}
        />
      );
    }

    if (view.kind === 'edit') {
      const draft = find(view.id);
      if (!draft) return <Missing onBack={back} />;
      if (draft.status !== 'draft') return readOnly(draft);
      return (
        <Editing
          heading={`Edit draft ${draft.version}`}
          initial={{ title: draft.title, paragraphs: draft.paragraphs }}
          saveLabel="Save draft"
          onBack={back}
          onDirtyChange={onDirtyChange}
          onSave={async (values) => {
            await updateTerms(api, draft.id, values);
            await refresh();
            notify(`Draft ${draft.version} saved.`, 'success');
            onDirtyChange(false);
            setView({ kind: 'view', id: draft.id });
          }}
        />
      );
    }

    if (view.kind === 'view') {
      const version = find(view.id);
      if (!version) return <Missing onBack={back} />;
      return readOnly(version);
    }

    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button
            variant="secondary"
            disabled={!current}
            onClick={() => current && setView({ kind: 'new', from: current })}
          >
            <FilePlus2 aria-hidden className="size-4" />
            Start a new draft
          </Button>
        </div>
        {versions.length === 0 ? (
          <EmptyState title="No versions yet" description="Start the first draft." />
        ) : (
          <ul aria-label="Versions of the terms" className="m-0 flex list-none flex-col gap-2 p-0">
            {versions.map((v) => (
              <li key={v.id}>
                <article className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                      Version {v.version}
                      <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge>
                    </h3>
                    <p className="text-sm text-muted">{v.title}</p>
                    <p className="text-sm text-muted">{lifecycle(v)}</p>
                    <p className="text-sm text-muted">
                      {v.bookings === 1
                        ? 'Accepted on 1 booking'
                        : `Accepted on ${v.bookings} bookings`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`View version ${v.version}`}
                      onClick={() => setView({ kind: 'view', id: v.id })}
                    >
                      View
                    </Button>
                    {v.status === 'draft' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Edit version ${v.version}`}
                          onClick={() => setView({ kind: 'edit', id: v.id })}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          aria-label={`Publish version ${v.version}`}
                          onClick={() => setPublishing(v)}
                        >
                          Publish
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const superseded = terms.data?.find((v) => v.status === 'published');

  return (
    <Section
      title="Terms and conditions"
      description="Applicants accept a specific version. A published version is never edited: to correct it, publish a new one."
    >
      <div className="max-w-3xl">{body()}</div>
      {publishing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPublishing(null)}
          title={`Publish version ${publishing.version}?`}
          description={
            <div className="flex flex-col gap-2">
              <p>
                It becomes the terms every applicant sees, at once
                {superseded ? `, and version ${superseded.version} is superseded.` : '.'} The public
                terms page shows it.
              </p>
              <p>
                A booking records the version that is current at the moment it is submitted, not the
                one that was current when its draft was started. Anyone part-way through a request
                will be asked to read and accept this version before they can submit.
              </p>
              <p>
                Bookings that already accepted{' '}
                {superseded ? `version ${superseded.version}` : 'an earlier version'} keep it. Once
                published, these words cannot be edited.
              </p>
            </div>
          }
          confirmLabel={`Publish version ${publishing.version}`}
          cancelLabel="Do not publish"
          onConfirm={async () => {
            await publishTerms(api, publishing.id);
            await refresh();
            notify(`Version ${publishing.version} is now the current terms.`, 'success');
            onDirtyChange(false);
            setView({ kind: 'view', id: publishing.id });
          }}
        />
      )}
    </Section>
  );
}

function lifecycle(v: TermsVersion): string {
  const parts = [`Written ${dateAndTime(v.createdAt, ZONE)} by ${v.createdBy.name}`];
  if (v.publishedAt) {
    parts.push(
      `published ${dateAndTime(v.publishedAt, ZONE)}${v.publishedBy ? ` by ${v.publishedBy.name}` : ''}`,
    );
  }
  if (v.supersededAt) parts.push(`superseded ${dateAndTime(v.supersededAt, ZONE)}`);
  return parts.join(', ');
}

function Missing({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState title="That version no longer exists" description="Go back to the versions." />
      <div>
        <Button variant="secondary" onClick={onBack}>
          All versions
        </Button>
      </div>
    </div>
  );
}

function Editing({
  heading,
  note,
  initial,
  saveLabel,
  onBack,
  onSave,
  onDirtyChange,
}: {
  heading: string;
  note?: string;
  initial: { title: string; paragraphs: string[] };
  saveLabel: string;
  onBack: () => void;
  onSave: (values: { title: string; paragraphs: string[] }) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" />
          All versions
        </Button>
      </div>
      <h3 className="text-lg font-semibold">{heading}</h3>
      {note && <p className="text-muted">{note}</p>}
      <VersionedContentEditor
        initial={initial}
        saveLabel={saveLabel}
        onSave={onSave}
        onCancel={onBack}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}

function ReadOnly({
  version,
  versions,
  onBack,
  onNewDraft,
  onEdit,
  onPublish,
}: {
  version: TermsVersion;
  versions: TermsVersion[];
  onBack: () => void;
  onNewDraft: (from: TermsVersion) => void;
  onEdit: (v: TermsVersion) => void;
  onPublish: (v: TermsVersion) => void;
}) {
  const draft = version.status === 'draft';
  const current = versions.find((v) => v.status === 'published');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" />
          All versions
        </Button>
      </div>
      <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        Version {version.version}
        <Badge tone={STATUS[version.status].tone}>{STATUS[version.status].label}</Badge>
      </h3>
      <p className="text-muted">{lifecycle(version)}</p>
      {!draft && (
        <Alert severity="info" title="This version cannot be edited">
          <span className="flex items-start gap-2">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              Applicants accepted these exact words
              {version.bookings > 0
                ? ` on ${version.bookings} ${version.bookings === 1 ? 'booking' : 'bookings'}`
                : ''}
              . To correct them, start a new draft and publish it.
            </span>
          </span>
        </Alert>
      )}
      <TermsPreview title={version.title} paragraphs={version.paragraphs} />
      <div className="flex flex-wrap gap-2">
        {draft ? (
          <>
            <Button variant="secondary" onClick={() => onEdit(version)}>
              Edit draft
            </Button>
            <Button onClick={() => onPublish(version)}>
              <Send aria-hidden className="size-4" />
              Publish version {version.version}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => onNewDraft(version)}>
            <FilePlus2 aria-hidden className="size-4" />
            Start a new draft from this version
          </Button>
        )}
      </div>
      {draft && current && (
        <p className="text-sm text-muted">Publishing it supersedes version {current.version}.</p>
      )}
    </div>
  );
}
