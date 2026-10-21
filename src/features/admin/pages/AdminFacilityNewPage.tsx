import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiClient } from '@/shared/api';
import {
  Alert,
  Button,
  DetailHeader,
  Section,
  useSnackbar,
  usePageHeader,
} from '@/shared/components';
import { createFacility } from '../facilities/api';
import {
  DetailsForm,
  EMPTY_DETAILS,
  validateDetails,
  type DetailsValues,
} from '../facilities/components/DetailsForm';
import { failureMessage, fieldErrors } from '../facilities/errors';
import { useAdminFacilities, useFacilityTypes, useRefreshAfterChange } from '../facilities/hooks';

export default function AdminFacilityNewPage() {
  usePageHeader('Create facility');
  const api = useApiClient();
  const navigate = useNavigate();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const types = useFacilityTypes();
  const parents = useAdminFacilities({
    status: ['active', 'unavailable'],
    sort: 'name',
    pageSize: 100,
  });

  const [values, setValues] = useState<DetailsValues>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problems = validateDetails(values);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;
    setSaving(true);
    try {
      const created = await createFacility(api, {
        name: values.name,
        code: values.code,
        typeId: values.typeId,
        locality: values.locality,
        shortDescription: values.shortDescription,
        description: values.description,
        parentFacilityId: values.parentFacilityId,
      });
      await refresh();
      notify(`${created.name} created. It is unavailable until it has an approver.`, 'success');
      void navigate(`/admin/facilities/${encodeURIComponent(created.id)}?section=approvers`);
    } catch (failure) {
      const fields = fieldErrors(failure);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(failureMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DetailHeader
        breadcrumbs={[{ label: 'Manage facilities', to: '/admin/facilities' }, { label: 'Create' }]}
        back={{ label: 'Back to facilities', to: '/admin/facilities' }}
        title="Create facility"
      />
      <div className="max-w-2xl">
        <Section
          title="Details"
          description="You can add the images, hours, closures, capacity and approvers once it exists. A new facility starts unavailable, because nobody approves for it yet."
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {formError && <Alert severity="error">{formError}</Alert>}
            <DetailsForm
              values={values}
              onChange={setValues}
              types={types.data}
              errors={errors}
              parent={{
                eligible: (parents.data?.items ?? []).map((f) => ({ id: f.id, name: f.name })),
              }}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create facility'}
              </Button>
              <Button variant="secondary" onClick={() => void navigate('/admin/facilities')}>
                Cancel
              </Button>
            </div>
          </form>
        </Section>
      </div>
    </>
  );
}
