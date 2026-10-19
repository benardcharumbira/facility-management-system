import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import type { FacilityDetail } from '@/shared/api';
import { FacilityMedia } from './FacilityMedia';

/** Main photo with selectable thumbnails. Falls back to the type artwork with no photos. */
export function FacilityGallery({ facility }: { facility: FacilityDetail }) {
  const [selected, setSelected] = useState(0);
  const { images } = facility;
  const current = images[selected];

  return (
    <Stack spacing={1}>
      <FacilityMedia facility={facility} image={current} aspectRatio="16 / 9" eager />
      {images.length > 1 && (
        <Stack
          component="ul"
          direction="row"
          aria-label="Photos"
          spacing={1}
          sx={{ listStyle: 'none', m: 0, p: 0, overflowX: 'auto' }}
        >
          {images.map((image, index) => (
            <li key={image.url}>
              <ButtonBase
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1} of ${images.length}`}
                aria-pressed={index === selected}
                sx={{
                  display: 'block',
                  width: (theme) => theme.spacing(12),
                  opacity: index === selected ? 1 : 0.6,
                  outline: (theme) =>
                    index === selected
                      ? `${theme.spacing(0.25)} solid ${theme.palette.primary.main}`
                      : 'none',
                  '&.Mui-focusVisible': {
                    outline: (theme) => `${theme.spacing(0.5)} solid ${theme.palette.primary.main}`,
                  },
                }}
              >
                <FacilityMedia facility={facility} image={image} aspectRatio="16 / 9" decorative />
              </ButtonBase>
            </li>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
