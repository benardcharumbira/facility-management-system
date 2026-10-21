import { ShieldAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { useApiClient, type AdminUser, type UserImpactResult } from '@/shared/api';
import { ROLES } from '@/shared/auth';
import {
  Alert,
  Badge,
  Button,
  Section,
  useSnackbar,
  type GuardOutcome,
  type GuardRequest,
} from '@/shared/components';
import { explain } from '../../facilities/errors';
import { checkUserImpact, saveDesignations } from '../api';
import { useRefreshAfterUserChange } from '../hooks';
import { StrandedDetails, strandsAnything } from './StrandedDetails';

export interface DesignationEditorProps {
  user: AdminUser;
  guard: (request: GuardRequest<UserImpactResult>) => Promise<GuardOutcome>;
  onDirtyChange: (dirty: boolean) => void;
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * The facilities a facility administrator approves for. It is the relationship the facility
 * screen edits from the other side: both write one record, so they cannot disagree.
 */
export function DesignationEditor({ user, guard, onDirtyChange }: DesignationEditorProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterUserChange();
  const id = useId();
  const saved = user.facilities.map((f) => f.id);
  const [chosen, setChosen] = useState<string[]>(saved);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = !sameSet(chosen, saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (user.role !== ROLES.facilityAdmin) {
    return (
      <Section
        title="Facilities"
        description="Only a facility administrator is designated against facilities, to approve the requests for them."
      />
    );
  }
  const inactive = user.status === 'deactivated';

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const outcome = await guard({
        check: () => checkUserImpact(api, user.id, { kind: 'facilities', facilityIds: chosen }),
        apply: async () => {
          await saveDesignations(api, user.id, chosen);
        },
        title: `Change the facilities ${user.name} approves for?`,
        summary: `${user.name} would approve for ${chosen.length === 1 ? '1 facility' : `${chosen.length} facilities`}.`,
        confirmLabel: 'Save facilities',
        requiresConfirmation: strandsAnything,
        details: (impact) => <StrandedDetails name={user.name} impact={impact} />,
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Facilities saved.', 'success');
      }
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Facilities"
      description="The facilities this person approves requests for. Each appears in their Approvals queue. The facility screen edits the same designation."
    >
      <div className="flex max-w-2xl flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        {saved.length === 0 && !inactive && (
          <Alert severity="warning" title="Designated against no facilities">
            They can sign in as a facility administrator but approve nothing. Designate them below,
            or take the role away if it is not needed.
          </Alert>
        )}
        {inactive && (
          <Alert severity="info">
            A deactivated account is not designated for anything. Reactivate it first, then choose
            facilities.
          </Alert>
        )}
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" disabled={inactive || saving}>
          <legend className="mb-1 text-sm font-medium">Approves requests for</legend>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {user.assignableFacilities.map((facility) => (
              <li key={facility.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-sunken">
                  <input
                    type="checkbox"
                    id={`${id}-${facility.id}`}
                    checked={chosen.includes(facility.id)}
                    onChange={(event) =>
                      setChosen(
                        event.target.checked
                          ? [...chosen, facility.id]
                          : chosen.filter((x) => x !== facility.id),
                      )
                    }
                    className="size-5 accent-primary"
                  />
                  <span>{facility.name}</span>
                  {facility.status === 'unavailable' && <Badge tone="warning">Unavailable</Badge>}
                </label>
                <Link
                  to={`/admin/facilities/${encodeURIComponent(facility.id)}?section=approvers`}
                  aria-label={`Approvers of ${facility.name}`}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  See its approvers
                </Link>
              </li>
            ))}
          </ul>
        </fieldset>
        {chosen.length === 0 && saved.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <ShieldAlert aria-hidden className="size-4" />
            Saving this removes every designation.
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={!dirty || saving || inactive} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save facilities'}
          </Button>
          <Button variant="secondary" disabled={!dirty || saving} onClick={() => setChosen(saved)}>
            Discard changes
          </Button>
        </div>
      </div>
    </Section>
  );
}
