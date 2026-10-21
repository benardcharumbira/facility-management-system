import { Link } from 'react-router';
import type { FeaturedFacility } from '@/shared/api';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useFeatured } from '../hooks';

/**
 * A few of the municipality's venues, with a picture each, linking onward. The pictures are the
 * main payload on the landing page, so each is sized in advance, offered in modern formats where
 * the API gives them, and loaded only when it is about to be seen.
 */
export function FeaturedVenues() {
  const featured = useFeatured();

  if (featured.isError) {
    return <p className="text-base">We could not show the venues just now.</p>;
  }
  if (!featured.data) {
    return (
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
        {[0, 1, 2, 3].map((n) => (
          <li key={n}>
            <Skeleton className="aspect-[8/7] w-full" />
          </li>
        ))}
      </ul>
    );
  }
  if (featured.data.length === 0) return null;

  return (
    <ul
      aria-label="Some of our venues"
      className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4"
    >
      {featured.data.map((venue) => (
        <li key={venue.id}>
          <VenueCard venue={venue} />
        </li>
      ))}
    </ul>
  );
}

function VenueCard({ venue }: { venue: FeaturedFacility }) {
  const { image } = venue;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {image && (
        <picture>
          {image.sources?.map((source) => (
            <source key={source.type} type={source.type} srcSet={source.srcSet} />
          ))}
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            className="aspect-[8/5] w-full bg-sunken object-cover"
          />
        </picture>
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-semibold">
          <Link
            to={`/facilities/${encodeURIComponent(venue.id)}`}
            className="underline underline-offset-2 after:absolute after:inset-0"
          >
            {venue.name}
          </Link>
        </h3>
        <p className="text-base">
          {venue.typeName} · {venue.locality}
          {venue.capacity !== null && ` · holds ${venue.capacity}`}
        </p>
        <p className="text-base text-muted">{venue.shortDescription}</p>
      </div>
    </article>
  );
}
