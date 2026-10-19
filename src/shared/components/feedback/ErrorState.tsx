import { isApiProblem } from '@/shared/api';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

interface ErrorStateProps {
  title?: string;
  /** An ApiProblem, or anything thrown; unknown values get a generic message. */
  problem?: unknown;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', problem, onRetry }: ErrorStateProps) {
  const message = isApiProblem(problem)
    ? (problem.detail ?? problem.title)
    : 'An unexpected error occurred. Please try again.';

  return (
    <Alert
      severity="error"
      title={title}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {message}
    </Alert>
  );
}
