import { useId, useState } from 'react';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from '@/shared/api';
import { Button, controlStyles, FormField } from '@/shared/components';
import { ACTION_LABELS, ENTITY_LABELS } from '../labels';
import { CLEARED_AUDIT, isFiltered, type AuditState } from '../listState';

/**
 * The other questions to ask of the trail. They are held as a draft and applied together, so a
 * half typed identifier does not run a query, and the answer is addressable in the URL.
 */
export function AuditFilters({
  state,
  onApply,
}: {
  state: AuditState;
  onApply: (patch: Partial<AuditState>) => void;
}) {
  const id = useId();
  const [from, setFrom] = useState(state.from ?? '');
  const [to, setTo] = useState(state.to ?? '');
  const [actor, setActor] = useState(state.actor);
  const [entityType, setEntityType] = useState<AuditEntityType | ''>(state.entityType[0] ?? '');
  const [entityId, setEntityId] = useState(state.entityId);
  const [action, setAction] = useState<AuditAction | ''>(state.action[0] ?? '');

  const reversed = from !== '' && to !== '' && from > to;

  return (
    <form
      aria-label="Filter the audit trail"
      onSubmit={(event) => {
        event.preventDefault();
        if (reversed) return;
        onApply({
          from: from || undefined,
          to: to || undefined,
          actor: actor.trim(),
          entityType: entityType ? [entityType] : [],
          entityId: entityId.trim(),
          action: action ? [action] : [],
          page: 1,
        });
      }}
      className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id={`${id}-from`} label="From">
          {(control) => (
            <input
              {...control}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField
          id={`${id}-to`}
          label="To"
          error={reversed ? 'The last day cannot be before the first.' : undefined}
        >
          {(control) => (
            <input
              {...control}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField id={`${id}-actor`} label="Done by" hint="A name or an identifier.">
          {(control) => (
            <input
              {...control}
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField id={`${id}-type`} label="Kind of record">
          {(control) => (
            <select
              {...control}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as AuditEntityType | '')}
              className={`${controlStyles} h-10`}
            >
              <option value="">Any</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          id={`${id}-entity`}
          label="Record identifier"
          hint="The identifier of one record."
        >
          {(control) => (
            <input
              {...control}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className={`${controlStyles} h-10`}
            />
          )}
        </FormField>
        <FormField id={`${id}-action`} label="Action">
          {(control) => (
            <select
              {...control}
              value={action}
              onChange={(e) => setAction(e.target.value as AuditAction | '')}
              className={`${controlStyles} h-10`}
            >
              <option value="">Any</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={reversed}>
          Apply filters
        </Button>
        <Button
          variant="secondary"
          disabled={
            !isFiltered(state) && !from && !to && !actor && !entityType && !entityId && !action
          }
          onClick={() => {
            setFrom('');
            setTo('');
            setActor('');
            setEntityType('');
            setEntityId('');
            setAction('');
            onApply(CLEARED_AUDIT);
          }}
        >
          Clear filters
        </Button>
      </div>
    </form>
  );
}
