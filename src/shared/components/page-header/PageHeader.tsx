import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { usePageHeaderValue } from './PageHeaderContext';

/** The shell's breadcrumb and page title region. Routes populate it via usePageHeader. */
export function PageHeader() {
  const { title, breadcrumbs } = usePageHeaderValue();

  return (
    <Box component="header" sx={{ mb: 3 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb) =>
            crumb.to ? (
              <Link
                key={crumb.label}
                component={RouterLink}
                to={crumb.to}
                underline="hover"
                color="inherit"
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={crumb.label} color="text.primary" aria-current="page">
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      {title && (
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
      )}
    </Box>
  );
}
