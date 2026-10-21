import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApiClient } from '@/shared/api';
import { Button, HierarchySelect, Section, useSnackbar } from '@/shared/components';
import { checkImpact, updateFacility } from '../api';
import { explain, fieldErrors } from '../errors';
import { useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

export function HierarchySection({ facility, guard, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const initial = facility.parentFacility?.id ?? null;
  const archived = facility.status === 'archived';
  const [parent, setParent] = useState<string | null>(initial);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const dirty = parent !== initial;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const target = facility.eligibleParents.find((p) => p.id === parent);

  const save = async () => {
    setError(undefined);
    setSaving(true);
    try {
      const outcome = await guard({
        check: () => checkImpact(api, facility.id, { kind: 'hierarchy', parentFacilityId: parent }),
        apply: async () => {
          try {
            await updateFacility(api, facility.id, { parentFacilityId: parent });
          } catch (failure) {
            throw new Error(explain(failure));
          }
        },
        title: 'Change where this facility sits?',
        summary: target
          ? `${facility.name} will become part of ${target.name}. Booking either will block the other.`
          : `${facility.name} will no longer be part of ${facility.parentFacility?.name ?? 'a larger facility'}, so they will no longer block each other.`,
        confirmLabel: 'Change the hierarchy',
      });
      if (outcome === 'applied') {
        await refresh();
        notify('Hierarchy saved.', 'success');
      }
    } catch (failure) {
      setError(fieldErrors(failure).parentFacilityId ?? explain(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Section title="Hierarchy">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-md border border-primary-line bg-primary-soft p-3">
            <Layers aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
            <p>
              <strong>How containment works.</strong> Booking a parent facility blocks every space
              inside it, and booking any space inside blocks the parent. Two spaces inside the same
              parent do not block each other. Changing where a facility sits changes what blocks
              what, including for bookings that already exist.
            </p>
          </div>
          <HierarchySelect
            label="Part of"
            value={parent}
            eligible={facility.eligibleParents}
            error={error}
            disabled={archived}
            hint="Only facilities this one can sit inside are listed. A facility cannot be placed inside itself or inside a space within it."
            onChange={setParent}
          />
          <div className="flex gap-2">
            <Button disabled={archived || !dirty || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save hierarchy'}
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || saving}
              onClick={() => setParent(initial)}
            >
              Discard changes
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title="Spaces inside"
        description={
          facility.children.length === 0
            ? `Nothing is inside ${facility.name}. To place a space inside it, open that space and choose ${facility.name} as the facility it is part of.`
            : `These spaces are part of ${facility.name}.`
        }
      >
        {facility.children.length > 0 && (
          <ul aria-label="Spaces inside" className="m-0 flex list-none flex-col gap-1 p-0">
            {facility.children.map((child) => (
              <li key={child.id}>
                <Link
                  to={`/admin/facilities/${encodeURIComponent(child.id)}`}
                  className="text-primary underline underline-offset-2"
                >
                  {child.name}
                </Link>
                {child.status === 'archived' && <span className="text-muted"> (archived)</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
