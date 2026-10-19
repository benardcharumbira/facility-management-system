import LogoutIcon from '@mui/icons-material/Logout';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { CurrentUser } from '@/shared/auth';
import { ROLE_LABELS } from './roleLabels';

interface UserMenuProps {
  user: CurrentUser;
  onSignOut: () => void;
}

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        color="inherit"
        edge="end"
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Avatar
          src={user.imageUrl ?? undefined}
          alt=""
          sx={{ width: (theme) => theme.spacing(4), height: (theme) => theme.spacing(4) }}
        >
          {user.name.charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: '100%' }}>
          <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {user.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {user.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ROLE_LABELS[user.role]}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onSignOut();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
