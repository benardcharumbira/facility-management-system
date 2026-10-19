import Box from '@mui/material/Box';
import { useState } from 'react';
import type { FacilityImage, FacilitySummary } from '@/shared/api';
import { FacilityTypeIcon } from './facilityTypeIcon';

interface FacilityMediaProps {
  facility: FacilitySummary;
  /** Fixed ratio so images loading in does not move the layout. */
  aspectRatio: string;
  /** Show this image instead of the facility's primary one. */
  image?: FacilityImage;
  eager?: boolean;
  /** For images inside a control that already has a label. */
  decorative?: boolean;
}

/** The facility photo, or a type based fallback when there is none or it fails to load. */
export function FacilityMedia({
  facility,
  aspectRatio,
  image,
  eager = false,
  decorative = false,
}: FacilityMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url ?? facility.primaryImageUrl;
  const showImage = url !== null && url !== failedUrl;

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        color: 'text.secondary',
        filter: facility.status === 'unavailable' ? 'grayscale(1)' : undefined,
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={url}
          alt={decorative ? '' : (image?.alt ?? `Photo of ${facility.name}`)}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedUrl(url)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <FacilityTypeIcon typeId={facility.type.id} fontSize="large" />
      )}
    </Box>
  );
}
