import { Columns3, Rows3 } from 'lucide-react';
import { useState } from 'react';
import type { AllocationMatrix, AllocationValue, ResourceCategory } from '@/shared/api';
import { DensityProvider, EditableGrid, QuantityStepper } from '@/shared/components';
import { MAX_ALLOCATION } from '@/shared/api';
import {
  copyColumn,
  fillColumn,
  fillRow,
  keyOf,
  valueAt,
  withEdit,
  type Base,
  type Edits,
} from '../allocation';
import { CATEGORY_LABELS } from '../labels';
import { ColumnDialog, FillRowDialog } from './FillDialogs';

type Resource = AllocationMatrix['resources'][number];
type Facility = AllocationMatrix['facilities'][number];

interface AllocationGridProps {
  facilities: Facility[];
  /** Every facility in the matrix, whether shown or not: the source for a copy. */
  allFacilities: Facility[];
  resources: Resource[];
  base: Base;
  edits: Edits;
  onEdits: (edits: Edits) => void;
  open: Record<ResourceCategory, boolean>;
  onToggle: (category: ResourceCategory) => void;
}

/**
 * The facility by resource matrix: resources down, facilities across. A counted cell takes a number
 * and the others a checkbox. Fill applies to what is shown, never to what is filtered out or
 * folded away. Every cell is named by its resource and its facility.
 */
export function AllocationGrid({
  facilities,
  allFacilities,
  resources,
  base,
  edits,
  onEdits,
  open,
  onToggle,
}: AllocationGridProps) {
  const [dialog, setDialog] = useState<
    { kind: 'row'; resource: Resource } | { kind: 'column'; facility: Facility } | null
  >(null);

  const groups = (['venue', 'kitchen'] as const)
    .map((category) => {
      const rows = resources.filter((r) => r.category === category);
      return {
        id: category,
        label: CATEGORY_LABELS[category],
        summary: `${rows.length} ${rows.length === 1 ? 'resource' : 'resources'}`,
        collapsed: !open[category],
        onToggle: () => onToggle(category),
        rows,
      };
    })
    .filter((g) => g.rows.length > 0);

  // What is on screen: the resources in groups that are open.
  const shownResources = groups.filter((g) => !g.collapsed).flatMap((g) => g.rows);
  const set = (facility: Facility, resource: Resource, value: AllocationValue) =>
    onEdits(withEdit(edits, base, facility.id, resource.id, value));

  return (
    <DensityProvider density="compact">
      <EditableGrid
        caption="Resources held by each facility"
        cornerLabel="Resource"
        columns={facilities}
        groups={groups}
        renderColumnHeader={(facility, focus) => (
          <div className="flex flex-col items-start gap-1">
            <span>{facility.name}</span>
            <button
              type="button"
              {...focus}
              onClick={() => setDialog({ kind: 'column', facility })}
              aria-haspopup="dialog"
              aria-label={`Column actions for ${facility.name}`}
              className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline underline-offset-2"
            >
              <Columns3 aria-hidden className="size-3.5" />
              Fill or copy
            </button>
          </div>
        )}
        renderRowHeader={(resource, focus) => (
          <div className="flex items-center justify-between gap-2">
            <span>
              {resource.name}
              <span className="block text-xs font-normal text-muted">
                {resource.quantified ? 'Counted' : 'Available or not'}
              </span>
            </span>
            <button
              type="button"
              {...focus}
              onClick={() => setDialog({ kind: 'row', resource })}
              aria-haspopup="dialog"
              aria-label={`Fill ${resource.name} across the facilities shown`}
              className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline underline-offset-2"
            >
              <Rows3 aria-hidden className="size-3.5" />
              Fill
            </button>
          </div>
        )}
        renderCell={(resource, facility, focus) => {
          const value = valueAt(edits, base, facility.id, resource.id);
          const changed = keyOf(facility.id, resource.id) in edits;
          const was = base.get(keyOf(facility.id, resource.id));
          const name = `${resource.name}, ${facility.name}`;
          const noteId = `changed-${facility.id}-${resource.id}`;
          const note = changed
            ? `Changed from ${typeof was === 'number' ? was : was ? 'available' : 'not available'}`
            : undefined;
          return (
            <span
              data-changed={changed || undefined}
              className={
                changed
                  ? 'inline-flex rounded-md bg-warning-soft p-1 outline-2 outline-warning outline-dashed'
                  : 'inline-flex p-1'
              }
            >
              {resource.quantified ? (
                <QuantityStepper
                  name={resource.name}
                  label={name}
                  value={typeof value === 'number' ? value : 0}
                  min={0}
                  max={MAX_ALLOCATION}
                  inputProps={{ ...focus, 'aria-describedby': note ? noteId : undefined }}
                  onChange={(next) => set(facility, resource, next)}
                />
              ) : (
                <input
                  type="checkbox"
                  {...focus}
                  aria-label={name}
                  aria-describedby={note ? noteId : undefined}
                  checked={value === true}
                  onChange={(event) => set(facility, resource, event.target.checked)}
                  className="size-5"
                />
              )}
              {note && (
                <span id={noteId} className="sr-only">
                  {note}
                </span>
              )}
            </span>
          );
        }}
      />

      {dialog?.kind === 'row' && (
        <FillRowDialog
          resource={dialog.resource}
          facilityCount={facilities.length}
          onClose={() => setDialog(null)}
          onApply={(value) =>
            onEdits(
              fillRow(
                edits,
                base,
                dialog.resource,
                facilities.map((f) => f.id),
                value,
              ),
            )
          }
        />
      )}
      {dialog?.kind === 'column' && (
        <ColumnDialog
          facility={dialog.facility}
          others={allFacilities.filter((f) => f.id !== dialog.facility.id)}
          resourceCount={shownResources.length}
          onClose={() => setDialog(null)}
          onFill={(values) =>
            onEdits(fillColumn(edits, base, dialog.facility.id, shownResources, values))
          }
          onCopy={(from) =>
            onEdits(copyColumn(edits, base, from, dialog.facility.id, shownResources))
          }
        />
      )}
    </DensityProvider>
  );
}
