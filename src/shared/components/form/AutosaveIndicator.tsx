import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

export interface AutosaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** When it was last saved, already formatted, e.g. "10:42". */
  savedAtLabel?: string;
  onRetry?: () => void;
}

/** Says whether the work is saved, in words, politely announced as it changes. */
export function AutosaveIndicator({ status, savedAtLabel, onRetry }: AutosaveIndicatorProps) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
      {status === 'saving' && (
        <>
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          Saving…
        </>
      )}
      {status === 'saved' && (
        <>
          <Check aria-hidden className="size-4 text-primary" />
          {savedAtLabel ? `Draft saved at ${savedAtLabel}` : 'Draft saved'}
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle aria-hidden className="size-4 text-danger" />
          <span className="text-danger">Not saved. Your answers are still on this page.</span>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </>
      )}
      {status === 'idle' &&
        (savedAtLabel ? `Draft last saved at ${savedAtLabel}` : 'Not saved yet')}
    </p>
  );
}
