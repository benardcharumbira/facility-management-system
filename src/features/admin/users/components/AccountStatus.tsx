import { useState } from 'react';
import { useApiClient, type AdminUser, type UserImpactResult } from '@/shared/api';
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
import { checkUserImpact, deactivateUser, reactivateUser } from '../api';
import { useRefreshAfterUserChange } from '../hooks';
import { StrandedDetails } from './StrandedDetails';

export interface AccountStatusProps {
  user: AdminUser;
  guard: (request: GuardRequest<UserImpactResult>) => Promise<GuardOutcome>;
}

/**
 * Deactivation, never deletion: the person stays in bookings, approvals and the audit trail, and
 * cannot sign in to the service. Asked for by name every time, because the click is the decision,
 * and it says what it strands.
 */
export function AccountStatus({ user, guard }: AccountStatusProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterUserChange();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const active = user.status === 'active';
  const blocked = user.protections.deactivation;

  const deactivate = async () => {
    setError(null);
    setWorking(true);
    try {
      const outcome = await guard({
        check: () => checkUserImpact(api, user.id, { kind: 'deactivate' }),
        apply: async () => {
          await deactivateUser(api, user.id);
        },
        title: `Deactivate ${user.name}?`,
        summary: `${user.name} will no longer be able to use the service. Their bookings, decisions and history are kept, and you can reactivate the account later.`,
        confirmLabel: `Deactivate ${user.name}`,
        requiresConfirmation: () => true,
        details: (impact) => <StrandedDetails name={user.name} impact={impact} />,
      });
      if (outcome === 'applied') {
        await refresh();
        notify(`${user.name} deactivated.`, 'success');
      }
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setWorking(false);
    }
  };

  const reactivate = async () => {
    setError(null);
    setWorking(true);
    try {
      await reactivateUser(api, user.id);
      await refresh();
      notify(
        user.role === 'facility_admin'
          ? `${user.name} reactivated. Their facilities were removed when the account was deactivated, so designate them again.`
          : `${user.name} reactivated.`,
        'success',
      );
    } catch (failure) {
      setError(explain(failure));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Section
      title="Account status"
      description="Whether this person can use the service. This is separate from their Clerk account."
    >
      <div className="flex max-w-2xl flex-col gap-3">
        {error && <Alert severity="error">{error}</Alert>}
        <p className="flex items-center gap-2">
          <Badge tone={active ? 'primary' : 'warning'}>{active ? 'Active' : 'Deactivated'}</Badge>
        </p>
        {blocked && (
          <Alert severity="info" title="This account cannot be deactivated">
            {blocked}
          </Alert>
        )}
        <div>
          {active ? (
            <Button
              variant="danger"
              disabled={Boolean(blocked) || working}
              onClick={() => void deactivate()}
            >
              Deactivate account
            </Button>
          ) : (
            <Button variant="secondary" disabled={working} onClick={() => void reactivate()}>
              Reactivate account
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
