import { useState } from 'react';
import type { FacilitySummary } from '@/shared/api';
import { cn } from '@/shared/utils/cn';
import { FacilityTypeIcon } from './facilityTypeIcon';

interface FacilityMediaProps {
  facility: FacilitySummary;
  /** Sets the aspect ratio (e.g. `aspect-video`) so images loading in do not move the layout. */
  className: string;
}

/** The facility photo, or a type based fallback when there is none or it fails to load. */
export function FacilityMedia({ facility, className }: FacilityMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = facility.primaryImageUrl;
  const showImage = url !== null && url !== failedUrl;

  return (
    <div
      className={cn(
        'flex w-full items-center justify-center overflow-hidden bg-sunken text-subtle',
        facility.status === 'unavailable' && 'grayscale',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt={facility.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url)}
          className="block size-full object-cover"
        />
      ) : (
        <FacilityTypeIcon typeId={facility.type.id} className="size-10" strokeWidth={1.5} />
      )}
    </div>
  );
}
