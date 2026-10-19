import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import { IconButton } from '../ui/IconButton';

export interface GalleryImage {
  url: string;
  /** Meaningful alternative text. */
  alt: string;
  caption?: string | null;
}

export interface GalleryProps {
  images: GalleryImage[];
  /** Shown instead of a photo when there are none. */
  placeholder: ReactNode;
  /** Names the gallery for assistive technology, e.g. "Photos of City Hall". */
  label: string;
}

const frame = 'aspect-video w-full overflow-hidden rounded-lg bg-sunken';

/**
 * One primary image with thumbnails, and an expanded view opened from the primary image.
 * Thumbnails choose the primary image. Escape closes the expanded view and focus returns to
 * the control that opened it. Arrow keys move between images in the expanded view.
 */
export function Gallery({ images, placeholder, label }: GalleryProps) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  if (images.length === 0) {
    return (
      <div
        role="img"
        aria-label={label}
        className={cn(frame, 'flex items-center justify-center text-subtle')}
      >
        {placeholder}
      </div>
    );
  }

  const current = images[index] ?? images[0];
  if (!current) return null;
  const step = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  const onKeyDown = (event: KeyboardEvent) => {
    if (images.length < 2) return;
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Enlarge photo: ${current.alt}`}
        className={cn(frame, 'block cursor-zoom-in')}
      >
        <img src={current.url} alt={current.alt} className="size-full object-cover" />
      </button>
      {current.caption && <p className="text-sm text-muted">{current.caption}</p>}

      {images.length > 1 && (
        <ul aria-label="Photos" className="m-0 flex list-none gap-2 overflow-x-auto p-1">
          {images.map((image, i) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-pressed={i === index}
                className={cn(
                  'block w-24 overflow-hidden rounded outline-offset-2',
                  i === index ? 'outline-2 outline-primary' : 'opacity-70 hover:opacity-100',
                )}
              >
                <img src={image.url} alt="" className="aspect-video size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            onKeyDown={onKeyDown}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              openerRef.current?.focus();
            }}
            className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink/95 p-4 text-on-primary"
          >
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm">
                {label}, photo {index + 1} of {images.length}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton
                  aria-label="Close photo viewer"
                  className="text-on-primary hover:bg-white/15 hover:text-on-primary"
                >
                  <X aria-hidden className="size-6" />
                </IconButton>
              </Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center gap-2">
              {images.length > 1 && (
                <IconButton
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className="text-on-primary hover:bg-white/15 hover:text-on-primary"
                >
                  <ChevronLeft aria-hidden className="size-6" />
                </IconButton>
              )}
              <img
                src={current.url}
                alt={current.alt}
                className="max-h-full min-w-0 object-contain"
              />
              {images.length > 1 && (
                <IconButton
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className="text-on-primary hover:bg-white/15 hover:text-on-primary"
                >
                  <ChevronRight aria-hidden className="size-6" />
                </IconButton>
              )}
            </div>
            {current.caption && <p className="text-center text-sm">{current.caption}</p>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
