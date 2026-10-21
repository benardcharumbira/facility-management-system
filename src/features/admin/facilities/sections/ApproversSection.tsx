import { ShieldAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useApiClient, type Approver } from '@/shared/api';
import { Alert, Button, controlStyles, FormField, Section, useSnackbar } from '@/shared/components';
import { saveApprovers } from '../api';
import { explain } from '../errors';
import { useApproverCandidates, useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

export function ApproversSection({ facility, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const id = useId();
  const candidates = useApproverCandidates();
  const archived = facility.status === 'archived';
  const initial = facility.approvers.map((a) => a.id);

  const [chosen, setChosen] = useState<Approver[]>(facility.approvers);
  const [picked, setPicked] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(chosen.map((a) => a.id)) !== JSON.stringify(initial);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const available = (candidates.data ?? []).filter((c) => !chosen.some((a) => a.id === c.id));
  const wouldBeEmpty = chosen.length === 0;
  const blocked = wouldBeEmpty && facility.status === 'active';

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await saveApprovers(
        api,
        facility.id,
        chosen.map((a) => a.id),
      );
      await refresh();
      notify('Approvers saved.', 'success');
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Approvers"
      description="The people who decide booking requests for this facility. Each sees its requests in their Approvals queue."
    >
      <div className="flex max-w-2xl flex-col gap-5">
        {error && <Alert severity="error">{error}</Alert>}

        {chosen.length === 0 ? (
          <p className="flex items-center gap-2 text-muted">
            <ShieldAlert aria-hidden className="size-5 text-danger" />
            No approvers are designated.
          </p>
        ) : (
          <ul aria-label="Approvers" className="m-0 flex list-none flex-col gap-2 p-0">
            {chosen.map((approver) => (
              <li
                key={approver.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{approver.name}</p>
                  <p className="text-sm [overflow-wrap:anywhere] text-muted">{approver.email}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={archived}
                  aria-label={`Remove ${approver.name}`}
                  onClick={() => setChosen(chosen.filter((a) => a.id !== approver.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <FormField id={`${id}-add`} label="Add an approver" className="min-w-56 flex-1">
            {(control) => (
              <select
                {...control}
                value={picked}
                disabled={archived || available.length === 0}
                onChange={(e) => setPicked(e.target.value)}
                className={`${controlStyles} h-10`}
              >
                <option value="">
                  {available.length === 0
                    ? 'Everyone eligible is already added'
                    : 'Choose a person'}
                </option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <Button
            variant="secondary"
            disabled={picked === ''}
            onClick={() => {
              const person = candidates.data?.find((c) => c.id === picked);
              if (person) setChosen([...chosen, person]);
              setPicked('');
            }}
          >
            Add approver
          </Button>
        </div>

        {blocked && (
          <Alert severity="warning">
            An active facility needs at least one approver. Add someone first, or make the facility
            unavailable.
          </Alert>
        )}

        <div className="flex gap-2">
          <Button disabled={archived || !dirty || saving || blocked} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save approvers'}
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => setChosen(facility.approvers)}
          >
            Discard changes
          </Button>
        </div>
      </div>
    </Section>
  );
}
