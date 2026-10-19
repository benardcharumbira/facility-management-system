import Box from '@mui/material/Box';
import { useState } from 'react';
import type { FacilitySummary } from '@/shared/api';
import { FacilityTypeIcon } from './facilityTypeIcon';

interface FacilityMediaProps {
  facility: FacilitySummary;
  /** Fixed ratio so images loading in does not move the layout. */
  aspectRatio: string;
}

/** The facility photo, or a type based fallback when there is none or it fails to load. */
export function FacilityMedia({ facility, aspectRatio }: FacilityMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = facility.primaryImageUrl;
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
          alt={`Photo of ${facility.name}`}
          loading="lazy"
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
