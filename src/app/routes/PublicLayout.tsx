import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { LoadingState } from '@/shared/components';

/** Same app bar as the shell, without navigation, so sign in does not look detached. */
export function PublicLayout() {
  return (
    <Box>
      <AppBar position="fixed">
        <Toolbar>
          <Typography variant="h6" component="p" noWrap>
            Facilities Booking
          </Typography>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box
        component="main"
        sx={{ display: 'flex', justifyContent: 'center', p: { xs: 2, md: 4 }, minWidth: 0 }}
      >
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
