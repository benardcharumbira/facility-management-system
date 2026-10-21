import { ExternalLink, Lock } from 'lucide-react';
import type { AdminUser } from '@/shared/api';
import { Alert, Section } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';
import { CLERK_DASHBOARD_URL } from '../labels';

const ZONE = 'Africa/Johannesburg';

/**
 * The Clerk profile, read only. Clerk owns who someone is: their name, email address and contact
 * details, their password and their sessions. There is nothing to edit here, on purpose, so the
 * service never holds a second opinion about identity.
 */
export function ProfilePanel({ user }: { user: AdminUser }) {
  const { profile } = user;
  const rows: Array<[string, string]> = [
    ['First name', profile.firstName],
    ['Last name', profile.lastName || 'Not given'],
    ['Email address', profile.email],
    ['Phone', profile.phone ?? 'Not given'],
    ['Signed up', dateAndTime(profile.createdAt, ZONE)],
    ['Last signed in', profile.lastSignInAt ? dateAndTime(profile.lastSignInAt, ZONE) : 'Never'],
  ];
  return (
    <Section title="Profile">
      <div className="flex max-w-2xl flex-col gap-4">
        <Alert severity="info" title="This profile is maintained in Clerk">
          <span className="flex items-start gap-2">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              Name, email address, contact details and passwords are changed there, by the person or
              from the{' '}
              <a
                href={CLERK_DASHBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
              >
                Clerk dashboard
                <ExternalLink aria-hidden className="size-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              . This service only decides what they can do here.
            </span>
          </span>
        </Alert>
        <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([term, value]) => (
            <div key={term} className="min-w-0">
              <dt className="text-sm text-muted">{term}</dt>
              <dd className="m-0 font-medium [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
