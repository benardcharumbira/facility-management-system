import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiClient } from '@/shared/api';
import {
  Alert,
  Button,
  DetailHeader,
  Section,
  usePageHeader,
  useSnackbar,
} from '@/shared/components';
import { failureMessage, fieldErrors } from '../facilities/errors';
import { createResource } from '../resources/api';
import {
  EMPTY_RESOURCE,
  ResourceForm,
  validateResource,
  type ResourceValues,
} from '../resources/components/ResourceForm';
import { useRefreshAfterResourceChange } from '../resources/hooks';

export default function AdminResourceNewPage() {
  usePageHeader('Create resource');
  const api = useApiClient();
  const navigate = useNavigate();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterResourceChange();
  const [values, setValues] = useState<ResourceValues>(EMPTY_RESOURCE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problems = validateResource(values);
    setErrors(problems);
    setFormError(null);
    if (Object.keys(problems).length > 0) return;
    setSaving(true);
    try {
      const created = await createResource(api, {
        ...values,
        description: values.description.trim() === '' ? null : values.description,
      });
      await refresh();
      notify(`${created.name} added to the catalogue. No facility holds one yet.`, 'success');
      void navigate(`/admin/resources/${encodeURIComponent(created.id)}`);
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
        breadcrumbs={[{ label: 'Resources', to: '/admin/resources' }, { label: 'Create' }]}
        back={{ label: 'Back to the catalogue', to: '/admin/resources' }}
        title="Create resource"
      />
      <Section
        title="Details"
        description="This adds a kind of resource to the catalogue. It does not give any facility one: do that in the allocation grid afterwards."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {formError && <Alert severity="error">{formError}</Alert>}
          <ResourceForm values={values} onChange={setValues} errors={errors} />
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create resource'}
            </Button>
            <Button variant="secondary" onClick={() => void navigate('/admin/resources')}>
              Cancel
            </Button>
          </div>
        </form>
      </Section>
    </>
  );
}
