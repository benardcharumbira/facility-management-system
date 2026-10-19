import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
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

const MAX_AMENITY_CHIPS = 3;

/** Rows reserved in the card, in the order they appear; the skeleton mirrors these. */
export const FACILITY_CARD_ROWS = ['h6', 'h6', 'body2', 'body2', 'body2', 3] as const;

const lines =
  (variant: 'h6' | 'body2', count = 1) =>
  (theme: Theme) => ({
    minHeight: `${count * Number(theme.typography[variant].lineHeight)}em`,
  });

const clamp = (count: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: count,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
});

export function FacilityCard({ facility }: { facility: FacilitySummary }) {
  const location = useLocation();
  const titleId = useId();
  const detailsId = useId();
  const unavailable = facility.status === 'unavailable';
  const shown = facility.amenities.slice(0, MAX_AMENITY_CHIPS);
  const overflow = facility.amenities.length - shown.length;

  return (
    <Card variant="outlined" sx={{ width: '100%', display: 'flex' }}>
      <CardActionArea
        component={RouterLink}
        to={facilityPath(facility.id)}
        state={{ fromList: location.search }}
        aria-labelledby={titleId}
        aria-describedby={detailsId}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          '&.Mui-focusVisible': {
            outline: (theme) => `${theme.spacing(0.5)} solid ${theme.palette.primary.main}`,
            outlineOffset: (theme) => `-${theme.spacing(0.5)}`,
          },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <FacilityMedia facility={facility} aspectRatio="16 / 9" />
          {unavailable && (
            <Chip
              label="Unavailable"
              size="small"
              color="error"
              sx={{
                position: 'absolute',
                top: (theme) => theme.spacing(1),
                left: (theme) => theme.spacing(1),
              }}
            />
          )}
        </Box>
        <CardContent sx={{ flexGrow: 1, width: '100%' }}>
          <Typography id={titleId} variant="h6" component="h2" sx={[lines('h6', 2), clamp(2)]}>
            {facility.name}
          </Typography>
          <Box id={detailsId}>
            <Typography variant="body2" color="text.secondary" noWrap sx={lines('body2')}>
              {facility.type.name} · {facility.locality}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={lines('body2')}>
              {facility.capacity === null ? '' : `Capacity ${facility.capacity}`}
            </Typography>
            <Stack
              direction="row"
              spacing={0.5}
              sx={[{ alignItems: 'center', minWidth: 0 }, lines('body2')]}
            >
              {facility.parentFacility && (
                <>
                  <SubdirectoryArrowRightIcon fontSize="small" aria-hidden color="action" />
                  <Typography variant="body2" color="text.secondary" noWrap>
                    Part of {facility.parentFacility.name}
                  </Typography>
                </>
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ mt: 1, minHeight: (theme) => theme.spacing(3), overflow: 'hidden' }}
            >
              {shown.map((amenity) => (
                <Chip key={amenity.id} label={amenity.name} size="small" variant="outlined" />
              ))}
              {overflow > 0 && <Chip label={`+${overflow}`} size="small" variant="outlined" />}
            </Stack>
            {unavailable && (
              <VisuallyHidden>This facility is currently unavailable.</VisuallyHidden>
            )}
            {overflow > 0 && (
              <VisuallyHidden>
                {`Also has ${overflow} more ${overflow === 1 ? 'amenity' : 'amenities'}.`}
              </VisuallyHidden>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
