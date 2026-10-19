import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useId, type ReactNode, type RefObject } from 'react';

/** At and above this breakpoint filters are a sidebar; below it they are a full screen drawer. */
export const FILTER_PANEL_BREAKPOINT = 'lg';

/** Width of the sidebar in theme spacing units. */
const SIDEBAR_WIDTH = 35;

export interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  /** Drawer state. Ignored in the sidebar layout. */
  open: boolean;
  onClose: () => void;
  /** Label for the drawer's primary action, e.g. "Show 12 results". */
  closeLabel?: string;
  /** When provided, the drawer footer offers "Clear all". */
  onClearAll?: () => void;
  /** The button that opened the drawer; focus is returned to it once the drawer closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function FilterPanel({
  title = 'Filters',
  children,
  open,
  onClose,
  closeLabel = 'Show results',
  onClearAll,
  returnFocusRef,
}: FilterPanelProps) {
  const theme = useTheme();
  const isSidebar = useMediaQuery(theme.breakpoints.up(FILTER_PANEL_BREAKPOINT));
  const titleId = useId();

  if (isSidebar) {
    return (
      <Box
        component="aside"
        aria-label={title}
        sx={{
          width: (t) => t.spacing(SIDEBAR_WIDTH),
          flexShrink: 0,
          position: 'sticky',
          top: (t) => t.spacing(10),
          alignSelf: 'flex-start',
          maxHeight: (t) => `calc(100vh - ${t.spacing(12)})`,
          overflowY: 'auto',
        }}
      >
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          {title}
        </Typography>
        {children}
      </Box>
    );
  }

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': titleId,
          sx: { width: '100%', maxWidth: '100%' },
        },
        transition: { onExited: () => returnFocusRef?.current?.focus() },
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}
      >
        <Typography variant="h6" component="h2" id={titleId}>
          {title}
        </Typography>
        <IconButton edge="end" aria-label="Close filters" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1 }}>{children}</Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ p: 2, borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}
      >
        {onClearAll && <Button onClick={onClearAll}>Clear all</Button>}
        <Button variant="contained" onClick={onClose}>
          {closeLabel}
        </Button>
      </Stack>
    </Drawer>
  );
}
