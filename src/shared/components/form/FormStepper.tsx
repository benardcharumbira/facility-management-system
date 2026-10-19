import { AlertCircle, Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'attention';

export interface FormStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Visited steps can be returned to. Later, unvisited steps cannot. */
  reachable: boolean;
}

export interface FormStepperProps {
  steps: FormStep[];
  onSelect: (id: string) => void;
}

const STATUS_TEXT: Record<StepStatus, string> = {
  complete: 'completed',
  current: 'current step',
  upcoming: 'not started',
  attention: 'needs attention',
};

/**
 * Progress through a multi step form. The state of every step is stated in text (visually on
 * wider screens, always to assistive technology); the current step carries `aria-current`.
 */
export function FormStepper({ steps, onSelect }: FormStepperProps) {
  const index = Math.max(
    0,
    steps.findIndex((s) => s.status === 'current'),
  );
  const current = steps[index];

  return (
    <nav aria-label="Progress" className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted">
        Step {index + 1} of {steps.length}
        {current && <span className="text-ink">{`: ${current.label}`}</span>}
      </p>
      <ol className="m-0 flex list-none gap-2 p-0">
        {steps.map((step, i) => {
          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  step.status === 'current' && 'border-primary bg-primary text-on-primary',
                  step.status === 'complete' && 'border-primary bg-primary-soft text-primary',
                  step.status === 'attention' && 'border-danger bg-danger-soft text-danger',
                  step.status === 'upcoming' && 'border-line-strong bg-surface text-muted',
                )}
              >
                {step.status === 'complete' ? (
                  <Check className="size-4" />
                ) : step.status === 'attention' ? (
                  <AlertCircle className="size-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden min-w-0 text-left text-sm sm:block">
                <span className="block font-medium">{step.label}</span>
                <span className="block text-xs text-muted">{STATUS_TEXT[step.status]}</span>
              </span>
              <span className="sr-only">{`Step ${i + 1}: ${step.label}, ${STATUS_TEXT[step.status]}`}</span>
            </>
          );
          return (
            <li key={step.id} className="flex flex-1 items-center">
              {step.reachable && step.status !== 'current' ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-sunken"
                >
                  {body}
                </button>
              ) : (
                <span
                  aria-current={step.status === 'current' ? 'step' : undefined}
                  className="flex items-center gap-2 p-1"
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
