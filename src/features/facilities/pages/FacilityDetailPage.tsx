import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import { isApiProblem, type FacilityDetail } from '@/shared/api';
import { EmptyState, ErrorState, PageLayout } from '@/shared/components';
import { FacilityGallery } from '../components/FacilityGallery';
import { useFacility } from '../hooks';
import { facilityPath } from '../paths';

const LIST_PATH = '/facilities';

export default function FacilityDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const facility = useFacility(id);
  // Cards pass the list's query string along so "Facilities" returns to the same results.
  const fromList =
    typeof (location.state as { fromList?: unknown } | null)?.fromList === 'string'
      ? (location.state as { fromList: string }).fromList
      : '';
  const listLink = { label: 'Facilities', to: `${LIST_PATH}${fromList}` };

  if (facility.isError) {
    const notFound = isApiProblem(facility.error) && facility.error.status === 404;
    return (
      <PageLayout
        title={notFound ? 'Facility not found' : 'Facility'}
        breadcrumbs={[listLink, { label: notFound ? 'Not found' : 'Error' }]}
      >
        {notFound ? (
          <EmptyState
            title="We could not find that facility"
            description="It may have been removed, or the link may be wrong."
            action={
              <Button component={RouterLink} to={listLink.to}>
                Back to facilities
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="We could not load this facility"
            problem={facility.error}
            onRetry={() => void facility.refetch()}
          />
        )}
      </PageLayout>
    );
  }

  if (!facility.data) {
    return (
      <PageLayout title="Facility" breadcrumbs={[listLink, { label: 'Loading' }]}>
        <DetailSkeleton />
      </PageLayout>
    );
  }

  const data = facility.data;
  return (
    <PageLayout
      title={data.name}
      description={`${data.type.name} · ${data.locality}`}
      meta={`Code ${data.code}`}
      breadcrumbs={[listLink, { label: data.name }]}
    >
      <FacilityDetailContent facility={data} />
    </PageLayout>
  );
}

function FacilityDetailContent({ facility }: { facility: FacilityDetail }) {
  const paragraphs = facility.description.split(/\n{2,}/).filter(Boolean);

  return (
    <Stack spacing={3}>
      {facility.status === 'unavailable' && (
        <Alert severity="warning">This facility is currently unavailable for booking.</Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
        }}
      >
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <FacilityGallery facility={facility} />
          <Section title="About this facility">
            {paragraphs.map((text) => (
              <Typography key={text} sx={{ mb: 1 }}>
                {text}
              </Typography>
            ))}
          </Section>
          <Section title="Amenities">
            {facility.amenities.length === 0 ? (
              <Typography color="text.secondary">No amenities listed.</Typography>
            ) : (
              <Stack
                component="ul"
                direction="row"
                sx={{ flexWrap: 'wrap', gap: 1, listStyle: 'none', m: 0, p: 0 }}
              >
                {facility.amenities.map((amenity) => (
                  <li key={amenity.id}>
                    <Chip label={amenity.name} variant="outlined" />
                  </li>
                ))}
              </Stack>
            )}
          </Section>
          {facility.childFacilities.length > 0 && (
            <Section title="Spaces within this facility">
              <List disablePadding aria-label="Spaces within this facility">
                {facility.childFacilities.map((child) => (
                  <ListItemButton key={child.id} component={RouterLink} to={facilityPath(child.id)}>
                    <ListItemText
                      primary={child.name}
                      secondary={[
                        child.type.name,
                        child.capacity === null ? null : `Capacity ${child.capacity}`,
                        child.status === 'unavailable' ? 'Unavailable' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Section>
          )}
        </Stack>

        <Paper
          variant="outlined"
          component="aside"
          aria-label="Key facts"
          sx={{ p: 2, alignSelf: 'flex-start' }}
        >
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Key facts
          </Typography>
          <Box component="dl" sx={{ m: 0 }}>
            <Fact label="Type">{facility.type.name}</Fact>
            <Fact label="Locality">{facility.locality}</Fact>
            {facility.address && <Fact label="Address">{facility.address}</Fact>}
            <Fact label="Capacity">
              {facility.capacity === null ? 'Not specified' : `${facility.capacity} people`}
            </Fact>
            <Fact label="Status">
              {facility.status === 'active' ? 'Available to book' : 'Currently unavailable'}
            </Fact>
            {facility.parentFacility && (
              <Fact label="Part of">
                <Link component={RouterLink} to={facilityPath(facility.parentFacility.id)}>
                  {facility.parentFacility.name}
                </Link>
              </Fact>
            )}
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, mb: 1.5, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </>
  );
}

/** Mirrors the loaded layout (gallery, sections, key facts) so nothing shifts on arrival. */
function DetailSkeleton() {
  return (
    <Box
      aria-busy
      aria-label="Loading facility"
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
      }}
    >
      <Stack spacing={2}>
        <Skeleton
          variant="rectangular"
          sx={{ width: '100%', aspectRatio: '16 / 9', height: 'auto' }}
        />
        <Skeleton variant="text" sx={{ typography: 'h6', width: '40%' }} />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" sx={{ width: '70%' }} />
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, alignSelf: 'flex-start' }}>
        <Skeleton variant="text" sx={{ typography: 'h6', width: '50%' }} />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} variant="text" />
        ))}
      </Paper>
    </Box>
  );
}
