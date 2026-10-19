import { cn } from '@/shared/utils/cn';

/** Placeholder block. Size it with the same classes as the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('rounded bg-sunken motion-safe:animate-pulse', className)} />
  );
}
