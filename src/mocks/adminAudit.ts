/**
 * The server side behaviour the real audit API must reproduce. In particular:
 *
 * - System administrators only: the trail holds personal information.
 * - Read only, newest first, paginated with the standard envelope.
 * - An export needs both ends of a date range, so there is no export of everything, and it
 *   records an `audit.exported` event: who, which filters, how many rows.
 * - Cells that a spreadsheet would read as a formula are neutralised in the CSV.
 */
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
  type AuditEntry,
  type AuditExportRecord,
  type AuditFilters,
  type AuditList,
  type AuditQueryParams,
} from '@/shared/api';
import { addError, invalid, problem, requireSystemAdmin, type Errors } from './adminGuard';
import { auditStore } from './data/auditStore';
import { userIdOf } from './data/staff';

class BadQuery extends Error {}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => DATE.test(value) && DateTime.fromISO(value).isValid;

export function parseAuditParams(search: URLSearchParams): AuditQueryParams {
  const integer = (name: string) => {
    const raw = search.get(name);
    if (raw === null) return undefined;
    if (!/^\d+$/.test(raw)) throw new BadQuery(`"${name}" must be a non-negative integer.`);
    return Number(raw);
  };
  const types = search.getAll('entityType');
  if (types.some((t) => !AUDIT_ENTITY_TYPES.includes(t as AuditEntityType))) {
    throw new BadQuery(`"entityType" must be one of: ${AUDIT_ENTITY_TYPES.join(', ')}.`);
  }
  const actions = search.getAll('action');
  if (actions.some((a) => !AUDIT_ACTIONS.includes(a as AuditAction))) {
    throw new BadQuery('"action" is not a known action.');
  }
  return {
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
    actor: search.get('actor') ?? undefined,
    entityType: types as AuditEntityType[],
    entityId: search.get('entityId') ?? undefined,
    action: actions as AuditAction[],
    reference: search.get('reference') ?? undefined,
    page: integer('page'),
    pageSize: integer('pageSize'),
  };
}

function dateErrors({ from, to }: AuditFilters, required: boolean): Errors {
  const errors: Errors = {};
  for (const [field, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value === undefined || value === '') {
      if (required)
        addError(errors, field, `Choose the ${field === 'from' ? 'first' : 'last'} day to export.`);
    } else if (!validDate(value)) {
      addError(errors, field, 'Enter a date as year-month-day.');
    }
  }
  if (from && to && validDate(from) && validDate(to) && from > to) {
    addError(errors, 'to', 'The last day cannot be before the first.');
  }
  return errors;
}

const filtersOf = (p: AuditQueryParams): AuditFilters => ({
  from: p.from || undefined,
  to: p.to || undefined,
  actor: p.actor || undefined,
  entityType: p.entityType?.length ? p.entityType : undefined,
  entityId: p.entityId || undefined,
  action: p.action?.length ? p.action : undefined,
  reference: p.reference || undefined,
});

export function listAudit(params: AuditQueryParams): AuditList {
  const rows = auditStore.query(filtersOf(params));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, params.page ?? 1), totalPages);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: rows.length,
    totalPages,
  };
}

/** A spreadsheet reads a leading = + - @ as a formula; a leading apostrophe makes it text. */
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: AuditEntry[]): string {
  const header = [
    'When (UTC)',
    'Actor',
    'Actor id',
    'Action',
    'Entity type',
    'Entity',
    'Entity id',
    'Summary',
    'Before',
    'After',
  ];
  const lines = rows.map((e) =>
    [
      e.occurredAt,
      e.actor?.name ?? 'System',
      e.actor?.id ?? '',
      e.action,
      e.entityType,
      e.entityLabel,
      e.entityId,
      e.summary,
      e.before ? JSON.stringify(e.before) : '',
      e.after ? JSON.stringify(e.after) : '',
    ]
      .map(cell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

export interface AdminAuditHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  fail?: () => boolean;
  ready?: () => void;
}

export function createAdminAuditHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), fail, ready }: AdminAuditHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const guarded =
    (handle: (request: Request) => Response | Promise<Response>) =>
    async ({ request }: { request: Request }) => {
      await wait();
      ready?.();
      const refused = requireSystemAdmin(request, 'the audit trail');
      if (refused) return refused;
      if (fail?.()) return problem(500, 'Mock failure', 'The audit service is unavailable.');
      try {
        return await handle(request);
      } catch (error) {
        if (error instanceof BadQuery) return problem(400, 'Invalid query', error.message);
        throw error;
      }
    };

  return [
    http.get(
      `${root}/admin/audit`,
      guarded((request) => {
        const params = parseAuditParams(new URL(request.url).searchParams);
        const errors = dateErrors(params, false);
        return Object.keys(errors).length > 0
          ? invalid(errors)
          : HttpResponse.json(listAudit(params));
      }),
    ),

    http.get(
      `${root}/admin/audit/export`,
      guarded((request) => {
        const params = parseAuditParams(new URL(request.url).searchParams);
        const errors = dateErrors(params, true);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const filters = filtersOf(params);
        const rows = auditStore.query(filters);
        // The export is itself an event, recorded with who, which filters and how many rows.
        const record: AuditExportRecord = { filters, rowCount: rows.length };
        auditStore.record({
          occurredAt: now().toUTC().toISO({ suppressMilliseconds: true }) ?? '',
          actor: userIdOf(request),
          action: 'audit.exported',
          entityType: 'audit',
          entityId: 'export',
          entityLabel: 'Audit export',
          summary: `Exported ${rows.length} audit ${rows.length === 1 ? 'entry' : 'entries'} from ${filters.from} to ${filters.to}.`,
          before: null,
          after: { ...record },
        });
        return new HttpResponse(toCsv(rows), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="audit-${filters.from}-to-${filters.to}.csv"`,
            'X-Row-Count': String(rows.length),
          },
        });
      }),
    ),
  ];
}
