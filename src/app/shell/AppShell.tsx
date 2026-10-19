import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { type Theme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { useCurrentUser } from '@/shared/auth';
import {
  ErrorBoundary,
  LoadingState,
  ShellBreadcrumbs,
  PageHeaderProvider,
} from '@/shared/components';
import { NavList } from './NavList';
import { UserMenu } from './UserMenu';

/** Drawer width in theme spacing units (see theme.spacing). */
const DRAWER_WIDTH = 30;

const drawerPaperSx = {
  width: (theme: Theme) => theme.spacing(DRAWER_WIDTH),
  maxWidth: '80vw',
} as const;

export function AppShell() {
  const { user, signOut } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ProtectedRoute guarantees a user; this keeps the types honest.
  if (!user) return null;

  const nav = <NavList role={user.role} onNavigate={() => setMobileOpen(false)} />;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="p" noWrap sx={{ flexGrow: 1 }}>
            Facilities Booking
          </Typography>
          <UserMenu user={user} onSignOut={() => void signOut()} />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': drawerPaperSx }}
      >
        <Toolbar />
        {nav}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          flexShrink: 0,
          width: (theme) => theme.spacing(DRAWER_WIDTH),
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        <Toolbar />
        {nav}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <PageHeaderProvider>
          <ShellBreadcrumbs />
          <ErrorBoundary>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </PageHeaderProvider>
      </Box>
    </Box>
  );
}
