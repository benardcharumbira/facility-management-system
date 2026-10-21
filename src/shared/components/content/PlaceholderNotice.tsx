import { TriangleAlert } from 'lucide-react';
import type { ContentStatus } from '@/shared/api';

/**
 * Says, on the page, that its words are not the municipality's yet. Shown in development and
 * review builds only, and worded so it cannot be mistaken for part of the real thing.
 */
export function PlaceholderNotice({ status }: { status: Exclude<ContentStatus, 'approved'> }) {
  const awaiting = status === 'placeholder';
  return (
    <div
      role="note"
      aria-label="Content status"
      className="flex items-start gap-3 rounded-lg border-2 border-dashed border-warning-line bg-warning-soft p-4 text-warning print:hidden"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-6 shrink-0" />
      <div>
        <p className="font-semibold">
          {awaiting ? 'Placeholder: awaiting the municipality' : 'Draft: awaiting municipal review'}
        </p>
        <p>
          {awaiting
            ? 'The wording on this page is not the municipality’s. It is a stand-in so the page can be built and checked, and it must not be relied on or published as it is.'
            : 'The delivery team wrote this page. The municipality has not reviewed it yet, and it may change.'}
        </p>
      </div>
    </div>
  );
}
