import { Dialog } from 'radix-ui';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { MAX_ALLOCATION } from '@/shared/api';
import { Button, controlStyles, FormField, IconButton } from '@/shared/components';
import { X } from 'lucide-react';

function Shell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label={`Close ${title}`} className="-mr-2">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <p className="text-muted">{description}</p>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A count, or available or not, whichever the resource is recorded as. */
function ValueField({
  id,
  quantified,
  value,
  onChange,
  label,
}: {
  id: string;
  quantified: boolean;
  value: number | boolean;
  onChange: (value: number | boolean) => void;
  label: string;
}) {
  return quantified ? (
    <FormField id={id} label={label}>
      {(control) => (
        <input
          {...control}
          type="text"
          inputMode="numeric"
          value={String(typeof value === 'number' ? value : 0)}
          onChange={(e) =>
            onChange(Math.min(MAX_ALLOCATION, Number(e.target.value.replace(/\D/g, '')) || 0))
          }
          className={`${controlStyles} h-10 w-32`}
        />
      )}
    </FormField>
  ) : (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <label className="flex items-center gap-2">
        <input type="radio" name={id} checked={value === true} onChange={() => onChange(true)} />
        Available
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" name={id} checked={value !== true} onChange={() => onChange(false)} />
        Not available
      </label>
    </fieldset>
  );
}

/** One resource across every facility shown. */
export function FillRowDialog({
  resource,
  facilityCount,
  onApply,
  onClose,
}: {
  resource: { name: string; quantified: boolean };
  facilityCount: number;
  onApply: (value: number | boolean) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState<number | boolean>(resource.quantified ? 0 : true);
  return (
    <Shell
      title={`Fill ${resource.name}`}
      description={`Give ${resource.name} the same value at the ${facilityCount} ${
        facilityCount === 1 ? 'facility' : 'facilities'
      } shown. Nothing is saved until you save.`}
      onClose={onClose}
    >
      <ValueField
        id={id}
        quantified={resource.quantified}
        value={value}
        onChange={setValue}
        label={
          resource.quantified ? 'Quantity at each facility' : `${resource.name} at each facility`
        }
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onApply(value);
            onClose();
          }}
        >
          Fill row
        </Button>
      </div>
    </Shell>
  );
}

/** What can be done to one facility's whole column: fill it, copy another into it, or open its form. */
export function ColumnDialog({
  facility,
  others,
  resourceCount,
  onFill,
  onCopy,
  onClose,
}: {
  facility: { id: string; name: string };
  others: Array<{ id: string; name: string }>;
  resourceCount: number;
  onFill: (values: { count: number; available: boolean }) => void;
  onCopy: (fromFacilityId: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [count, setCount] = useState(0);
  const [available, setAvailable] = useState(false);
  const [from, setFrom] = useState('');
  const shown = `${resourceCount} ${resourceCount === 1 ? 'resource' : 'resources'}`;
  return (
    <Shell
      title={facility.name}
      description={`Changes here apply to the ${shown} shown. Nothing is saved until you save.`}
      onClose={onClose}
    >
      <section aria-label="Fill the column" className="flex flex-col gap-3">
        <h3 className="font-semibold">Fill every resource shown</h3>
        <ValueField
          id={`${id}-count`}
          quantified
          value={count}
          onChange={(v) => setCount(Number(v))}
          label="Quantity for counted resources"
        />
        <ValueField
          id={`${id}-avail`}
          quantified={false}
          value={available}
          onChange={(v) => setAvailable(Boolean(v))}
          label="Resources that are available or not"
        />
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              onFill({ count, available });
              onClose();
            }}
          >
            Fill column
          </Button>
        </div>
      </section>
      <section
        aria-label="Copy another facility"
        className="flex flex-col gap-3 border-t border-line pt-4"
      >
        <h3 className="font-semibold">Copy another facility</h3>
        <FormField id={`${id}-from`} label="Copy values from">
          {(control) => (
            <select
              {...control}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${controlStyles} h-10`}
            >
              <option value="">Choose a facility</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <div>
          <Button
            variant="secondary"
            disabled={from === ''}
            onClick={() => {
              onCopy(from);
              onClose();
            }}
          >
            Copy into {facility.name}
          </Button>
        </div>
      </section>
      <p className="border-t border-line pt-4">
        <Link
          to={`/admin/facilities/${encodeURIComponent(facility.id)}/resources`}
          className="text-primary underline underline-offset-2"
        >
          Open the form for {facility.name}
        </Link>
        <span className="block text-sm text-muted">
          One facility at a time, as an ordinary form instead of a grid.
        </span>
      </p>
    </Shell>
  );
}
