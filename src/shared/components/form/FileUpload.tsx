import { FileText, RotateCw, Trash2, UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { cn } from '@/shared/utils/cn';
import { Button } from '../ui/Button';

export interface UploadItem {
  id: string;
  name: string;
  sizeBytes: number;
  status: 'uploading' | 'done' | 'failed';
  /** 0 to 1, while uploading. */
  progress: number;
  /** Why it failed, in words. */
  error?: string;
}

export interface FileUploadProps {
  /** Shown before anything is picked, e.g. [{ extension: '.pdf', label: 'PDF' }]. */
  acceptedTypes: Array<{ extension: string; label: string }>;
  maxFileSizeBytes: number;
  maxFiles: number;
  items: UploadItem[];
  /** Files that passed the type and size checks. */
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  disabled?: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * Multiple file upload. The native file input is the accessible path and works on its own; drag
 * and drop is a convenience on top. The accepted types and the limits are stated before a file is
 * chosen, files that break them are refused with the reason, and each file shows progress with
 * its own remove and retry.
 */
export function FileUpload({
  acceptedTypes,
  maxFileSizeBytes,
  maxFiles,
  items,
  onSelect,
  onRemove,
  onRetry,
  disabled = false,
}: FileUploadProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const extensions = [...new Set(acceptedTypes.map((t) => t.extension.toLowerCase()))];
  const labels = [...new Set(acceptedTypes.map((t) => t.label))];

  const receive = (files: File[]) => {
    const problems: string[] = [];
    const ok: File[] = [];
    let room = maxFiles - items.length;
    for (const file of files) {
      const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
      if (!extensions.includes(ext)) problems.push(`${file.name} is not an accepted type.`);
      else if (file.size > maxFileSizeBytes) {
        problems.push(`${file.name} is larger than ${formatBytes(maxFileSizeBytes)}.`);
      } else if (room <= 0)
        problems.push(`${file.name} was not added: the limit is ${maxFiles} files.`);
      else {
        ok.push(file);
        room -= 1;
      }
    }
    setRejected(problems);
    if (ok.length > 0) onSelect(ok);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) receive([...event.dataTransfer.files]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p id={hintId} className="text-sm text-muted">
        Accepted: {labels.join(', ')}. Up to {formatBytes(maxFileSizeBytes)} each, and at most{' '}
        {maxFiles} files.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center',
          dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface',
        )}
      >
        <UploadCloud aria-hidden className="size-8 text-subtle" strokeWidth={1.5} />
        <p className="text-muted">Drag files here, or</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          disabled={disabled}
          accept={extensions.join(',')}
          aria-describedby={hintId}
          onChange={(event) => {
            receive([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
          className="sr-only"
        />
        <label
          htmlFor={inputId}
          className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-sunken has-[:focus-visible]:outline-2"
        >
          Choose files
        </label>
      </div>

      {rejected.length > 0 && (
        <ul role="alert" className="m-0 list-none p-0 text-sm font-medium text-danger">
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul aria-label="Attached documents" className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2">
                  <FileText aria-hidden className="size-5 shrink-0 text-muted" />
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="shrink-0 text-sm text-muted">{formatBytes(item.sizeBytes)}</span>
                </p>
                <div className="flex shrink-0 gap-1">
                  {item.status === 'failed' && (
                    <Button variant="secondary" size="sm" onClick={() => onRetry(item.id)}>
                      <RotateCw aria-hidden className="size-4" />
                      {`Retry ${item.name}`}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRemove(item.id)}
                    disabled={item.status === 'uploading'}
                  >
                    <Trash2 aria-hidden className="size-4" />
                    {`Remove ${item.name}`}
                  </Button>
                </div>
              </div>
              {item.status === 'uploading' && (
                <div className="mt-2 flex items-center gap-2">
                  <progress
                    value={Math.round(item.progress * 100)}
                    max={100}
                    aria-label={`Uploading ${item.name}`}
                    className="h-2 flex-1 accent-primary"
                  />
                  <span className="text-sm text-muted tabular-nums">
                    {Math.round(item.progress * 100)}%
                  </span>
                </div>
              )}
              {item.status === 'done' && <p className="mt-1 text-sm text-muted">Uploaded</p>}
              {item.status === 'failed' && (
                <p role="alert" className="mt-1 text-sm font-medium text-danger">
                  {`Upload failed${item.error ? `: ${item.error}` : '.'}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
