import { Link } from 'react-router';
import { Alert, EmptyState, LoadingState, RelatedItems, SearchField } from '@/shared/components';
import { useState } from 'react';
import { useFacilitySearch } from '../hooks';

/**
 * For arriving without a facility: the same search as the browse screen, then on to that
 * facility's calendar to choose a slot. There is deliberately no date picker here: availability
 * is only ever chosen on the calendar.
 */
export function FacilityPicker({ draft }: { draft?: string }) {
  const [q, setQ] = useState('');
  const results = useFacilitySearch(q);
  const withDraft = draft ? `?draft=${encodeURIComponent(draft)}` : '';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base">
        Choose the venue you want to request. You will pick a date and time on its calendar, where
        you can see what is free.
      </p>
      <SearchField
        label="Search venues"
        placeholder="Name, code or locality"
        value={q}
        onChange={setQ}
      />
      {results.isPending && <LoadingState />}
      {results.isError && (
        <Alert severity="error">We could not load the venues. Please try again.</Alert>
      )}
      {results.data && results.data.items.length === 0 && (
        <EmptyState title="No venues match" description="Try a different search." />
      )}
      {results.data && results.data.items.length > 0 && (
        <RelatedItems
          label="Venues"
          items={results.data.items.map((facility) => ({
            id: facility.id,
            label: facility.name,
            description: [facility.type.name, facility.locality].join(' · '),
            to: `/facilities/${facility.id}${withDraft}`,
          }))}
        />
      )}
      <p className="text-sm text-muted">
        Or{' '}
        <Link to="/facilities" className="text-primary underline underline-offset-2">
          browse all venues
        </Link>
        .
      </p>
    </div>
  );
}
