import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

interface LoadingStateProps {
  label?: string;
  /** Fill the viewport, for use before the application shell is available. */
  fullPage?: boolean;
}

export function LoadingState({ label = 'Loading', fullPage = false }: LoadingStateProps) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        minHeight: fullPage ? '100vh' : undefined,
      }}
    >
      <CircularProgress aria-label={label} />
    </Box>
  );
}
