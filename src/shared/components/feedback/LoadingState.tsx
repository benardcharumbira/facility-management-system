import { cn } from '@/shared/utils/cn';
import { Spinner } from '../ui/Spinner';

interface LoadingStateProps {
  label?: string;
  /** Fill the viewport, for use before the application shell is available. */
  fullPage?: boolean;
}

export function LoadingState({ label = 'Loading', fullPage = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn('flex items-center justify-center p-8', fullPage && 'min-h-screen')}
    >
      <Spinner label={label} />
    </div>
  );
}
