import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LogOut } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useApiClient } from '@/shared/api';
import { BOOKING_ROLES, ROLE_LABELS, useCurrentUser } from '@/shared/auth';
import {
  Alert,
  Badge,
  Button,
  buttonStyles,
  controlStyles,
  ErrorState,
  FormField,
  LoadingState,
  PageLayout,
  Section,
  useSnackbar,
} from '@/shared/components';
import { explain, fieldErrors } from '@/shared/utils/problemMessages';
import { fetchProfile, profileKeys, saveProfile } from '../api';

/**
 * Deliberately small. Clerk owns who you are, so name, email address and whether it is verified
 * are shown and cannot be edited here, with a route into Clerk's own screens. The one thing this
 * service owns is a telephone number the municipality can use to call about a booking.
 */
export default function AccountPage() {
  const current = useCurrentUser();
  if (current.status !== 'ready') return null;
  const { user, signOut, manageAccount } = current;
  return (
    <PageLayout title="Your account">
      <div className="flex max-w-2xl flex-col gap-10">
        <Section title="Your sign-in details">
          <div className="flex flex-col gap-4">
            <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Fact term="Name" value={user.name} />
              <Fact term="Email address" value={user.email} />
              <div>
                <dt className="text-sm text-muted">Email address checked</dt>
                <dd className="m-0 mt-1">
                  <Badge tone={user.emailVerified ? 'primary' : 'warning'}>
                    {user.emailVerified ? 'Verified' : 'Not verified'}
                  </Badge>
                </dd>
              </div>
              <Fact term="Your role" value={ROLE_LABELS[user.role]} />
            </dl>
            <p className="text-muted">
              Your name, email address, password and the devices you are signed in on are looked
              after by Clerk, our sign-in service. They cannot be changed on this page.
            </p>
            <div>
              <Button variant="secondary" onClick={manageAccount}>
                <ExternalLink aria-hidden className="size-4" />
                Manage your sign-in details
              </Button>
            </div>
          </div>
        </Section>

        <TelephoneSection />

        <Section title="Your bookings">
          {BOOKING_ROLES.includes(user.role) ? (
            <Link to="/bookings" className={buttonStyles({ variant: 'secondary' })}>
              Go to my bookings
            </Link>
          ) : (
            <p className="text-muted">Your role does not make booking requests.</p>
          )}
        </Section>

        <div>
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut aria-hidden className="size-4" />
            Sign out
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{term}</dt>
      <dd className="m-0 font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function TelephoneSection() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const id = useId();
  const profile = useQuery({
    queryKey: profileKeys.me(),
    queryFn: ({ signal }) => fetchProfile(api, signal),
  });

  if (profile.isError) {
    return (
      <Section title="Your contact telephone number">
        <ErrorState
          title="We could not load your details"
          problem={profile.error}
          onRetry={() => void profile.refetch()}
        />
      </Section>
    );
  }
  if (!profile.data) {
    return (
      <Section title="Your contact telephone number">
        <LoadingState />
      </Section>
    );
  }
  return (
    <TelephoneForm
      key={profile.data.updatedAt ?? 'never'}
      id={id}
      saved={profile.data.telephone}
      onSave={async (telephone) => {
        const saved = await saveProfile(api, { telephone });
        queryClient.setQueryData(profileKeys.me(), saved);
        notify(
          saved.telephone ? 'Telephone number saved.' : 'Telephone number removed.',
          'success',
        );
      }}
    />
  );
}

function TelephoneForm({
  id,
  saved,
  onSave,
}: {
  id: string;
  saved: string | null;
  onSave: (telephone: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(saved ?? '');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== (saved ?? '');

  const submit = async () => {
    setError(null);
    setFailure(null);
    setSaving(true);
    try {
      await onSave(value.trim() === '' ? null : value.trim());
    } catch (problem) {
      const fields = fieldErrors(problem);
      if (fields.telephone) setError(fields.telephone);
      else setFailure(explain(problem));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Your contact telephone number"
      description="The municipality uses it only to phone you about a booking when email is not enough. It is optional."
    >
      <form
        aria-label="Contact telephone number"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3"
      >
        {failure && (
          <Alert severity="error" title="We could not save your number">
            {failure} Your number has not been changed. Try again in a moment.
          </Alert>
        )}
        <FormField id={`${id}-telephone`} label="Telephone number" error={error ?? undefined}>
          {(control) => (
            <input
              {...control}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${controlStyles} h-10 max-w-sm`}
            />
          )}
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save number'}
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setValue(saved ?? '');
              setError(null);
              setFailure(null);
            }}
          >
            Discard changes
          </Button>
        </div>
      </form>
    </Section>
  );
}
