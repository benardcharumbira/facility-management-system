import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { usePageHeaderValue } from './PageHeaderContext';

/** The shell's breadcrumb region. Routes populate it through PageLayout. */
export function ShellBreadcrumbs() {
  const { breadcrumbs } = usePageHeaderValue();
  if (breadcrumbs.length === 0) return null;

  return (
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
  );
}
