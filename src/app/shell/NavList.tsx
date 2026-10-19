import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Link as RouterLink, useLocation } from 'react-router';
import type { Role } from '@/shared/auth';
import { navItemsForRole } from './navigation';

interface NavListProps {
  role: Role;
  onNavigate?: () => void;
}

export function NavList({ role, onNavigate }: NavListProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Main navigation">
      <List>
        {navItemsForRole(role).map((item) => {
          const selected = pathname === item.to;
          return (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              onClick={onNavigate}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </nav>
  );
}
