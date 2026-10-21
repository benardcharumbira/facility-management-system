import type { FacilityType } from '@/shared/api';
import type { ActiveFilter } from '@/shared/components';
import {
  CLEARED_ADMIN_FILTERS,
  DEFAULT_STATUSES,
  shownStatuses,
  type AdminListState,
} from './listState';
import { FACILITY_STATUS_LABELS } from './status';

type Update = (patch: Partial<AdminListState>) => void;

const STRUCTURE_LABELS = {
  parent: 'Has spaces inside',
  child: 'Is a space inside',
  standalone: 'Standalone',
};

/** One chip per applied value. The default view, active and unavailable, is not a filter. */
export function buildActiveFilters(
  state: AdminListState,
  types: FacilityType[] | undefined,
  update: Update,
): ActiveFilter[] {
  const statuses = shownStatuses(state);
  const isDefault =
    statuses.length === DEFAULT_STATUSES.length &&
    DEFAULT_STATUSES.every((s) => statuses.includes(s));
  return [
    ...(isDefault
      ? []
      : statuses.map((status) => ({
          key: `status:${status}`,
          label: `Status: ${FACILITY_STATUS_LABELS[status]}`,
          onRemove: () => update({ status: statuses.filter((s) => s !== status) }),
        }))),
    ...state.type.map((id) => ({
      key: `type:${id}`,
      label: `Type: ${types?.find((t) => t.id === id)?.name ?? id}`,
      onRemove: () => update({ type: state.type.filter((t) => t !== id) }),
    })),
    ...state.locality.map((name) => ({
      key: `locality:${name}`,
      label: `Locality: ${name}`,
      onRemove: () => update({ locality: state.locality.filter((l) => l !== name) }),
    })),
    ...state.structure.map((structure) => ({
      key: `structure:${structure}`,
      label: STRUCTURE_LABELS[structure],
      onRemove: () => update({ structure: state.structure.filter((s) => s !== structure) }),
    })),
  ];
}

export { CLEARED_ADMIN_FILTERS, STRUCTURE_LABELS };
