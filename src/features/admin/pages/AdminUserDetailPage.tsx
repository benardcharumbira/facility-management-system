import { useState } from 'react';
import { useBlocker, useParams } from 'react-router';
import { isApiProblem, type AdminUser } from '@/shared/api';
import { ROLE_LABELS } from '@/shared/auth';
import {
  Badge,
  ConfirmDialog,
  DetailHeader,
  DetailSkeleton,
  ErrorState,
  NotFoundState,
  useImpactGuard,
  usePageHeader,
} from '@/shared/components';
import { useOriginList } from '@/shared/hooks';
import { AccountStatus } from '../users/components/AccountStatus';
import { DesignationEditor } from '../users/components/DesignationEditor';
import { ProfilePanel } from '../users/components/ProfilePanel';
import { RoleAssignment } from '../users/components/RoleAssignment';
import { UserHistory } from '../users/components/UserHistory';
import { useUser } from '../users/hooks';

export default function AdminUserDetailPage() {
  const { id = '' } = useParams();
  const fromList = useOriginList();
  const user = useUser(id);
  const listTo = `/admin/users${fromList}`;

  if (user.isError) {
    const missing = isApiProblem(user.error) && user.error.status === 404;
    return (
      <Failed
        missing={missing}
        listTo={listTo}
        error={user.error}
        onRetry={() => void user.refetch()}
      />
    );
  }
  if (!user.data) return <Loading />;
  return <Loaded user={user.data} listTo={listTo} />;
}

function Loading() {
  usePageHeader('User');
  return <DetailSkeleton />;
}

function Failed({
  missing,
  listTo,
  error,
  onRetry,
}: {
  missing: boolean;
  listTo: string;
  error: unknown;
  onRetry: () => void;
}) {
  usePageHeader(missing ? 'User not found' : 'User');
  return (
    <>
      <DetailHeader
        title={missing ? 'User not found' : 'User'}
        breadcrumbs={[{ label: 'Users', to: listTo }, { label: missing ? 'Not found' : 'Error' }]}
      />
      {missing ? (
        <NotFoundState
          title="We could not find that user"
          description="The link may be wrong."
          action={{ label: 'Back to users', to: listTo }}
        />
      ) : (
        <ErrorState title="We could not load this user" problem={error} onRetry={onRetry} />
      )}
    </>
  );
}

function Loaded({ user, listTo }: { user: AdminUser; listTo: string }) {
  usePageHeader(user.name, [{ label: 'Users', to: listTo }, { label: user.name }]);
  const { guard, dialog } = useImpactGuard();
  const [roleDirty, setRoleDirty] = useState(false);
  const [facilitiesDirty, setFacilitiesDirty] = useState(false);
  const dirty = roleDirty || facilitiesDirty;

  // Leaving with an unsaved choice is confirmed: what is chosen here decides what someone can do.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  // An editor starts afresh when what it edits has changed underneath it.
  const fresh = JSON.stringify([user.role, user.status, user.facilities.map((f) => f.id)]);

  return (
    <>
      <DetailHeader
        breadcrumbs={[{ label: 'Users', to: listTo }, { label: user.name }]}
        back={{ label: 'Back to users', to: listTo }}
        title={user.name}
        status={
          <Badge tone={user.status === 'active' ? 'primary' : 'warning'}>
            {user.status === 'active' ? 'Active' : 'Deactivated'}
          </Badge>
        }
        subtitle={
          <>
            {user.profile.email} · {ROLE_LABELS[user.role]}
          </>
        }
      />
      <div className="flex flex-col gap-10">
        <ProfilePanel user={user} />
        <RoleAssignment
          key={`role:${fresh}`}
          user={user}
          guard={guard}
          onDirtyChange={setRoleDirty}
        />
        <DesignationEditor
          key={`designation:${fresh}`}
          user={user}
          guard={guard}
          onDirtyChange={setFacilitiesDirty}
        />
        <AccountStatus user={user} guard={guard} />
        <UserHistory userId={user.id} />
      </div>

      {dialog}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description="You have chosen changes that have not been saved. If you leave, they are lost."
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => {
          setRoleDirty(false);
          setFacilitiesDirty(false);
          blocker.proceed?.();
        }}
      />
    </>
  );
}
