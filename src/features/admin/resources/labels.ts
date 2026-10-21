import type { ResourceCategory, ResourceStatus } from '@/shared/api';

/** The categories are a fixed vocabulary, matching the booking form's grouping. */
export const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  venue: 'Venue resources',
  kitchen: 'Kitchen resources',
};

export const STATUS_LABELS: Record<ResourceStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};
