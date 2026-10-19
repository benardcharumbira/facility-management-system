import { getEnv } from '@/app/env';
import { Alert } from '@/shared/components';
import type { FacilitySummary } from '@/shared/api';

/**
 * Warns while any displayed record carries provisional (invented or inferred) fields.
 * Development only: `import.meta.env.DEV` is false in production builds, so the banner and its
 * text are removed from them entirely. In development, set VITE_SHOW_SAMPLE_DATA_BANNER=false
 * to hide it.
 */
export function SampleDataBanner({ facilities }: { facilities: readonly FacilitySummary[] }) {
  if (!import.meta.env.DEV || !getEnv().showSampleDataBanner) return null;
  if (!facilities.some((f) => (f.provisionalFields?.length ?? 0) > 0)) return null;

  return (
    <Alert severity="info" className="mb-4">
      Sample data. Capacities, localities, amenities and descriptions are placeholders pending the
      facilities register.
    </Alert>
  );
}
