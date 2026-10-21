import { useEffect, useId, useState } from 'react';
import { isGrant, useApiClient, type AdminUser, type UserImpactResult } from '@/shared/api';
import { ROLE_LABELS, ROLES, type Role } from '@/shared/auth';
import {
  Alert,
  Button,
  Section,
  useSnackbar,
  type GuardOutcome,
  type GuardRequest,
} from '@/shared/components';
import { explain } from '../../facilities/errors';
import { changeRole, checkUserImpact } from '../api';
import { useRefreshAfterUserChange } from '../hooks';
import { ROLE_SUMMARY, withArticle } from '../labels';
import { PermissionConfirmDialog } from './PermissionConfirmDialog';
import { StrandedDetails, strandsAnything } from './StrandedDetails';

const ORDER: Role[] = [ROLES.applicant, ROLES.internal, ROLES.facilityAdmin, ROLES.systemAdmin];

export interface RoleAssignmentProps {
  user: AdminUser;
  guard: (request: GuardRequest<UserImpactResult>) => Promise<GuardOutcome>;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * The role, chosen and then saved on purpose. Choosing changes nothing: a grant is confirmed
 * against what the role permits; taking a role away runs the impact check and says which
 * facilities and requests it strands before it is saved. What the server will not allow, it
 * says in advance and the choice is not offered.
 */
export function RoleAssignment({ user, guard, onDirtyChange }: RoleAssignmentProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterUserChange();
  const group = useId();
  const [selected, setSelected] = useState<Role>(user.role);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const blocked = user.protections.role;
  const changed = selected !== user.role;
  useEffect(() => onDirtyChange(changed), [changed, onDirtyChange]);
  // Nobody can lose the system administrator role here when it is not allowed.
  const offered = (role: Role) => !(blocked && role !== user.role);

  const finish = async (role: Role) => {
    await refresh();
    const dropped = user.role === ROLES.facilityAdmin && role !== ROLES.facilityAdmin;
    notify(
      `${user.name} is now ${withArticle(ROLE_LABELS[role])}.${dropped && user.facilities.length > 0 ? ` They were removed from ${user.facilities.length === 1 ? '1 facility' : `${user.facilities.length} facilities`}.` : ''}`,
      'success',
    );
  };

  const save = async () => {
    setError(null);
    if (isGrant(user.role, selected)) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      const outcome = await guard({
        check: () => checkUserImpact(api, user.id, { kind: 'role', role: selected }),
        apply: async () => {
          await changeRole(api, user.id, { role: selected });
        },
        title: `Make ${user.name} ${withArticle(ROLE_LABELS[selected])}?`,
        summary: `${user.name} is ${withArticle(ROLE_LABELS[user.role])} now. They would lose what that role permits and keep only what ${ROLE_LABELS[selected].toLowerCase()} permits.`,
        confirmLabel: `Make ${user.name} ${withArticle(ROLE_LABELS[selected])}`,
        requiresConfirmation: strandsAnything,
        details: (impact) => <StrandedDetails name={user.name} impact={impact} />,
      });
      if (outcome === 'applied') await finish(selected);
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Role"
      description="What this person can do in the service. Choosing a role changes nothing until you save it."
    >
      <div className="flex max-w-2xl flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}
        {user.status === 'deactivated' && (
          <Alert severity="info">
            This account is deactivated, so the role has no effect until it is reactivated.
          </Alert>
        )}
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Role</legend>
          {ORDER.map((role) => (
            <div
              key={role}
              className="rounded-md border border-line bg-surface p-3 has-[:checked]:border-primary has-[:disabled]:opacity-60"
            >
              <label className="flex items-center gap-3 font-medium">
                <input
                  type="radio"
                  name={group}
                  value={role}
                  checked={selected === role}
                  disabled={!offered(role) || saving}
                  aria-describedby={`${group}-${role}`}
                  onChange={() => setSelected(role)}
                />
                {role === user.role ? `${ROLE_LABELS[role]} (current)` : ROLE_LABELS[role]}
              </label>
              <p id={`${group}-${role}`} className="mt-1 pl-7 text-sm text-muted">
                {ROLE_SUMMARY[role]}
              </p>
            </div>
          ))}
        </fieldset>
        {blocked && (
          <Alert severity="info" title="This role cannot be changed here">
            {blocked}
          </Alert>
        )}
        <div className="flex gap-2">
          <Button disabled={!changed || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Change role'}
          </Button>
          <Button
            variant="secondary"
            disabled={!changed || saving}
            onClick={() => setSelected(user.role)}
          >
            Discard
          </Button>
        </div>
      </div>
      <PermissionConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        name={user.name}
        from={user.role}
        to={selected}
        onConfirm={async () => {
          await changeRole(api, user.id, { role: selected, confirmGrant: true });
          await finish(selected);
        }}
      />
    </Section>
  );
}
