import { useRef, useState } from 'react';
import { ApiProblem, useApiClient, type BookingDocument } from '@/shared/api';
import type { UploadItem } from '@/shared/components';
import { deleteDocument, uploadDocument } from './api';

/**
 * Document state for a booking draft. Uploads attach to the draft, so one must exist first:
 * `ensureDraft` creates it silently if it does not. Each file tracks its own progress, and a
 * failed one can be retried or removed without disturbing the others.
 */
export function useDocumentUploads(
  initial: BookingDocument[],
  ensureDraft: () => Promise<string | null>,
) {
  const api = useApiClient();
  const [items, setItems] = useState<UploadItem[]>(() =>
    initial.map((doc) => ({
      id: doc.id,
      name: doc.name,
      sizeBytes: doc.sizeBytes,
      status: 'done' as const,
      progress: 1,
    })),
  );
  const files = useRef(new Map<string, File>());
  const serverIds = useRef(new Map(initial.map((doc) => [doc.id, doc.id])));
  const counter = useRef(0);

  const patch = (id: string, change: Partial<UploadItem>) =>
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  const start = async (id: string, file: File) => {
    try {
      const draftId = await ensureDraft();
      if (!draftId) throw new Error('The draft could not be created.');
      const stored = await uploadDocument(api, draftId, file, (progress) =>
        patch(id, { progress }),
      );
      serverIds.current.set(id, stored.id);
      patch(id, { status: 'done', progress: 1, error: undefined });
    } catch (error) {
      const problem = ApiProblem.from(error);
      patch(id, {
        status: 'failed',
        error: problem.errors.file?.[0] ?? problem.detail ?? problem.title,
      });
    }
  };

  const select = (selected: File[]) => {
    for (const file of selected) {
      counter.current += 1;
      const id = `upload-${counter.current}`;
      files.current.set(id, file);
      setItems((previous) => [
        ...previous,
        { id, name: file.name, sizeBytes: file.size, status: 'uploading', progress: 0 },
      ]);
      void start(id, file);
    }
  };

  const retry = (id: string) => {
    const file = files.current.get(id);
    if (!file) return;
    patch(id, { status: 'uploading', progress: 0, error: undefined });
    void start(id, file);
  };

  const remove = async (id: string) => {
    const serverId = serverIds.current.get(id);
    if (serverId) {
      const draftId = await ensureDraft();
      if (draftId) {
        try {
          await deleteDocument(api, draftId, serverId);
        } catch (error) {
          const problem = ApiProblem.from(error);
          patch(id, { status: 'failed', error: `could not be removed (${problem.title})` });
          return;
        }
      }
    }
    files.current.delete(id);
    serverIds.current.delete(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  return { items, select, retry, remove: (id: string) => void remove(id) };
}
