import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type Tone = 'neutral' | 'primary' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  primary: 'bg-primary-soft text-primary',
  danger: 'bg-danger-soft text-danger',
};

/** A small non-interactive label. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
