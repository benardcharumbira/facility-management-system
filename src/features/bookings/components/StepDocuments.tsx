import type { BookingOptions } from '@/shared/api';
import { Alert, FileUpload, type UploadItem } from '@/shared/components';

export function StepDocuments({
  options,
  items,
  onSelect,
  onRemove,
  onRetry,
}: {
  options: BookingOptions;
  items: UploadItem[];
  onSelect: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const { uploads } = options;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base">
        Attach anything that supports your request, such as a programme, a permit or a letter.
        Documents are optional.
      </p>
      <FileUpload
        acceptedTypes={uploads.acceptedTypes}
        maxFileSizeBytes={uploads.maxFileSizeBytes}
        maxFiles={uploads.maxFiles}
        items={items}
        onSelect={onSelect}
        onRemove={onRemove}
        onRetry={onRetry}
      />
      {items.some((i) => i.status === 'uploading') && (
        <Alert severity="info">
          Uploads are still in progress. You can continue when they finish.
        </Alert>
      )}
    </div>
  );
}
