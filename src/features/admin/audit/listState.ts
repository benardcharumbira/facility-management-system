import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
  type AuditQueryParams,
} from '@/shared/api';
import { createParamsCodec, param } from '@/shared/utils/params-codec';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Everything the audit query keeps in the URL, so a question can be linked and survives a reload. */
export interface AuditState {
  /** A booking reference, or part of one. The usual real question. */
  reference: string;
  from: string | undefined;
  to: string | undefined;
  actor: string;
  entityType: AuditEntityType[];
  entityId: string;
  action: AuditAction[];
  page: number;
}

export const auditCodec = createParamsCodec<AuditState>({
  reference: param.string(),
  from: param.matching(DATE),
  to: param.matching(DATE),
  actor: param.string(),
  entityType: param.stringList<AuditEntityType>(),
  entityId: param.string(),
  action: param.stringList<AuditAction>(),
  page: param.positiveInt(1),
});

export const PAGE_SIZE = 25;

export const toFilters = (state: AuditState): AuditQueryParams => ({
  reference: state.reference || undefined,
  from: state.from,
  to: state.to,
  actor: state.actor || undefined,
  entityType: state.entityType.filter((t) => AUDIT_ENTITY_TYPES.includes(t)),
  entityId: state.entityId || undefined,
  action: state.action.filter((a) => AUDIT_ACTIONS.includes(a)),
});

export const toQuery = (state: AuditState): AuditQueryParams => ({
  ...toFilters(state),
  page: state.page,
  pageSize: PAGE_SIZE,
});

export const CLEARED_AUDIT: Partial<AuditState> = {
  reference: '',
  from: undefined,
  to: undefined,
  actor: '',
  entityType: [],
  entityId: '',
  action: [],
  page: 1,
};

export const isFiltered = (state: AuditState) =>
  state.reference !== '' ||
  state.from !== undefined ||
  state.to !== undefined ||
  state.actor !== '' ||
  state.entityType.length > 0 ||
  state.entityId !== '' ||
  state.action.length > 0;
