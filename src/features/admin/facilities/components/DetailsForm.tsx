import { useId } from 'react';
import type { AdminFacility, FacilityDetailsInput, FacilityType } from '@/shared/api';
import { controlStyles, FormField, HierarchySelect } from '@/shared/components';

export type DetailsValues = FacilityDetailsInput;

export const EMPTY_DETAILS: DetailsValues = {
  name: '',
  code: '',
  typeId: '',
  locality: '',
  shortDescription: '',
  description: '',
  status: 'unavailable',
  parentFacilityId: null,
};

export function detailsOf(facility: AdminFacility): DetailsValues {
  return {
    name: facility.name,
    code: facility.code,
    typeId: facility.type.id,
    locality: facility.locality,
    shortDescription: facility.shortDescription,
    description: facility.description,
    status: facility.status === 'active' ? 'active' : 'unavailable',
    parentFacilityId: facility.parentFacility?.id ?? null,
  };
}

/** The checks that need no server. The server repeats them and adds the ones that do. */
export function validateDetails(values: DetailsValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.name.trim() === '') errors.name = 'Enter the name.';
  if (values.code.trim() === '') errors.code = 'Enter the code.';
  if (values.typeId === '') errors.typeId = 'Choose a type.';
  if (values.locality.trim() === '') errors.locality = 'Enter the locality.';
  if (values.shortDescription.trim() === '') {
    errors.shortDescription = 'Enter the short description.';
  } else if (values.shortDescription.length > 160) {
    errors.shortDescription = 'Use 160 characters or fewer.';
  }
  return errors;
}

interface DetailsFormProps {
  values: DetailsValues;
  onChange: (values: DetailsValues) => void;
  types: FacilityType[] | undefined;
  errors: Record<string, string>;
  disabled?: boolean;
  /** Edit only: whether the facility takes bookings. A new facility starts unavailable. */
  status?: { hint: string };
  /** Create only: where the facility sits. */
  parent?: { eligible: Array<{ id: string; name: string }> };
}

/** The fields shared by creating and editing a facility. */
export function DetailsForm({
  values,
  onChange,
  types,
  errors,
  disabled,
  status,
  parent,
}: DetailsFormProps) {
  const id = useId();
  const set = (patch: Partial<DetailsValues>) => onChange({ ...values, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${id}-name`} label="Name" error={errors.name} required>
          {(control) => (
            <input
              {...control}
              value={values.name}
              disabled={disabled}
              maxLength={80}
              onChange={(e) => set({ name: e.target.value })}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField
          id={`${id}-code`}
          label="Code"
          hint="A short code that is unique to this facility."
          error={errors.code}
          required
        >
          {(control) => (
            <input
              {...control}
              value={values.code}
              disabled={disabled}
              maxLength={40}
              onChange={(e) => set({ code: e.target.value })}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField id={`${id}-type`} label="Type" error={errors.typeId} required>
          {(control) => (
            <select
              {...control}
              value={values.typeId}
              disabled={disabled}
              onChange={(e) => set({ typeId: e.target.value })}
              className={`${controlStyles} h-10`}
            >
              <option value="">Choose a type</option>
              {types?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id={`${id}-locality`} label="Locality" error={errors.locality} required>
          {(control) => (
            <input
              {...control}
              value={values.locality}
              disabled={disabled}
              maxLength={80}
              onChange={(e) => set({ locality: e.target.value })}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
      </div>
      <FormField
        id={`${id}-short`}
        label="Short description"
        hint="One or two sentences, shown in search results. Up to 160 characters."
        error={errors.shortDescription}
        required
      >
        {(control) => (
          <textarea
            {...control}
            rows={2}
            value={values.shortDescription}
            disabled={disabled}
            maxLength={160}
            onChange={(e) => set({ shortDescription: e.target.value })}
            className={`${controlStyles} py-2`}
          />
        )}
      </FormField>
      <FormField
        id={`${id}-description`}
        label="Full description"
        hint="Shown on the facility's own page. Leave a blank line between paragraphs."
        error={errors.description}
      >
        {(control) => (
          <textarea
            {...control}
            rows={6}
            value={values.description}
            disabled={disabled}
            onChange={(e) => set({ description: e.target.value })}
            className={`${controlStyles} py-2`}
          />
        )}
      </FormField>
      {parent && (
        <HierarchySelect
          label="Part of"
          hint="Leave as none unless this is a space inside a larger facility. You can change it later."
          value={values.parentFacilityId}
          eligible={parent.eligible}
          error={errors.parentFacilityId}
          onChange={(parentFacilityId) => set({ parentFacilityId })}
        />
      )}
      {status && (
        <FormField id={`${id}-status`} label="Status" hint={status.hint} error={errors.status}>
          {(control) => (
            <select
              {...control}
              value={values.status}
              disabled={disabled}
              onChange={(e) => set({ status: e.target.value as DetailsValues['status'] })}
              className={`${controlStyles} h-10`}
            >
              <option value="active">Active: it takes bookings</option>
              <option value="unavailable">Unavailable: it does not take bookings</option>
            </select>
          )}
        </FormField>
      )}
    </div>
  );
}
