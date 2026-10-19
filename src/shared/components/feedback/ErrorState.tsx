import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { isApiProblem } from '@/shared/api';

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
    <Box sx={{ p: 2 }}>
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>{title}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
}
