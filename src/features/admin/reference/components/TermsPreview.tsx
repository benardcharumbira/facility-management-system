import type { TermsVersion } from '@/shared/api';

/**
 * The terms exactly as an applicant reads them: a title and paragraphs. Used to preview a draft
 * and to look at a version that is published or has been superseded.
 */
export function TermsPreview({ title, paragraphs }: Pick<TermsVersion, 'title' | 'paragraphs'>) {
  return (
    <article
      aria-label="How applicants read these terms"
      className="rounded-md border border-line bg-surface p-4"
    >
      <h3 className="text-base font-semibold">{title || 'Untitled'}</h3>
      <div className="mt-2 flex flex-col gap-2">
        {paragraphs.length === 0 ? (
          <p className="text-muted">Nothing written yet.</p>
        ) : (
          paragraphs.map((paragraph, index) => <p key={`${index}:${paragraph}`}>{paragraph}</p>)
        )}
      </div>
    </article>
  );
}
