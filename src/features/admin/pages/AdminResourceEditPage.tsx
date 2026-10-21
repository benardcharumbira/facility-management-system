import { useEffect, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import {
  isApiProblem,
  useApiClient,
  type AdminResource,
  type ImpactResult,
  type ResourceImpactResult,
} from '@/shared/api';
import {
  Alert,
  ArchiveConfirm,
  Badge,
  Button,
  ConfirmDialog,
  DetailHeader,
  DetailSkeleton,
  ErrorState,
  NotFoundState,
  Section,
  useImpactGuard,
  usePageHeader,
  useSnackbar,
} from '@/shared/components';
import { explain, failureMessage, fieldErrors } from '../facilities/errors';
import {
  archiveResource,
  checkResourceImpact,
  restoreResource,
  updateResource,
} from '../resources/api';
import {
  ResourceForm,
  validateResource,
  type ResourceValues,
} from '../resources/components/ResourceForm';
import { useRefreshAfterResourceChange, useResource } from '../resources/hooks';
import { CATEGORY_LABELS } from '../resources/labels';

export default function AdminResourceEditPage() {
  const { id = '' } = useParams();
  const resource = useResource(id);

  if (resource.isError) {
    const missing = isApiProblem(resource.error) && resource.error.status === 404;
    return (
      <Failed missing={missing} error={resource.error} onRetry={() => void resource.refetch()} />
    );
  }
  if (!resource.data) return <Loading />;
  // A fresh copy of the form whenever what is saved changes.
  return (
    <Loaded
      key={JSON.stringify([
        resource.data.name,
        resource.data.category,
        resource.data.quantified,
        resource.data.description,
        resource.data.status,
      ])}
      resource={resource.data}
    />
  );
}

function Loading() {
  usePageHeader('Resource');
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
  usePageHeader(missing ? 'Resource not found' : 'Resource');
  return (
    <>
      <DetailHeader
        title={missing ? 'Resource not found' : 'Resource'}
        breadcrumbs={[
          { label: 'Resources', to: '/admin/resources' },
          { label: missing ? 'Not found' : 'Error' },
        ]}
      />
      {missing ? (
        <NotFoundState
          title="We could not find that resource"
          description="It may have been removed, or the link may be wrong."
          action={{ label: 'Back to the catalogue', to: '/admin/resources' }}
        />
      ) : (
        <ErrorState title="We could not load this resource" problem={error} onRetry={onRetry} />
      )}
    </>
  );
}

const valuesOf = (r: AdminResource): ResourceValues => ({
  name: r.name,
  category: r.category,
  quantified: r.quantified,
  description: r.description ?? '',
});

function Loaded({ resource }: { resource: AdminResource }) {
  usePageHeader(resource.name, [
    { label: 'Resources', to: '/admin/resources' },
    { label: resource.name },
  ]);
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterResourceChange();
  const { guard, dialog } = useImpactGuard();
  const archived = resource.status === 'archived';
  const initial = valuesOf(resource);

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState<ImpactResult | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    const problems = validateResource(values);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;
    setSaving(true);
    const flagChanged = values.quantified !== initial.quantified;
    try {
      const outcome = await guard<ResourceImpactResult>({
        check: () =>
          checkResourceImpact(
            api,
            resource.id,
            flagChanged
              ? { kind: 'quantified', quantified: values.quantified }
              : { kind: 'details' },
          ),
        apply: async () => {
          try {
            await updateResource(api, resource.id, {
              name: values.name,
              category: values.category,
              quantified: values.quantified,
              description: values.description.trim() === '' ? null : values.description,
            });
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        // Changing how it is recorded overwrites what facilities hold, so it always asks.
        requiresConfirmation: (impact) =>
          impact.totalAffected > 0 || impact.allocationsAffected > 0,
        title: values.quantified
          ? `Count ${resource.name} instead?`
          : `Stop counting ${resource.name}?`,
        summary: values.quantified
          ? `${resource.name} will be recorded as a number at each facility, instead of available or not.`
          : `${resource.name} will be recorded as available or not at each facility, instead of a number.`,
        details: (impact) =>
          values.quantified ? (
            <p className="rounded-md border border-warning-line bg-warning-soft p-3 font-medium text-ink">
              Every facility will be left holding none. {impact.facilitiesAffected}{' '}
              {impact.facilitiesAffected === 1 ? 'facility' : 'facilities'} that have it now will
              each need a number entered again.
            </p>
          ) : (
            <p className="rounded-md border border-warning-line bg-warning-soft p-3 font-medium text-ink">
              The numbers held at {impact.facilitiesAffected}{' '}
              {impact.facilitiesAffected === 1 ? 'facility' : 'facilities'} will be discarded and
              cannot be recovered. A facility that held any is left marked available.
            </p>
          ),
        confirmLabel: values.quantified
          ? 'Count it, and reset to none'
          : 'Stop counting, and discard the numbers',
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Resource saved.', 'success');
      }
    } catch (failure) {
      const fields = fieldErrors(failure);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(failureMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  const startArchive = () => {
    setArchiveImpact(null);
    setArchiveOpen(true);
    checkResourceImpact(api, resource.id, { kind: 'archive' }).then(
      setArchiveImpact,
      (failure: unknown) => {
        setArchiveOpen(false);
        setFormError(failureMessage(failure));
      },
    );
  };

  return (
    <>
      <DetailHeader
        breadcrumbs={[{ label: 'Resources', to: '/admin/resources' }, { label: resource.name }]}
        back={{ label: 'Back to the catalogue', to: '/admin/resources' }}
        title={resource.name}
        status={
          <Badge tone={archived ? 'warning' : 'primary'}>{archived ? 'Archived' : 'Active'}</Badge>
        }
        subtitle={`${CATEGORY_LABELS[resource.category]} · ${
          resource.quantified ? 'Counted' : 'Available or not'
        } · ${
          resource.facilitiesHolding === 1
            ? 'held by 1 facility'
            : `held by ${resource.facilitiesHolding} facilities`
        }`}
      >
        {archived && (
          <Alert
            severity="info"
            title="This resource is archived"
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  void restoreResource(api, resource.id).then(
                    async () => {
                      await refresh();
                      notify(`${resource.name} restored.`, 'success');
                    },
                    (failure: unknown) => notify(explain(failure), 'error'),
                  )
                }
              >
                Restore
              </Button>
            }
          >
            It cannot be requested and is not in the allocation grid. The bookings that asked for it
            keep it. Restoring brings it, and what facilities held of it, back.
          </Alert>
        )}
      </DetailHeader>

      <div className="flex flex-col gap-8">
        <Section title="Details">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {formError && <Alert severity="error">{formError}</Alert>}
            <ResourceForm
              values={values}
              onChange={setValues}
              errors={errors}
              disabled={archived}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={archived || !dirty || saving}>
                {saving ? 'Saving…' : 'Save resource'}
              </Button>
              <Button
                variant="secondary"
                disabled={!dirty || saving}
                onClick={() => {
                  setValues(initial);
                  setErrors({});
                }}
              >
                Discard changes
              </Button>
            </div>
          </form>
        </Section>

        <Section
          title="Held by"
          description="This is the allocation: what each facility holds. Change it in the grid or on the facility's own page."
        >
          {resource.holders.length === 0 ? (
            <p className="text-muted">No facility holds this resource.</p>
          ) : (
            <ul
              aria-label="Facilities that hold this resource"
              className="m-0 flex list-none flex-col gap-1 p-0"
            >
              {resource.holders.map((holder) => (
                <li key={holder.facility.id} className="flex flex-wrap gap-x-3">
                  <Link
                    to={`/admin/facilities/${encodeURIComponent(holder.facility.id)}/resources`}
                    className="text-primary underline underline-offset-2"
                  >
                    {holder.facility.name}
                  </Link>
                  <span className="text-muted">
                    {typeof holder.value === 'number' ? holder.value : 'Available'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3">
            <Link
              to="/admin/resources/allocation"
              className="text-primary underline underline-offset-2"
            >
              Open the allocation grid
            </Link>
          </p>
        </Section>

        {!archived && (
          <Section
            title="Archive"
            description="Resources appear in earlier bookings, so they are archived, not deleted. An archived resource cannot be requested and leaves the allocation grid, and can be restored."
          >
            <Button variant="secondary" onClick={startArchive}>
              Archive {resource.name}
            </Button>
          </Section>
        )}
      </div>

      <ArchiveConfirm
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        facilityName={resource.name}
        description={`${resource.name} will no longer be offered on the booking form, at any facility or in the allocation grid. Its history, and the bookings that asked for it, are kept, and you can restore it later.`}
        impact={archiveImpact}
        onConfirm={async () => {
          try {
            await archiveResource(api, resource.id);
          } catch (failure) {
            throw new Error(explain(failure));
          }
          await refresh();
          notify(`${resource.name} archived.`, 'success');
        }}
      />
      {dialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description="You have changes that have not been saved. If you leave, they are lost."
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => blocker.proceed?.()}
      />
    </>
  );
}
