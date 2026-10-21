import { ArrowDown, ArrowUp, RotateCw, Star, Trash2, UploadCloud } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { formatBytes } from '../form/FileUpload';
import { controlStyles, FormField } from '../form/FormField';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface ManagedImage {
  id: string;
  url: string;
  caption: string;
  isPrimary: boolean;
}

/** A file chosen but not yet uploaded, with the caption it needs first. */
export interface PendingImage {
  id: string;
  name: string;
  sizeBytes: number;
  caption: string;
  status: 'ready' | 'uploading' | 'failed';
  /** 0 to 1, while uploading. */
  progress: number;
  /** Why it failed, in words. */
  error?: string;
  /** Shown when upload was attempted without a caption. */
  captionError?: string;
}

export interface ImageManagerProps {
  images: ManagedImage[];
  pending: PendingImage[];
  acceptedTypes: Array<{ extension: string; label: string }>;
  maxFileSizeBytes: number;
  maxImages: number;
  /** Files that passed the type and size checks. */
  onSelect: (files: File[]) => void;
  onPendingCaption: (id: string, caption: string) => void;
  onUpload: (id: string) => void;
  onRemovePending: (id: string) => void;
  onSaveCaption: (id: string, caption: string) => Promise<void>;
  onMakePrimary: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/**
 * The images of a facility: upload, caption, order, primary, remove. Every image needs a caption,
 * which the public screens use as its alternative text, so a file is not uploaded without one. The
 * accepted types and the limit are stated before a file is chosen.
 */
export function ImageManager(props: ImageManagerProps) {
  const {
    images,
    pending,
    acceptedTypes,
    maxFileSizeBytes,
    maxImages,
    onSelect,
    disabled = false,
  } = props;
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const extensions = acceptedTypes.map((t) => t.extension.toLowerCase());
  const labels = [...new Set(acceptedTypes.map((t) => t.label))];
  const room = maxImages - images.length - pending.length;

  const receive = (files: File[]) => {
    const problems: string[] = [];
    const ok: File[] = [];
    let left = room;
    for (const file of files) {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      if (!extensions.includes(ext)) problems.push(`${file.name} is not an accepted type.`);
      else if (file.size > maxFileSizeBytes) {
        problems.push(`${file.name} is larger than ${formatBytes(maxFileSizeBytes)}.`);
      } else if (left <= 0)
        problems.push(`${file.name} was not added: the limit is ${maxImages} images.`);
      else {
        ok.push(file);
        left -= 1;
      }
    }
    setRejected(problems);
    if (ok.length > 0) onSelect(ok);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-dashed border-line-strong bg-sunken p-4">
        <label htmlFor={inputId} className="flex items-center gap-2 font-medium">
          <UploadCloud aria-hidden className="size-5" />
          Add images
        </label>
        <p id={hintId} className="mt-1 text-sm text-muted">
          {labels.join(', ')}, up to {formatBytes(maxFileSizeBytes)} each. A facility can have up to{' '}
          {maxImages} images. Every image needs a description, which is read aloud to people who
          cannot see it.
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={extensions.join(',')}
          aria-describedby={hintId}
          disabled={disabled || room <= 0}
          onChange={(event) => {
            receive(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
          className="mt-2 block text-sm"
        />
        {rejected.length > 0 && (
          <ul className="mt-2 list-none p-0 text-sm font-medium text-danger" role="alert">
            {rejected.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && (
        <ul
          aria-label="Images waiting to be uploaded"
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {pending.map((item) => (
            <PendingRow key={item.id} item={item} {...props} />
          ))}
        </ul>
      )}

      {images.length === 0 && pending.length === 0 ? (
        <p className="text-muted">
          This facility has no images yet. The public sees a placeholder for its type.
        </p>
      ) : (
        <ul aria-label="Images" className="m-0 flex list-none flex-col gap-3 p-0">
          {images.map((image, index) => (
            <ImageRow
              key={image.id}
              image={image}
              first={index === 0}
              last={index === images.length - 1}
              {...props}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingRow({
  item,
  onPendingCaption,
  onUpload,
  onRemovePending,
}: { item: PendingImage } & ImageManagerProps) {
  const id = useId();
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium [overflow-wrap:anywhere]">
          {item.name} <span className="font-normal text-muted">{formatBytes(item.sizeBytes)}</span>
        </p>
        <div className="flex gap-2">
          {item.status === 'failed' ? (
            <Button variant="secondary" size="sm" onClick={() => onUpload(item.id)}>
              <RotateCw aria-hidden className="size-4" />
              {`Retry ${item.name}`}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={item.status === 'uploading'}
              onClick={() => onUpload(item.id)}
            >
              {item.status === 'uploading' ? 'Uploading…' : `Upload ${item.name}`}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={item.status === 'uploading'}
            onClick={() => onRemovePending(item.id)}
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 aria-hidden className="size-4" />
            Remove
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <FormField
          id={id}
          label={`Description of ${item.name}`}
          hint="What the picture shows, for someone who cannot see it."
          error={item.captionError}
          required
        >
          {(control) => (
            <input
              {...control}
              type="text"
              value={item.caption}
              maxLength={200}
              onChange={(e) => onPendingCaption(item.id, e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
      </div>
      {item.status === 'uploading' && (
        <progress
          aria-label={`Uploading ${item.name}`}
          value={Math.round(item.progress * 100)}
          max={100}
          className="mt-2 h-2 w-full"
        />
      )}
      {item.status === 'failed' && item.error && (
        <div className="mt-2">
          <Alert severity="error">{item.error}</Alert>
        </div>
      )}
    </li>
  );
}

function ImageRow({
  image,
  first,
  last,
  onSaveCaption,
  onMakePrimary,
  onMove,
  onRemove,
  disabled,
}: { image: ManagedImage; first: boolean; last: boolean } & ImageManagerProps) {
  const id = useId();
  const [caption, setCaption] = useState(image.caption);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const changed = caption !== image.caption;

  const save = async () => {
    if (caption.trim() === '') {
      setError('Describe the image. It cannot be left without a description.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await onSaveCaption(image.id, caption);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The description could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3 sm:flex-row">
      <img
        src={image.url}
        alt={image.caption}
        className="aspect-4/3 w-full rounded-md object-cover sm:w-40"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <FormField id={id} label="Description" error={error} required>
          {(control) => (
            <div className="flex gap-2">
              <input
                {...control}
                type="text"
                value={caption}
                maxLength={200}
                disabled={disabled}
                onChange={(e) => setCaption(e.target.value)}
                className={`${controlStyles} h-10`}
              />
              <Button
                variant="secondary"
                disabled={!changed || saving || disabled}
                onClick={() => void save()}
                aria-label={`Save description of ${image.caption}`}
              >
                Save
              </Button>
            </div>
          )}
        </FormField>
        <div className="flex flex-wrap items-center gap-2">
          {image.isPrimary ? (
            <Badge tone="primary" className="gap-1">
              <Star aria-hidden className="size-3" />
              Main image
            </Badge>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => onMakePrimary(image.id)}
              aria-label={`Make ${image.caption} the main image`}
            >
              Make main image
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={first || disabled}
            onClick={() => onMove(image.id, -1)}
            aria-label={`Move ${image.caption} earlier`}
          >
            <ArrowUp aria-hidden className="size-4" />
            Earlier
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={last || disabled}
            onClick={() => onMove(image.id, 1)}
            aria-label={`Move ${image.caption} later`}
          >
            <ArrowDown aria-hidden className="size-4" />
            Later
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onRemove(image.id)}
            aria-label={`Remove ${image.caption}`}
          >
            <Trash2 aria-hidden className="size-4" />
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}
