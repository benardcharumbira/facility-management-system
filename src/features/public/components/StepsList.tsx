import type { ReactNode } from 'react';

export interface Step {
  title: string;
  body: ReactNode;
}

/** The steps of a process, in order, numbered in text as well as by position. */
export function StepsList({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol aria-label={label} className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-col"
        >
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-on-primary"
          >
            {index + 1}
          </span>
          <div>
            <h3 className="text-lg font-semibold">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-1 text-base">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
