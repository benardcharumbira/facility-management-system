import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import {
  MAX_ALLOCATION,
  isApiProblem,
  useApiClient,
  type AllocationValue,
  type FacilityAllocations,
  type ResourceImpactResult,
} from '@/shared/api';
import {
  Alert,
  CheckboxField,
  ConfirmDialog,
  DetailHeader,
  DetailSkeleton,
  Disclosure,
  ErrorState,
  FieldGroup,
  NotFoundState,
  QuantityStepper,
  UnsavedChangesBar,
  useImpactGuard,
  usePageHeader,
  useSnackbar,
} from '@/shared/components';
import { explain } from '../facilities/errors';
import { checkBatchImpact, saveFacilityAllocations } from '../resources/api';
import { useFacilityAllocations, useRefreshAfterResourceChange } from '../resources/hooks';

export default function AdminFacilityResourcesPage() {
  const { id = '' } = useParams();
  const found = useFacilityAllocations(id);

  if (found.isError) {
    const missing = isApiProblem(found.error) && found.error.status === 404;
    return <Failed missing={missing} error={found.error} onRetry={() => void found.refetch()} />;
  }
  if (!found.data) return <Loading />;
  // A fresh form whenever what is saved changes.
  return (
    <Loaded
      key={JSON.stringify(found.data.resources.map((r) => r.value))}
      allocations={found.data}
    />
  );
}

function Loading() {
  usePageHeader('Resources');
  return <DetailSkeleton />;
}

function Failed({
  missing,
  error,
  onRetry,
}: {
  missing: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  usePageHeader(missing ? 'Facility not found' : 'Resources');
  return (
    <>
      <DetailHeader
        title={missing ? 'Facility not found' : 'Resources'}
        breadcrumbs={[
          { label: 'Manage facilities', to: '/admin/facilities' },
          { label: missing ? 'Not found' : 'Error' },
        ]}
      />
      {missing ? (
        <NotFoundState
          title="We could not find that facility"
          action={{ label: 'Back to facilities', to: '/admin/facilities' }}
        />
      ) : (
        <ErrorState title="We could not load its resources" problem={error} onRetry={onRetry} />
      )}
    </>
  );
}

function Loaded({ allocations }: { allocations: FacilityAllocations }) {
  const { facility } = allocations;
  usePageHeader(`${facility.name}: resources`, [
    { label: 'Manage facilities', to: '/admin/facilities' },
    { label: facility.name, to: `/admin/facilities/${encodeURIComponent(facility.id)}` },
    { label: 'Resources' },
  ]);
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterResourceChange();
  const { guard, dialog } = useImpactGuard();

  const saved = useMemo(
    () => new Map<string, AllocationValue>(allocations.resources.map((r) => [r.id, r.value])),
    [allocations],
  );
  const [values, setValues] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ReactNode>(null);

  const changed = allocations.resources.filter((r) => values.get(r.id) !== saved.get(r.id));
  const count = changed.length;
  const blocker = useBlocker(count > 0);
  useEffect(() => {
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [count]);

  const set = (resourceId: string, value: AllocationValue) =>
    setValues(new Map(values).set(resourceId, value));

  const save = async () => {
    setError(null);
    setSaving(true);
    const body = changed.map((r) => ({ resourceId: r.id, value: values.get(r.id) ?? false }));
    try {
      const outcome = await guard<ResourceImpactResult>({
        check: () =>
          checkBatchImpact(
            api,
            body.map((v) => ({ facilityId: facility.id, ...v })),
          ),
        apply: async () => {
          try {
            await saveFacilityAllocations(api, facility.id, { values: body });
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Save these changes?',
        summary: `${count} ${count === 1 ? 'change' : 'changes'} to what ${facility.name} holds reach bookings that already exist.`,
        confirmLabel: 'Save and keep these bookings',
      });
      if (outcome === 'applied') {
        await refresh();
        notify(`${facility.name}: resources saved.`, 'success');
      }
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  const list = (category: 'venue' | 'kitchen') => (
    <ul className="m-0 list-none p-0">
      {allocations.resources
        .filter((r) => r.category === category)
        .map((r) => {
          const value = values.get(r.id);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-b border-line py-2 last:border-b-0"
            >
              {r.quantified ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">{r.name}</span>
                  <QuantityStepper
                    name={r.name}
                    value={typeof value === 'number' ? value : 0}
                    min={0}
                    max={MAX_ALLOCATION}
                    onChange={(next) => set(r.id, next)}
                  />
                </div>
              ) : (
                <CheckboxField
                  id={`resource-${r.id}`}
                  label={r.name}
                  hint="Available or not."
                  checked={value === true}
                  onChange={(checked) => set(r.id, checked)}
                />
              )}
            </li>
          );
        })}
    </ul>
  );

  const kitchenChanged = changed.filter((r) => r.category === 'kitchen').length;

  return (
    <>
      <DetailHeader
        breadcrumbs={[
          { label: 'Manage facilities', to: '/admin/facilities' },
          { label: facility.name, to: `/admin/facilities/${encodeURIComponent(facility.id)}` },
          { label: 'Resources' },
        ]}
        back={{
          label: `Back to ${facility.name}`,
          to: `/admin/facilities/${encodeURIComponent(facility.id)}`,
        }}
        title={`${facility.name}: resources`}
        subtitle="What this facility holds of each resource in the catalogue."
      >
        <p>
          Changing many facilities at once?{' '}
          <Link
            to={`/admin/resources/allocation?facility=${encodeURIComponent(facility.id)}`}
            className="text-primary underline underline-offset-2"
          >
            Use the allocation grid
          </Link>
          .
        </p>
      </DetailHeader>

      <div className="flex max-w-3xl flex-col gap-5">
        <Alert severity="info">
          This is the allocation: how many this facility holds. To add a new kind of resource, or
          change one for everyone, use the{' '}
          <Link to="/admin/resources" className="font-medium underline underline-offset-2">
            catalogue
          </Link>
          .
        </Alert>
        <FieldGroup legend="Venue resources">{list('venue')}</FieldGroup>
        <Disclosure
          summary={
            kitchenChanged === 0
              ? 'Kitchen resources'
              : `Kitchen resources, ${kitchenChanged} changed`
          }
        >
          <FieldGroup legend="Kitchen resources">{list('kitchen')}</FieldGroup>
        </Disclosure>
        <UnsavedChangesBar
          count={count}
          saving={saving}
          error={error}
          onSave={() => void save()}
          onDiscard={() => {
            setValues(saved);
            setError(null);
          }}
        />
      </div>
      {dialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(next) => {
          if (!next && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description={`You have ${count} unsaved ${count === 1 ? 'change' : 'changes'}. If you leave, they are lost.`}
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => blocker.proceed?.()}
      />
    </>
  );
}
