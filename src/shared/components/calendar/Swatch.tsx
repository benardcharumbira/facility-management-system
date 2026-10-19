import { cn } from '@/shared/utils/cn';
import { patternClass, type Pattern } from './patterns';

/** A small chip showing a status pattern. Decorative: the status is always also named in words. */
export function Swatch({ pattern, className }: { pattern: Pattern; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 shrink-0 rounded-sm', patternClass(pattern), className)}
    />
  );
}
