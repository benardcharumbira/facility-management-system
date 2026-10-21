import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditEntry,
  type AuditExportRecord,
  type AuditQueryParams,
} from '../contracts/admin-audit';
import { id, instant, isoDate, obj, paginated, pageParams } from './common';
import type { Assert, Same } from './same';

export const auditAction = z.enum(AUDIT_ACTIONS);
export const auditEntityType = z.enum(AUDIT_ENTITY_TYPES);

export const auditEntry = obj({
  id,
  occurredAt: instant,
  actor: obj({ id, name: z.string() }).nullable(),
  action: auditAction,
  entityType: auditEntityType,
  entityId: z.string(),
  entityLabel: z.string(),
  summary: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});

export const auditList = paginated(auditEntry);

const filters = {
  from: isoDate
    .optional()
    .meta({ description: 'First day, inclusive, in the facility time zone.' }),
  to: isoDate.optional().meta({ description: 'Last day, inclusive.' }),
  actor: z.string().optional().meta({ description: "Matches the actor's name or id." }),
  entityType: z.array(auditEntityType).optional(),
  entityId: z.string().optional(),
  action: z.array(auditAction).optional(),
  reference: z
    .string()
    .optional()
    .meta({ description: 'A booking reference, in part, case insensitive.' }),
};
export const auditQuery = z.strictObject({ ...filters, ...pageParams });
export const auditExportQuery = z.strictObject({
  ...filters,
  from: isoDate.meta({ description: 'Required.' }),
  to: isoDate.meta({ description: 'Required.' }),
});

export const auditExportRecord = obj({
  filters: obj({
    from: isoDate.optional(),
    to: isoDate.optional(),
    actor: z.string().optional(),
    entityType: z.array(auditEntityType).optional(),
    entityId: z.string().optional(),
    action: z.array(auditAction).optional(),
    reference: z.string().optional(),
  }),
  rowCount: z.number().int().min(0),
});

export type _Checks = [
  Assert<Same<z.infer<typeof auditEntry>, AuditEntry>>,
  Assert<Same<z.infer<typeof auditQuery>, AuditQueryParams>>,
  Assert<Same<z.infer<typeof auditExportRecord>, AuditExportRecord>>,
];
