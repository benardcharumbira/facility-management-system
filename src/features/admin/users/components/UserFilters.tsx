import { USER_STATUSES, type UserStatus } from '@/shared/api';
import { isRole, ROLE_LABELS, ROLES, type Role } from '@/shared/auth';
import { CheckboxGroupFilter, FilterSection, SwitchField } from '@/shared/components';
import { STATUS_LABELS } from '../labels';
import type { UserListState } from '../listState';

const ROLE_ORDER: Role[] = [
  ROLES.applicant,
  ROLES.internal,
  ROLES.facilityAdmin,
  ROLES.systemAdmin,
];

export function UserFilters({
  state,
  onChange,
}: {
  state: UserListState;
  onChange: (patch: Partial<UserListState>) => void;
}) {
  return (
    <div>
      <FilterSection title="Role" activeCount={state.role.length}>
        <CheckboxGroupFilter
          label="Role"
          options={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          selected={state.role}
          onChange={(role) => onChange({ role: role.filter(isRole), page: 1 })}
        />
      </FilterSection>
      <FilterSection title="Status" activeCount={state.status.length}>
        <CheckboxGroupFilter
          label="Status"
          options={USER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          selected={state.status}
          onChange={(status) => onChange({ status: status as UserStatus[], page: 1 })}
        />
      </FilterSection>
      <FilterSection title="Designation" activeCount={state.noFacilities === 'yes' ? 1 : 0}>
        <SwitchField
          label="Approvers with no facilities"
          checked={state.noFacilities === 'yes'}
          onChange={(on) => onChange({ noFacilities: on ? 'yes' : 'no', page: 1 })}
        />
      </FilterSection>
    </div>
  );
}
