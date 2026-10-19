import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/shared/utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone has no accessible name. */
  'aria-label': string;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ className, type = 'button', ref, ...props }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-md transition-colors',
        'text-muted hover:bg-sunken hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}
