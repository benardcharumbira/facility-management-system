import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useId, useState } from 'react';
import { useApiClient, type FacilityType } from '@/shared/api';
import {
  Alert,
  Button,
  controlStyles,
  FormField,
  IconButton,
  useSnackbar,
} from '@/shared/components';
import { adminFacilityKeys, createFacilityType, updateFacilityType } from '../api';
import { failureMessage, fieldErrors } from '../errors';
import { useFacilityTypes } from '../hooks';

/**
 * Facility types are reference data: a name, and whether capacity applies to a facility of that
 * type. Creating a facility needs one. (Seating arrangements are managed elsewhere.)
 */
export function FacilityTypesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const types = useFacilityTypes();
  const addId = useId();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const [name, setName] = useState('');
  const [capacityApplies, setCapacityApplies] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminFacilityKeys.all });

  const add = async () => {
    setError(undefined);
    setFailure(null);
    try {
      await createFacilityType(api, { name, capacityApplies });
      setName('');
      setCapacityApplies(true);
      notify('Facility type added.', 'success');
      await refresh();
    } catch (problem) {
      const errors = fieldErrors(problem);
      if (errors.name) setError(errors.name);
      else setFailure(failureMessage(problem));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Facility types</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close facility types" className="-mr-2">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          </div>
          <p className="text-muted">
            Every facility has a type. Say whether capacity applies to it: an open space may not
            have one.
          </p>
          {failure && <Alert severity="error">{failure}</Alert>}
          <ul aria-label="Facility types" className="m-0 flex list-none flex-col gap-2 p-0">
            {types.data?.map((type) => (
              <TypeRow
                key={type.id}
                type={type}
                onSave={async (patch) => {
                  await updateFacilityType(api, type.id, patch);
                  notify('Facility type saved.', 'success');
                  await refresh();
                }}
              />
            ))}
          </ul>
          <form
            className="flex flex-col gap-3 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <h3 className="font-semibold">Add a type</h3>
            <FormField id={addId} label="Name" error={error} required>
              {(control) => (
                <input
                  {...control}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${controlStyles} h-10`}
                />
              )}
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={capacityApplies}
                onChange={(e) => setCapacityApplies(e.target.checked)}
                className="size-4"
              />
              Capacity applies to this type
            </label>
            <div>
              <Button type="submit">Add type</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TypeRow({
  type,
  onSave,
}: {
  type: FacilityType;
  onSave: (patch: { name: string; capacityApplies: boolean }) => Promise<void>;
}) {
  const id = useId();
  const [name, setName] = useState(type.name);
  const [applies, setApplies] = useState(type.capacityApplies);
  const [error, setError] = useState<string | undefined>();
  const changed = name !== type.name || applies !== type.capacityApplies;
  return (
    <li className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-end gap-3">
        <FormField id={id} label={`Name of ${type.name}`} error={error} className="min-w-48 flex-1">
          {(control) => (
            <input
              {...control}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${controlStyles} h-9`}
            />
          )}
        </FormField>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={applies}
            onChange={(e) => setApplies(e.target.checked)}
            className="size-4"
          />
          Capacity applies
        </label>
        <Button
          variant="secondary"
          disabled={!changed}
          aria-label={`Save ${type.name}`}
          onClick={() => {
            setError(undefined);
            onSave({ name, capacityApplies: applies }).catch((problem: unknown) =>
              setError(fieldErrors(problem).name ?? failureMessage(problem)),
            );
          }}
        >
          Save
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {type.facilityCount === 1
          ? 'Used by 1 facility'
          : `Used by ${type.facilityCount} facilities`}
      </p>
    </li>
  );
}
