import { CircleCheck } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  APPROVAL_SORTS,
  ApiProblem,
  useApiClient,
  type ApprovalDetail,
  type ApprovalListItem,
  type ApprovalSort,
} from '@/shared/api';
import {
  ActiveFilterChips,
  Button,
  DensityProvider,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterPanel,
  Kbd,
  KeyboardShortcutHelp,
  MasterDetailLayout,
  PageLayout,
  Pagination,
  ResultsGrid,
  ResultsToolbar,
  SearchField,
  SkeletonGrid,
  SortSelect,
  useKeyboardShortcuts,
  useSnackbar,
  useSplitView,
  type ShortcutBinding,
  type ShortcutGroup,
  type SortOption,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { saveBlob } from '@/shared/utils/saveBlob';
import { downloadApprovalDocument } from '../api';
import { buildActiveFilters } from '../activeFilters';
import { ApprovalDecisions, type DecisionTarget } from '../components/ApprovalDecisions';
import { ApprovalDetailPanel } from '../components/ApprovalDetailPanel';
import { ApprovalFilters } from '../components/ApprovalFilters';
import { ApprovalQueueItem } from '../components/ApprovalQueueItem';
import {
  useApprovalCounts,
  useApprovalDetail,
  useApprovals,
  useDecide,
  type Decision,
} from '../hooks';
import {
  CLEARED_APPROVAL_FILTERS,
  approvalListCodec,
  isFiltered,
  shownStatuses,
  toListParams,
} from '../listState';

const SORT_LABELS: Record<ApprovalSort, string> = {
  waiting: 'Waiting longest first',
  '-waiting': 'Waiting least first',
  eventDate: 'Event date (soonest first)',
  '-eventDate': 'Event date (latest first)',
  facility: 'Facility',
};
const SORT_OPTIONS: SortOption<ApprovalSort>[] = APPROVAL_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Moving through the queue',
    shortcuts: [
      { keys: ['j', '↓'], description: 'Next request' },
      { keys: ['k', '↑'], description: 'Previous request' },
      { keys: ['/'], description: 'Search the queue' },
    ],
  },
  {
    title: 'Deciding',
    shortcuts: [
      { keys: ['a'], description: 'Approve the selected request' },
      { keys: ['r'], description: 'Reject the selected request' },
      { keys: ['Enter'], description: 'Confirm in a dialog' },
      { keys: ['Ctrl + Enter'], description: 'Confirm from a text box' },
      { keys: ['Esc'], description: 'Cancel a dialog' },
    ],
  },
  { title: 'Help', shortcuts: [{ keys: ['?'], description: 'Show this list' }] },
];

export default function ApprovalsPage() {
  const { itemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const api = useApiClient();
  const { notify } = useSnackbar();
  const split = useSplitView();
  const search = location.search;

  const [state, update] = useUrlState(approvalListCodec, { resetOnChange: 'page' });
  const list = useApprovals(toListParams(state));
  const counts = useApprovalCounts();
  const detail = useApprovalDetail(itemId);
  const decide = useDecide();
  const items = list.data?.items;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialog, setDialog] = useState<DecisionTarget | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState({ itemId, note: '', reason: '' });
  // What was typed belongs to one request. Moving to another starts clean.
  const draft = drafts.itemId === itemId ? drafts : { itemId, note: '', reason: '' };

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const focusAfterDecision = useRef<string | null>(null);
  const latest = useRef({ items, itemId, search, detail: detail.data });
  useEffect(() => {
    latest.current = { items, itemId, search, detail: detail.data };
  });

  const rowLink = (id: string) =>
    [...(queueRef.current?.querySelectorAll<HTMLElement>('[data-queue-item]') ?? [])].find(
      (el) => el.dataset.queueItem === id,
    ) ?? null;
  const pathFor = (id?: string) => `/approvals${id ? `/${encodeURIComponent(id)}` : ''}`;

  // On a screen with room, something is always selected, so the detail is never an empty pane.
  const firstId = items?.[0]?.id;
  useEffect(() => {
    if (split && !itemId && firstId && !list.isPlaceholderData) {
      void navigate(`${pathFor(firstId)}${search}`, { replace: true });
    }
  }, [split, itemId, firstId, list.isPlaceholderData, search, navigate]);

  const move = (delta: 1 | -1) => {
    const { items: queue = [], itemId: current, search: query } = latest.current;
    if (queue.length === 0) return;
    const index = queue.findIndex((i) => i.id === current);
    const target =
      index === -1
        ? delta === 1
          ? 0
          : queue.length - 1
        : Math.min(queue.length - 1, Math.max(0, index + delta));
    const next = queue[target];
    if (!next || next.id === current) return;
    const link = rowLink(next.id);
    link?.focus();
    link?.scrollIntoView({ block: 'nearest' });
    void navigate(`${pathFor(next.id)}${query}`, { replace: current !== undefined });
  };

  const open = (kind: 'approve' | 'reject') => {
    const item = latest.current.detail;
    if (!item || item.status !== 'pending' || !item.actions[kind].allowed) return;
    setDialog({ kind, item, open: true });
  };

  const inQueue = (event: KeyboardEvent) =>
    queueRef.current?.contains(event.target as Node) ?? false;
  const bindings: ShortcutBinding[] = [
    { keys: ['j'], handler: () => move(1) },
    { keys: ['k'], handler: () => move(-1) },
    { keys: ['ArrowDown'], handler: () => move(1), when: inQueue },
    { keys: ['ArrowUp'], handler: () => move(-1), when: inQueue },
    { keys: ['a'], handler: () => open('approve') },
    { keys: ['r'], handler: () => open('reject') },
    { keys: ['/'], handler: () => searchRef.current?.focus() },
    { keys: ['?'], handler: () => setHelpOpen(true) },
  ];
  useKeyboardShortcuts(bindings);

  /** Decides, refreshes the queue, then moves to the next request so nobody has to reselect. */
  const onDecide = async (item: ApprovalDetail, decision: Decision) => {
    const queue = latest.current.items ?? [];
    const index = queue.findIndex((i) => i.id === item.id);
    const nextId = index === -1 ? undefined : (queue[index + 1] ?? queue[index - 1])?.id;

    const decided = await decide.mutateAsync({ item, decision });
    const affected = item.context.competingRequests.length;
    notify(
      decision.kind === 'approve'
        ? `${decided.reference} approved.${
            affected > 0
              ? ` ${affected} competing ${affected === 1 ? 'request' : 'requests'} can no longer be approved.`
              : ''
          }`
        : `${decided.reference} rejected. ${decided.applicantName} will be emailed your reason.`,
      'success',
    );
    advance(nextId);
  };

  const advance = (nextId: string | undefined) => {
    focusAfterDecision.current = nextId ?? null;
    void navigate(`${pathFor(nextId)}${latest.current.search}`, { replace: true });
  };

  /** Where focus goes when a decision dialog closes: the next request, or failing that the search box. */
  const returnFocus = () => {
    const id = focusAfterDecision.current;
    focusAfterDecision.current = null;
    return (
      (id ? rowLink(id) : null) ??
      document.querySelector<HTMLElement>('[data-detail-heading]') ??
      searchRef.current
    );
  };

  const download = async (documentId: string, name: string) => {
    if (!itemId) return;
    setDownloadError(null);
    try {
      saveBlob(await downloadApprovalDocument(api, itemId, documentId), name);
    } catch (error) {
      setDownloadError(`${name} could not be downloaded. ${ApiProblem.from(error).title}.`);
    }
  };

  const now = DateTime.now();
  const statuses = shownStatuses(state);
  const waitingOnly = statuses.length === 1 && statuses[0] === 'pending';
  const activeFilters = buildActiveFilters(state, counts.data, update);
  const clearFilters = () => update(CLEARED_APPROVAL_FILTERS);
  const total = list.data?.totalItems;
  const countLabel =
    total === undefined
      ? undefined
      : `${total} ${waitingOnly ? 'waiting' : total === 1 ? 'request' : 'requests'}`;

  const renderQueue = () => {
    if (list.isError) {
      return (
        <ErrorState
          title="We could not load the queue"
          problem={list.error}
          onRetry={() => void list.refetch()}
        />
      );
    }
    if (!list.data)
      return (
        <SkeletonGrid count={6} layout="row" hasMedia={false} rows={['text', 'text', 'text']} />
      );
    if (list.data.items.length === 0) {
      if (!isFiltered(state)) {
        return (
          <EmptyState
            icon={<CircleCheck aria-hidden className="size-10 text-primary" />}
            title="Nothing is waiting for a decision"
            description="Every request for your facilities has been decided. New ones appear here as they are submitted."
          />
        );
      }
      return (
        <EmptyState
          title="No requests match"
          description="Nothing fits the search and filters you have chosen."
          action={
            <div className="flex gap-2">
              {activeFilters.length > 0 && (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              {state.q !== '' && (
                <Button variant="secondary" size="sm" onClick={() => update({ q: '' })}>
                  Clear search
                </Button>
              )}
            </div>
          }
        />
      );
    }
    return (
      <ResultsGrid layout="rows" label="Approval queue">
        {list.data.items.map((item: ApprovalListItem) => (
          <ApprovalQueueItem
            key={item.id}
            item={item}
            selected={item.id === itemId}
            now={now}
            search={search}
          />
        ))}
      </ResultsGrid>
    );
  };

  const queue = (
    <DensityProvider density="compact">
      <div ref={queueRef} className="flex flex-col gap-2">
        <SearchField
          label="Search the queue"
          placeholder="Reference or applicant"
          inputRef={searchRef}
          value={state.q}
          onChange={(q) => update({ q }, { replace: true })}
        />
        <ResultsToolbar
          countLabel={countLabel}
          leading={
            <FilterButton
              ref={filterButtonRef}
              alwaysVisible
              activeCount={activeFilters.length}
              onClick={() => setFiltersOpen(true)}
            />
          }
          sort={
            <SortSelect
              value={state.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => update({ sort })}
            />
          }
        />
        <ActiveFilterChips filters={activeFilters} onClearAll={clearFilters} />
        <div
          aria-busy={list.isFetching}
          className={
            list.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'
          }
        >
          {renderQueue()}
        </div>
        {list.data && <Pagination envelope={list.data} onChange={(page) => update({ page })} />}
      </div>
      <FilterPanel
        placement="overlay"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        closeLabel={countLabel ? `Show ${countLabel}` : 'Show results'}
        onClearAll={activeFilters.length > 0 ? clearFilters : undefined}
        returnFocusRef={filterButtonRef}
      >
        <ApprovalFilters counts={counts.data} state={state} onChange={update} />
      </FilterPanel>
    </DensityProvider>
  );

  const placeholder = (
    <EmptyState
      title={
        list.data && list.data.items.length === 0 && !isFiltered(state)
          ? 'You are all caught up'
          : 'Select a request'
      }
      description="Choose a request from the queue to see it here."
    />
  );

  return (
    <PageLayout
      title="Approvals"
      description="Decide the requests waiting for your facilities."
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setHelpOpen(true)}
          aria-keyshortcuts="?"
        >
          Keyboard shortcuts
          <span aria-hidden>
            <Kbd>?</Kbd>
          </span>
        </Button>
      }
    >
      <MasterDetailLayout
        masterLabel="Queue"
        detailLabel="Selected request"
        hasSelection={itemId !== undefined}
        master={queue}
        detail={
          itemId === undefined ? (
            placeholder
          ) : (
            <ApprovalDetailPanel
              query={detail}
              search={search}
              now={now}
              backTo={split ? null : `/approvals${search}`}
              onApprove={() => open('approve')}
              onReject={() => open('reject')}
              onDownload={(documentId, name) => void download(documentId, name)}
              downloadError={downloadError}
            />
          )
        }
      />

      <ApprovalDecisions
        dialog={dialog}
        note={draft.note}
        onNoteChange={(note) => setDrafts({ ...draft, note })}
        reason={draft.reason}
        onReasonChange={(reason) => setDrafts({ ...draft, reason })}
        onOpenChange={(next) =>
          setDialog((current) => (current ? { ...current, open: next } : null))
        }
        onDecide={onDecide}
        onSettled={() => {
          // Someone else decided it. Refresh, and move on to the next one.
          const queue = latest.current.items ?? [];
          const index = queue.findIndex((i) => i.id === dialog?.item.id);
          void list.refetch();
          void counts.refetch();
          advance(index === -1 ? undefined : (queue[index + 1] ?? queue[index - 1])?.id);
        }}
        returnFocus={returnFocus}
      />
      <KeyboardShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} groups={SHORTCUT_GROUPS} />
    </PageLayout>
  );
}
