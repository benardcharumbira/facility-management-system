import { useFormContext } from 'react-hook-form';
import type { BookingOptions, BookingResourceOption, FacilityDetail } from '@/shared/api';
import {
  CheckboxField,
  Disclosure,
  FieldGroup,
  QuantityStepper,
  Skeleton,
} from '@/shared/components';
import { fieldId, type BookingFormValues } from '../schema';

function ResourceRow({
  resource,
  quantity,
  limit,
  offered,
  onChange,
}: {
  resource: BookingResourceOption;
  quantity: number | undefined;
  /** What the venue holds, where known. */
  limit: number | null | undefined;
  offered: boolean;
  onChange: (quantity: number | undefined) => void;
}) {
  const selected = quantity !== undefined;
  const counted = resource.quantified;
  return (
    <li className="flex flex-col gap-2 border-b border-line py-2 last:border-b-0">
      <CheckboxField
        id={fieldId(`resource-${resource.id}`)}
        label={resource.name}
        checked={selected}
        disabled={!offered}
        hint={offered ? undefined : 'Not listed for this venue.'}
        onChange={(checked) => onChange(checked ? 1 : undefined)}
      />
      {/* Something that is present or not has no quantity to choose. */}
      {selected && counted && (
        <div className="pl-8">
          <QuantityStepper
            name={resource.name}
            value={quantity}
            max={limit ?? undefined}
            onChange={(next) => onChange(next)}
          />
        </div>
      )}
    </li>
  );
}

export function StepResources({
  options,
  facility,
}: {
  options: BookingOptions;
  facility: FacilityDetail | undefined;
}) {
  const { watch, setValue } = useFormContext<BookingFormValues>();
  const selected = watch('resources');

  if (!facility) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  const held = new Map(facility.resources.map((r) => [r.id, r.quantity]));
  const change = (id: string, quantity: number | undefined) => {
    const next = { ...selected };
    if (quantity === undefined) delete next[id];
    else next[id] = quantity;
    setValue('resources', next, { shouldDirty: true, shouldValidate: false });
  };
  const rows = (items: BookingResourceOption[]) => (
    <ul className="m-0 list-none p-0">
      {items.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          quantity={selected[resource.id]}
          limit={held.get(resource.id)}
          offered={held.has(resource.id)}
          onChange={(quantity) => change(resource.id, quantity)}
        />
      ))}
    </ul>
  );

  const venue = options.resources.filter((r) => r.category === 'venue');
  const kitchen = options.resources.filter((r) => r.category === 'kitchen');
  const total = Object.keys(selected).length;
  const kitchenSelected = kitchen.filter((r) => selected[r.id] !== undefined).length;

  return (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" className="font-medium">
        {total === 0
          ? 'No resources requested yet.'
          : `${total} ${total === 1 ? 'item' : 'items'} selected`}
      </p>
      <p className="text-muted">
        Tick what you need. Everything is off until you choose it. Where the venue lists how many it
        holds, you can ask for no more than that.
      </p>

      <FieldGroup legend="Venue resources">{rows(venue)}</FieldGroup>

      <Disclosure
        summary={
          kitchenSelected === 0
            ? 'Kitchen resources, none selected'
            : `Kitchen resources, ${kitchenSelected} selected`
        }
      >
        <FieldGroup legend="Kitchen resources">{rows(kitchen)}</FieldGroup>
      </Disclosure>
    </div>
  );
}
