import {
  USER_AUDIENCES,
  USER_SORTS,
  USER_STATUSES,
  type AdminUserListParams,
  type UserAudience,
  type UserSort,
  type UserStatus,
} from '@/shared/api';
import { isRole, type Role } from '@/shared/auth';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

/** Everything the user list keeps in the URL. */
export interface UserListState {
  q: string;
  /** Staff by default: the public applicant list dwarfs it, and staff are why an administrator came. */
  audience: UserAudience;
  role: Role[];
  status: UserStatus[];
  /** Only facility administrators designated against nothing. */
  noFacilities: 'yes' | 'no';
  sort: UserSort;
  page: number;
}

export const userListCodec = createParamsCodec<UserListState>({
  q: param.string(),
  audience: param.oneOf(USER_AUDIENCES, 'staff'),
  role: param.stringList<Role>(),
  status: param.stringList<UserStatus>(),
  noFacilities: param.oneOf(['no', 'yes'] as const, 'no'),
  sort: param.oneOf(USER_SORTS, 'name'),
  page: param.positiveInt(1),
});

export const PAGE_SIZE = 25;

export function toListParams(state: UserListState): AdminUserListParams {
  return {
    q: state.q || undefined,
    audience: state.audience,
    role: state.role.filter(isRole),
    status: state.status.filter((s) => USER_STATUSES.includes(s)),
    approverWithoutFacilities: state.noFacilities === 'yes' || undefined,
    sort: state.sort,
    page: state.page,
    pageSize: PAGE_SIZE,
  };
}

export const CLEARED_USER_FILTERS: Partial<UserListState> = {
  role: [],
  status: [],
  noFacilities: 'no',
  page: 1,
};

export const isFiltered = (state: UserListState) =>
  state.q !== '' ||
  state.role.length > 0 ||
  state.status.length > 0 ||
  state.noFacilities === 'yes';
