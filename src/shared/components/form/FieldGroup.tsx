import type { ReactNode } from 'react';

export interface FieldGroupProps {
  legend: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** Related inputs in a fieldset with a legend, so assistive technology announces the group. */
export function FieldGroup({ legend, hint, children }: FieldGroupProps) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1 p-0 text-base font-semibold">{legend}</legend>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}
