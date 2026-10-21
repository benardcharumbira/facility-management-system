import { DateTime } from 'luxon';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useApiClient, type AdminBlackout } from '@/shared/api';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  controlStyles,
  DateRangeField,
  EMPTY_DATE_RANGE,
  ErrorState,
  FormField,
  rangeToInstants,
  Section,
  Skeleton,
  useSnackbar,
  type DateRangeValue,
} from '@/shared/components';
import { checkImpact, createBlackout, deleteBlackout } from '../api';
import { explain, fieldErrors } from '../errors';
import { useBlackouts, useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

/** "Sat 12 Dec to Sun 13 Dec", or "Sat 12 Dec, 12:00 to 14:00", in the facility's zone. */
export function describeBlackout(b: AdminBlackout, zone: string): string {
  const start = DateTime.fromISO(b.startsAt, { zone: 'utc' }).setZone(zone).setLocale('en');
  const end = DateTime.fromISO(b.endsAt, { zone: 'utc' }).setZone(zone).setLocale('en');
  const day = (d: DateTime) => d.toFormat('ccc d LLL yyyy');
  if (b.allDay) {
    const last = end.minus({ days: 1 });
    return start.hasSame(last, 'day') ? day(start) : `${day(start)} to ${day(last)}`;
  }
  return start.hasSame(end, 'day')
    ? `${day(start)}, ${start.toFormat('HH:mm')} to ${end.toFormat('HH:mm')}`
    : `${day(start)}, ${start.toFormat('HH:mm')} to ${day(end)}, ${end.toFormat('HH:mm')}`;
}

export function BlackoutsSection({ facility, guard, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const id = useId();
  const blackouts = useBlackouts(facility.id);
  const archived = facility.status === 'archived';
  const zone = facility.timeZone;

  const [range, setRange] = useState<DateRangeValue>(EMPTY_DATE_RANGE);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdminBlackout | null>(null);

  const update = (next: DateRangeValue, text = reason) => {
    setRange(next);
    setReason(text);
    onDirtyChange(next.startDate !== '' || text !== '');
  };

  const create = async () => {
    setErrors({});
    setFormError(null);
    const instants = rangeToInstants(range, zone);
    if (!instants || reason.trim() === '') {
      setErrors({
        ...(instants ? {} : { startsAt: 'Choose the first and last day of the closure.' }),
        ...(reason.trim() === ''
          ? { reason: 'Say why, in a sentence the public will understand.' }
          : {}),
      });
      return;
    }
    const blackout = { ...instants, reason };
    setSaving(true);
    try {
      const outcome = await guard({
        check: () => checkImpact(api, facility.id, { kind: 'blackout', blackout }),
        apply: async () => {
          try {
            await createBlackout(api, facility.id, blackout);
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Add this closure?',
        summary: `${facility.name}${
          facility.children.length > 0 ? ' and the spaces inside it' : ''
        } will be closed for “${reason.trim()}”.`,
        confirmLabel: 'Add the closure',
      });
      if (outcome === 'applied') {
        update(EMPTY_DATE_RANGE, '');
        await refresh();
        notify('Closure added.', 'success');
      }
    } catch (failure) {
      const fields = fieldErrors(failure);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(explain(failure));
    } finally {
      setSaving(false);
    }
  };

  const today = DateTime.now().setZone(zone).toISODate() ?? undefined;
  const list = blackouts.data ?? [];
  const upcoming = list.filter((b) => b.state !== 'past');
  const past = list.filter((b) => b.state === 'past');

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Section
        title="Add a closure"
        description="A closure blocks booking for the days or hours you choose. The public sees the reason on the availability calendar."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          {formError && <Alert severity="error">{formError}</Alert>}
          <DateRangeField
            legend="When"
            value={range}
            onChange={(next) => update(next)}
            startError={errors.startsAt}
            endError={errors.endsAt}
            min={today}
          />
          <FormField
            id={`${id}-reason`}
            label="Reason"
            hint="Shown to the public. Write it as a sentence a resident will understand, for example “Closed while the floor is resurfaced.”"
            error={errors.reason}
            required
          >
            {(control) => (
              <input
                {...control}
                value={reason}
                maxLength={200}
                disabled={archived}
                onChange={(e) => update(range, e.target.value)}
                className={`${controlStyles} h-10`}
              />
            )}
          </FormField>
          <p className="text-sm text-muted">
            {facility.children.length > 0
              ? `A closure on ${facility.name} also applies to the spaces inside it: ${facility.children
                  .map((c) => c.name)
                  .join(', ')}.`
              : 'A closure on a building also applies to every space inside it.'}
          </p>
          <div>
            <Button type="submit" disabled={archived || saving}>
              {saving ? 'Checking…' : 'Add closure'}
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Current and upcoming closures">
        {blackouts.isError ? (
          <ErrorState
            title="We could not load the closures"
            problem={blackouts.error}
            onRetry={() => void blackouts.refetch()}
          />
        ) : !blackouts.data ? (
          <Skeleton className="h-16" />
        ) : upcoming.length === 0 ? (
          <p className="text-muted">There are no current or upcoming closures.</p>
        ) : (
          <ul
            aria-label="Current and upcoming closures"
            className="m-0 flex list-none flex-col gap-2 p-0"
          >
            {upcoming.map((b) => (
              <BlackoutItem key={b.id} blackout={b} zone={zone} onDelete={setDeleting} />
            ))}
          </ul>
        )}
      </Section>

      {past.length > 0 && (
        <Section
          title="Past closures"
          description="These are history. They are kept and cannot be changed."
        >
          <ul aria-label="Past closures" className="m-0 flex list-none flex-col gap-2 p-0">
            {past.map((b) => (
              <BlackoutItem key={b.id} blackout={b} zone={zone} onDelete={setDeleting} />
            ))}
          </ul>
        </Section>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        destructive
        title="Delete this closure?"
        description={
          deleting
            ? `“${deleting.reason}” (${describeBlackout(deleting, zone)}) will be removed and that time can be booked again.`
            : ''
        }
        confirmLabel="Delete closure"
        cancelLabel="Keep it"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBlackout(api, facility.id, deleting.id);
          } catch (failure) {
            throw new Error(explain(failure));
          }
          await refresh();
          notify('Closure deleted.', 'success');
        }}
      />
    </div>
  );
}

function BlackoutItem({
  blackout,
  zone,
  onDelete,
}: {
  blackout: AdminBlackout;
  zone: string;
  onDelete: (blackout: AdminBlackout) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-surface p-3">
      <div className="min-w-0">
        <p className="font-medium [overflow-wrap:anywhere]">{blackout.reason}</p>
        <p className="text-sm text-muted">{describeBlackout(blackout, zone)}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {blackout.state === 'current' && <Badge tone="warning">In effect now</Badge>}
          {blackout.inheritedFrom && (
            <Badge>
              Set on{' '}
              <Link
                to={`/admin/facilities/${encodeURIComponent(blackout.inheritedFrom.id)}?section=blackouts`}
                className="ml-1 underline"
              >
                {blackout.inheritedFrom.name}
              </Link>
            </Badge>
          )}
        </div>
      </div>
      {blackout.state === 'future' && !blackout.inheritedFrom && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onDelete(blackout)}
          aria-label={`Delete closure: ${blackout.reason}`}
        >
          Delete
        </Button>
      )}
    </li>
  );
}
