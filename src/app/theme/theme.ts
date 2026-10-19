import { createTheme } from '@mui/material/styles';

/**
 * The single light theme. Deliberately close to Material UI defaults: the bespoke design
 * language replaces this module (or what it exports) and nothing else.
 */
export const theme = createTheme({
  spacing: 8,
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    fontSize: 14,
  },
});
