import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useBlocker } from 'react-router';
import {
  ApiProblem,
  type AllocationMatrix,
  type ResourceCategory,
  type ResourceImpactResult,
  useApiClient,
} from '@/shared/api';
import {
  ActiveFilterChips,
  Alert,
  CheckboxGroupFilter,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterButton,
  FilterPanel,
  FilterSection,
  PageLayout,
  Skeleton,
  UnsavedChangesBar,
  useImpactGuard,
  useSnackbar,
  type ActiveFilter,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { explain } from '../facilities/errors';
import { baseOf, toChanges, type Edits } from '../resources/allocation';
import { checkBatchImpact, saveBatch } from '../resources/api';
import { AllocationGrid } from '../resources/components/AllocationGrid';
import { ResourceAreaTabs } from '../resources/components/ResourceAreaTabs';
import { useMatrix, useRefreshAfterResourceChange } from '../resources/hooks';
import { CATEGORY_LABELS } from '../resources/labels';
import { allocationViewCodec } from '../resources/listState';

/** Which cells a failed batch named, in words, so the person can find them. */
function describeFailure(
  failure: unknown,
  changes: ReturnType<typeof toChanges>,
  m: AllocationMatrix,
): ReactNode {
  const problem = ApiProblem.from(failure);
  const entries = Object.entries(problem.errors);
  if (entries.length === 0) return explain(failure);
  const facilityName = (id: string) => m.facilities.find((f) => f.id === id)?.name ?? id;
  const resourceName = (id: string) => m.resources.find((r) => r.id === id)?.name ?? id;
  return (
    <>
      <p>Nothing was saved. Fix these and save again; your other changes are kept.</p>
      <ul className="m-0 list-disc pl-5">
        {entries.slice(0, 6).map(([key, messages]) => {
          const change = changes[Number(key.replace('changes.', ''))];
          const where = change
            ? `${resourceName(change.resourceId)}, ${facilityName(change.facilityId)}`
            : key;
          return <li key={key}>{`${where}: ${messages[0]}`}</li>;
        })}
      </ul>
    </>
  );
}

export default function AdminAllocationPage() {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterResourceChange();
  const { guard, dialog } = useImpactGuard();
  const matrix = useMatrix();
  const [view, updateView] = useUrlState(allocationViewCodec);
  const [edits, setEdits] = useState<Edits>({});
  const [open, setOpen] = useState<Record<ResourceCategory, boolean>>({
    venue: true,
    kitchen: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const data = matrix.data;
  const base = useMemo(() => baseOf(data?.allocations ?? []), [data]);
  const count = Object.keys(edits).length;

  // Unsaved work cannot be lost silently: leaving the page, or reloading it, asks first.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      count > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [count]);

  const facilities = (data?.facilities ?? []).filter(
    (f) => view.facility.length === 0 || view.facility.includes(f.id),
  );
  const resources = (data?.resources ?? []).filter(
    (r) => view.category.length === 0 || view.category.includes(r.category),
  );
  // Narrowing to a category means the person came for it: it is open.
  const isOpen = {
    venue: view.category.length > 0 || open.venue,
    kitchen: view.category.length > 0 || open.kitchen,
  };

  const chips: ActiveFilter[] = [
    ...view.facility.map((id) => ({
      key: `facility:${id}`,
      label: data?.facilities.find((f) => f.id === id)?.name ?? id,
      onRemove: () => updateView({ facility: view.facility.filter((f) => f !== id) }),
    })),
    ...view.category.map((c) => ({
      key: `category:${c}`,
      label: CATEGORY_LABELS[c],
      onRemove: () => updateView({ category: view.category.filter((x) => x !== c) }),
    })),
  ];

  const save = async () => {
    if (!data) return;
    setError(null);
    setSaving(true);
    const changes = toChanges(edits);
    try {
      const outcome = await guard<ResourceImpactResult>({
        // One check over the whole batch, not one per cell.
        check: () => checkBatchImpact(api, changes),
        apply: async () => {
          try {
            await saveBatch(api, changes);
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Save these changes?',
        summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} to what facilities hold reach bookings that already exist.`,
        confirmLabel: 'Save and keep these bookings',
      });
      if (outcome === 'applied') {
        setEdits({});
        await refresh();
        notify(
          `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} saved.`,
          'success',
        );
      }
    } catch (failure) {
      // Everything stays as it was typed.
      setError(describeFailure(failure, changes, data));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="Resources"
      description="The catalogue of what can be requested, and what each facility holds of it."
    >
      <ResourceAreaTabs current="allocation" />
      <div className="flex flex-col gap-3">
        <p className="max-w-3xl text-muted">
          Each cell is how many of a resource one facility holds, or whether it has it. Change as
          many as you like, then save them all at once. Prefer a form for one facility? Choose “Fill
          or copy” on its column, then “Open the form”, or open it from the facility’s own page.
        </p>

        {matrix.isError ? (
          <ErrorState
            title="We could not load the allocations"
            problem={matrix.error}
            onRetry={() => void matrix.refetch()}
          />
        ) : !data ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <FilterButton
                ref={filterButtonRef}
                alwaysVisible
                activeCount={chips.length}
                onClick={() => setFiltersOpen(true)}
              />
              <p role="status" className="text-sm text-muted">
                Showing {facilities.length} of {data.facilities.length} facilities and{' '}
                {resources.length} of {data.resources.length} resources
              </p>
            </div>
            <ActiveFilterChips
              filters={chips}
              onClearAll={() => updateView({ facility: [], category: [] })}
            />
            {facilities.length === 0 || resources.length === 0 ? (
              <EmptyState
                title="Nothing to show"
                description="The filters leave no facility or no resource."
              />
            ) : (
              <AllocationGrid
                facilities={facilities}
                allFacilities={data.facilities}
                resources={resources}
                base={base}
                edits={edits}
                onEdits={setEdits}
                open={isOpen}
                onToggle={(category) => setOpen({ ...open, [category]: !open[category] })}
              />
            )}
            <FilterPanel
              placement="overlay"
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              closeLabel="Show the grid"
              onClearAll={
                chips.length > 0 ? () => updateView({ facility: [], category: [] }) : undefined
              }
              returnFocusRef={filterButtonRef}
            >
              <FilterSection title="Facilities" activeCount={view.facility.length}>
                <CheckboxGroupFilter
                  label="Facilities"
                  options={data.facilities.map((f) => ({ value: f.id, label: f.name }))}
                  selected={view.facility}
                  onChange={(facility) => updateView({ facility })}
                />
              </FilterSection>
              <FilterSection title="Category" activeCount={view.category.length}>
                <CheckboxGroupFilter
                  label="Category"
                  options={(['venue', 'kitchen'] as const).map((c) => ({
                    value: c,
                    label: CATEGORY_LABELS[c],
                  }))}
                  selected={view.category}
                  onChange={(category) => updateView({ category: category as ResourceCategory[] })}
                />
              </FilterSection>
            </FilterPanel>
          </>
        )}
        <UnsavedChangesBar
          count={count}
          saving={saving}
          error={error}
          onSave={() => void save()}
          onDiscard={() => {
            setEdits({});
            setError(null);
          }}
        />
        <p className="text-sm text-muted">
          Need to change a single facility without the grid?{' '}
          <Link to="/admin/facilities" className="text-primary underline underline-offset-2">
            Open it from Manage facilities
          </Link>
          .
        </p>
      </div>
      {dialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(next) => {
          if (!next && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description={`You have ${count} unsaved ${count === 1 ? 'change' : 'changes'} to what facilities hold. If you leave, they are lost.`}
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => blocker.proceed?.()}
      />
      <Alert severity="info" className="sr-only">
        Use the arrow keys to move between cells.
      </Alert>
    </PageLayout>
  );
}
