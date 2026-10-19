import { useState } from 'react';
import type { FacilityDetail } from '@/shared/api';
import { cn } from '@/shared/utils/cn';
import { FacilityMedia } from './FacilityMedia';

/** Main photo with selectable thumbnails. Falls back to the type artwork with no photos. */
export function FacilityGallery({ facility }: { facility: FacilityDetail }) {
  const [selected, setSelected] = useState(0);
  const { images } = facility;
  const current = images[selected];

  return (
    <div className="flex flex-col gap-2">
      <FacilityMedia
        facility={facility}
        image={current}
        className="aspect-video rounded-lg"
        eager
      />
      {images.length > 1 && (
        <ul aria-label="Photos" className="m-0 flex list-none gap-2 overflow-x-auto p-1">
          {images.map((image, index) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Show photo ${index + 1} of ${images.length}`}
                aria-pressed={index === selected}
                className={cn(
                  'block w-24 rounded outline-offset-2',
                  index === selected ? 'outline-2 outline-primary' : 'opacity-70 hover:opacity-100',
                )}
              >
                <FacilityMedia
                  facility={facility}
                  image={image}
                  className="aspect-video rounded"
                  decorative
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
