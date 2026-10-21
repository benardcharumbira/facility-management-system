/**
 * The named schemas of the contract. Every schema exported from `shared/api/schemas` becomes a
 * component of the OpenAPI document, named from its export, so a shape defined once is referred to
 * rather than repeated.
 */
import { z } from 'zod';
import * as adminAudit from '@/shared/api/schemas/admin-audit';
import * as adminFacilities from '@/shared/api/schemas/admin-facilities';
import * as adminReference from '@/shared/api/schemas/admin-reference';
import * as adminResources from '@/shared/api/schemas/admin-resources';
import * as adminUsers from '@/shared/api/schemas/admin-users';
import * as approvals from '@/shared/api/schemas/approvals';
import * as availability from '@/shared/api/schemas/availability';
import * as bookings from '@/shared/api/schemas/bookings';
import { idName } from '@/shared/api/schemas/common';
import * as facilities from '@/shared/api/schemas/facilities';
import * as problems from '@/shared/api/schemas/problems';
import * as pub from '@/shared/api/schemas/public';

const MODULES: Array<Record<string, unknown>> = [
  { idName },
  facilities,
  availability,
  bookings,
  approvals,
  adminFacilities,
  adminResources,
  adminUsers,
  adminReference,
  adminAudit,
  pub,
  problems,
];

/** Query schemas become parameters, not components. */
const isComponent = (name: string, value: unknown): value is z.ZodType =>
  value instanceof z.ZodType && !name.endsWith('Query') && !name.startsWith('_');

const pascal = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export const registry = z.registry<{ id: string }>();
export const componentNames = new Map<z.ZodType, string>();

for (const module of MODULES) {
  // Alphabetical, so the document does not depend on how a module system orders its exports.
  for (const [name, value] of Object.entries(module).sort(([a], [b]) => a.localeCompare(b))) {
    // A schema re-exported under another name keeps the first name it was given.
    if (!isComponent(name, value) || componentNames.has(value)) continue;
    const id = pascal(name);
    registry.add(value, { id });
    componentNames.set(value, id);
  }
}

export const refTo = (name: string) => ({ $ref: `#/components/schemas/${name}` });
