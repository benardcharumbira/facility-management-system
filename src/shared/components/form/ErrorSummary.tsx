import { useEffect, useRef } from 'react';

export interface ErrorSummaryItem {
  /** The id of the control to move to. */
  fieldId: string;
  message: string;
}

export interface ErrorSummaryProps {
  errors: ErrorSummaryItem[];
  title?: string;
  /** Focus moves to the summary each time this number changes (and is above zero). */
  focusSignal: number;
}

/** Lists every problem as a link to its field, and takes focus when a step fails to advance. */
export function ErrorSummary({
  errors,
  title = 'There is a problem',
  focusSignal,
}: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusSignal > 0) ref.current?.focus();
  }, [focusSignal]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-lg border border-danger-line bg-danger-soft p-4 text-danger"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="m-0 mt-2 list-disc pl-5">
        {errors.map((error) => (
          <li key={`${error.fieldId}-${error.message}`}>
            <a
              href={`#${error.fieldId}`}
              onClick={(event) => {
                const target = document.getElementById(error.fieldId);
                if (target) {
                  event.preventDefault();
                  target.focus();
                }
              }}
              className="font-medium underline underline-offset-2"
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
