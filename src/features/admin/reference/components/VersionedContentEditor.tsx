import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  MAX_TERMS_PARAGRAPH_LENGTH,
  MAX_TERMS_PARAGRAPHS,
  type CreateTermsRequest,
} from '@/shared/api';
import { Alert, Button, controlStyles, FormField } from '@/shared/components';
import { explain, fieldErrors } from '../../facilities/errors';
import { TermsPreview } from './TermsPreview';

/** Blank lines divide paragraphs. Surrounding space and empty paragraphs are dropped. */
export const toParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

export interface VersionedContentEditorProps {
  initial: CreateTermsRequest;
  saveLabel: string;
  onSave: (values: CreateTermsRequest) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * Writes a draft: a title and the words, with a preview of exactly what applicants will read.
 * It edits only a draft. A published version is shown, never edited, because applicants
 * accepted those specific words.
 */
export function VersionedContentEditor({
  initial,
  saveLabel,
  onSave,
  onCancel,
  onDirtyChange,
}: VersionedContentEditorProps) {
  const id = useId();
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.paragraphs.join('\n\n'));
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const paragraphs = toParagraphs(text);
  const dirty =
    title !== initial.title || JSON.stringify(paragraphs) !== JSON.stringify(initial.paragraphs);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    setErrors({});
    setFailure(null);
    setSaving(true);
    try {
      await onSave({ title: title.trim(), paragraphs });
    } catch (error) {
      const fields = fieldErrors(error);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFailure(explain(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      aria-label="Terms and conditions draft"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex max-w-3xl flex-col gap-4"
    >
      {failure && <Alert severity="error">{failure}</Alert>}
      <FormField id={`${id}-title`} label="Title" required error={errors.title}>
        {(control) => (
          <input
            {...control}
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className={`${controlStyles} h-10`}
          />
        )}
      </FormField>
      <FormField
        id={`${id}-words`}
        label="The terms"
        required
        hint={`Leave a blank line between paragraphs. Up to ${MAX_TERMS_PARAGRAPHS} paragraphs of ${MAX_TERMS_PARAGRAPH_LENGTH} characters.`}
        error={errors.paragraphs}
      >
        {(control) => (
          <textarea
            {...control}
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${controlStyles} py-2`}
          />
        )}
      </FormField>
      <div>
        <Button
          variant="secondary"
          aria-expanded={preview}
          aria-controls={`${id}-preview`}
          onClick={() => setPreview(!preview)}
        >
          {preview ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
          {preview ? 'Hide preview' : 'Preview'}
        </Button>
      </div>
      <div id={`${id}-preview`} hidden={!preview}>
        {preview && <TermsPreview title={title.trim()} paragraphs={paragraphs} />}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
