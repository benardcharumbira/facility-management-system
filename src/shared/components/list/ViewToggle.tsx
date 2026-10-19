import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface ViewOption<V extends string> {
  value: V;
  label: string;
  icon: ReactNode;
}

export interface ViewToggleProps<V extends string> {
  value: V;
  options: ReadonlyArray<ViewOption<V>>;
  onChange: (value: V) => void;
  label?: string;
}

/** Exclusive toggle between presentations of the same results (grid, list). */
export function ViewToggle<V extends string>({
  value,
  options,
  onChange,
  label = 'View',
}: ViewToggleProps<V>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-line-strong"
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex size-10 items-center justify-center',
              pressed ? 'bg-primary-soft text-primary' : 'bg-surface text-muted hover:bg-sunken',
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}
