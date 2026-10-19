import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import type { FacilitySummary } from '@/shared/api';
import { VisuallyHidden } from '@/shared/components';
import { facilityPath } from '../paths';
import { FacilityMedia } from './FacilityMedia';

/** Rows reserved in the compact row; the skeleton mirrors these. */
export const FACILITY_ROW_ROWS = ['subtitle1', 'body2', 'body2', 'body2'] as const;

const line = (variant: 'subtitle1' | 'body2') => (theme: Theme) => ({
  minHeight: `${Number(theme.typography[variant].lineHeight)}em`,
});

const MAX_AMENITIES_SHOWN = 3;

/** Compact, single link row for scanning many facilities. */
export function FacilityListItem({ facility }: { facility: FacilitySummary }) {
  const location = useLocation();
  const titleId = useId();
  const detailsId = useId();
  const unavailable = facility.status === 'unavailable';
  const amenityNames = facility.amenities.map((a) => a.name);
  const extra = amenityNames.length - MAX_AMENITIES_SHOWN;
  const amenityText =
    amenityNames.slice(0, MAX_AMENITIES_SHOWN).join(', ') + (extra > 0 ? ` +${extra} more` : '');

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardActionArea
        component={RouterLink}
        to={facilityPath(facility.id)}
        state={{ fromList: location.search }}
        aria-labelledby={titleId}
        aria-describedby={detailsId}
        sx={{
          '&.Mui-focusVisible': {
            outline: (theme) => `${theme.spacing(0.5)} solid ${theme.palette.primary.main}`,
            outlineOffset: (theme) => `-${theme.spacing(0.5)}`,
          },
        }}
      >
        <Stack direction="row" spacing={2} sx={{ p: 2 }}>
          <Box sx={{ width: (theme) => theme.spacing(14), flexShrink: 0 }}>
            <FacilityMedia facility={facility} aspectRatio="4 / 3" />
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography
                id={titleId}
                variant="subtitle1"
                component="h2"
                noWrap
                sx={line('subtitle1')}
              >
                {facility.name}
              </Typography>
              {unavailable && <Chip label="Unavailable" size="small" color="error" />}
            </Stack>
            <Box id={detailsId}>
              <Typography variant="body2" color="text.secondary" noWrap sx={line('body2')}>
                {[
                  facility.type.name,
                  facility.locality,
                  facility.capacity === null ? null : `Capacity ${facility.capacity}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={line('body2')}>
                {facility.parentFacility ? `Part of ${facility.parentFacility.name}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={line('body2')}>
                {amenityText}
              </Typography>
              {unavailable && (
                <VisuallyHidden>This facility is currently unavailable.</VisuallyHidden>
              )}
            </Box>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
