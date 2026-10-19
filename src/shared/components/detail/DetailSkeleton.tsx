import { Skeleton } from '../ui/Skeleton';
import { DetailLayout } from './DetailLayout';

/** Matches the proportions of a loaded detail page: header, sidebar block and main sections. */
export function DetailSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div aria-busy aria-label="Loading">
      <div className="mb-6 flex flex-col gap-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-6 w-1/4" />
      </div>
      <DetailLayout
        aside={
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
            <Skeleton className="h-6 w-1/2" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
            <Skeleton className="h-10 w-full" />
          </div>
        }
      >
        <Skeleton className="aspect-video w-full rounded-lg" />
        {Array.from({ length: sections }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ))}
      </DetailLayout>
    </div>
  );
}
