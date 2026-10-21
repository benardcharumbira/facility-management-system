import { useRef, useState } from 'react';
import { ApiProblem, IMAGE_RULES, useApiClient } from '@/shared/api';
import {
  ConfirmDialog,
  ImageManager,
  Section,
  useSnackbar,
  type PendingImage,
} from '@/shared/components';
import { deleteImage, updateImage, uploadImage } from '../api';
import { explain } from '../errors';
import { useRefreshAfterChange } from '../hooks';
import type { SectionProps } from './types';

export function ImagesSection({ facility, onDirtyChange }: SectionProps) {
  const api = useApiClient();
  const { notify } = useSnackbar();
  const refresh = useRefreshAfterChange();
  const archived = facility.status === 'archived';
  const files = useRef(new Map<string, File>());
  const counter = useRef(0);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  const change = (id: string, patch: Partial<PendingImage>) => {
    setPending((items) => {
      const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
      // Chosen files that have not been uploaded would be lost on leaving.
      onDirtyChange(next.length > 0);
      return next;
    });
  };

  const select = (chosen: File[]) => {
    const added = chosen.map((file): PendingImage => {
      counter.current += 1;
      const id = `pending-${counter.current}`;
      files.current.set(id, file);
      return {
        id,
        name: file.name,
        sizeBytes: file.size,
        caption: '',
        status: 'ready',
        progress: 0,
      };
    });
    setPending((items) => {
      onDirtyChange(true);
      return [...items, ...added];
    });
  };

  const drop = (id: string) => {
    files.current.delete(id);
    setPending((items) => {
      const next = items.filter((item) => item.id !== id);
      onDirtyChange(next.length > 0);
      return next;
    });
  };

  const upload = async (id: string) => {
    const file = files.current.get(id);
    const item = pending.find((p) => p.id === id);
    if (!file || !item) return;
    if (item.caption.trim() === '') {
      change(id, {
        captionError: 'Describe the image. This text is read aloud to people who cannot see it.',
      });
      return;
    }
    change(id, { status: 'uploading', progress: 0, error: undefined, captionError: undefined });
    try {
      await uploadImage(api, facility.id, file, item.caption, (progress) =>
        change(id, { progress }),
      );
      drop(id);
      await refresh();
      notify(`${item.name} added.`, 'success');
    } catch (failure) {
      const problem = ApiProblem.from(failure);
      change(id, {
        status: 'failed',
        error: problem.errors.file?.[0] ?? problem.detail ?? problem.title,
        captionError: problem.errors.caption?.[0],
      });
    }
  };

  const act = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work();
      await refresh();
      notify(message, 'success');
    } catch (failure) {
      notify(explain(failure), 'error');
    }
  };

  const index = (id: string) => facility.images.findIndex((i) => i.id === id);
  const removed = facility.images.find((i) => i.id === removing);

  return (
    <Section
      title="Images"
      description="The public sees these on the facility's page, the main image first. Each needs a description, which is read aloud to people who cannot see it."
    >
      <ImageManager
        images={facility.images}
        pending={pending}
        acceptedTypes={IMAGE_RULES.acceptedTypes.map(({ extension, label }) => ({
          extension,
          label,
        }))}
        maxFileSizeBytes={IMAGE_RULES.maxFileSizeBytes}
        maxImages={IMAGE_RULES.maxImages}
        disabled={archived}
        onSelect={select}
        onPendingCaption={(id, caption) => change(id, { caption, captionError: undefined })}
        onUpload={(id) => void upload(id)}
        onRemovePending={drop}
        onSaveCaption={async (id, caption) => {
          try {
            await updateImage(api, facility.id, id, { caption });
          } catch (failure) {
            throw new Error(explain(failure));
          }
          await refresh();
          notify('Description saved.', 'success');
        }}
        onMakePrimary={(id) =>
          void act(
            () => updateImage(api, facility.id, id, { isPrimary: true }),
            'Main image changed.',
          )
        }
        onMove={(id, direction) =>
          void act(
            () => updateImage(api, facility.id, id, { position: index(id) + direction }),
            'Order changed.',
          )
        }
        onRemove={setRemoving}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        destructive
        title="Remove this image?"
        description={
          removed
            ? `“${removed.caption}” will be removed from ${facility.name}. The public will no longer see it.`
            : ''
        }
        confirmLabel="Remove image"
        cancelLabel="Keep it"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deleteImage(api, facility.id, removing);
          } catch (failure) {
            throw new Error(explain(failure));
          }
          await refresh();
          notify('Image removed.', 'success');
        }}
      />
    </Section>
  );
}
