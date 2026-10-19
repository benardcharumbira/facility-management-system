import { useState } from 'react';
import type { FacilityImage, FacilitySummary } from '@/shared/api';
import { cn } from '@/shared/utils/cn';
import { FacilityTypeIcon } from './facilityTypeIcon';

interface FacilityMediaProps {
  facility: FacilitySummary;
  /** Sets the aspect ratio (e.g. `aspect-video`) so images loading in do not move the layout. */
  className: string;
  /** Show this image instead of the facility's primary one. */
  image?: FacilityImage;
  eager?: boolean;
  /** For images inside a control that already has a label. */
  decorative?: boolean;
}

/** The facility photo, or a type based fallback when there is none or it fails to load. */
export function FacilityMedia({
  facility,
  className,
  image,
  eager = false,
  decorative = false,
}: FacilityMediaProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = image?.url ?? facility.primaryImageUrl;
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
          alt={decorative ? '' : (image?.alt ?? `Photo of ${facility.name}`)}
          loading={eager ? 'eager' : 'lazy'}
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
