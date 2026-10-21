import type { ContentStatus } from '@/shared/api';
import { PlaceholderNotice } from '@/shared/components';
import { isProductionBuild } from '@/shared/utils/environment';

/**
 * What to do with content that is not the municipality's own yet. Stand-in legal text is never
 * published: in a production build it is withheld altogether, and the page says it is being
 * prepared. Everywhere else it is shown, under a notice that says what it is. Words the delivery
 * team wrote for review are shown, and flagged outside production.
 */
export function placeholderPolicy(status: ContentStatus): {
  withhold: boolean;
  notice: React.ReactNode;
} {
  if (status === 'approved') return { withhold: false, notice: null };
  const production = isProductionBuild();
  return {
    withhold: production && status === 'placeholder',
    notice: production ? null : <PlaceholderNotice status={status} />,
  };
}
