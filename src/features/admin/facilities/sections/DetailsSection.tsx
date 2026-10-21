import { useEffect, useState } from 'react';
import { useApiClient, type ImpactResult } from '@/shared/api';
import { Alert, ArchiveConfirm, Button, Section, useSnackbar } from '@/shared/components';
import { archiveFacility, checkImpact, updateFacility } from '../api';
import { DetailsForm, detailsOf, validateDetails } from '../components/DetailsForm';
import { explain, failureMessage, fieldErrors } from '../errors';
import { useFacilityTypes, useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

export function DetailsSection({ facility, guard, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const types = useFacilityTypes();
  const initial = detailsOf(facility);
  const archived = facility.status === 'archived';

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState<ImpactResult | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    const problems = validateDetails(values);
    if (values.status === 'active' && facility.approvers.length === 0) {
      problems.status =
        'Designate at least one approver (see Approvers) before activating this facility. Until then requests for it would reach nobody.';
    }
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;

    setSaving(true);
    try {
      const statusChanged = values.status !== initial.status;
      const outcome = await guard({
        check: () =>
          checkImpact(
            api,
            facility.id,
            statusChanged ? { kind: 'status', status: values.status } : { kind: 'details' },
          ),
        apply: async () => {
          try {
            await updateFacility(api, facility.id, {
              name: values.name,
              code: values.code,
              typeId: values.typeId,
              locality: values.locality,
              shortDescription: values.shortDescription,
              description: values.description,
              status: values.status,
            });
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: `Make ${facility.name} unavailable?`,
        summary: `${facility.name} will stop taking new bookings.`,
        confirmLabel: 'Make unavailable',
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Details saved.', 'success');
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
    checkImpact(api, facility.id, { kind: 'archive' }).then(
      setArchiveImpact,
      (failure: unknown) => {
        setArchiveOpen(false);
        setFormError(failureMessage(failure));
      },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <Section title="Details">
        <form
          className="flex max-w-2xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {formError && <Alert severity="error">{formError}</Alert>}
          <DetailsForm
            values={values}
            onChange={setValues}
            types={types.data}
            errors={errors}
            disabled={archived}
            status={{
              hint:
                facility.approvers.length === 0
                  ? 'This facility has no approver, so it cannot be active yet.'
                  : 'Making it unavailable stops new bookings and names any upcoming bookings it affects first.',
            }}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={archived || !dirty || saving}>
              {saving ? 'Saving…' : 'Save details'}
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

      {!archived && (
        <Section
          title="Archive"
          description="Facilities carry booking history, so they are archived, not deleted. An archived facility leaves the public estate and cannot be booked, and can be restored."
        >
          <Button variant="secondary" onClick={startArchive}>
            Archive {facility.name}
          </Button>
          <ArchiveConfirm
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            facilityName={facility.name}
            impact={archiveImpact}
            onConfirm={async () => {
              try {
                await archiveFacility(api, facility.id);
              } catch (failure) {
                throw new Error(explain(failure));
              }
              await refresh();
              notify(`${facility.name} archived.`, 'success');
            }}
          />
        </Section>
      )}
    </div>
  );
}
