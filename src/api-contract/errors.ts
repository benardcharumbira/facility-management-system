import { PROBLEM_CATALOGUE } from '@/shared/api/contracts/problem-types';
import type { Operation } from '@/shared/api/schemas/operation';
import { OPERATIONS } from '@/shared/api/schemas/operations';
import { problemStatusesOf } from './document';

/** Which operations can answer with each problem, from the registry. */
function answeredBy(type: string, operations: Operation[]): string[] {
  const keyFor: Record<string, string[]> = {
    'slot-conflict': ['slotConflict'],
    'already-decided': ['alreadyDecided'],
    'action-not-allowed': ['actionNotAllowed'],
    'validation-failed': ['validation'],
    'batch-not-saved': ['batchNotSaved'],
    'not-found': ['notFound'],
    conflict: ['conflict'],
    'invalid-query': ['invalidQuery'],
  };
  const keys = keyFor[type.split('/').pop() ?? ''];
  if (!keys) return [];
  return operations
    .filter((o) => [...problemStatusesOf(o).values()].flat().some((k) => keys.includes(k)))
    .map((o) => o.id);
}

/** The error catalogue as Markdown, generated so it cannot drift from the registry. */
export function errorsMarkdown(operations: Operation[] = OPERATIONS): string {
  const lines = [
    '# Error catalogue',
    '',
    'Every error is an [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) problem document with media type `application/problem+json`, a `type` URI from the list below, a `title`, the HTTP `status`, and a `detail` an end user can read. A problem whose shape matches but whose `type` or status differs from what is listed here is behaviourally wrong: the client keys on the `type`, not the text. A generic 400 where a specific type is listed is a bug.',
    '',
  ];
  for (const entry of PROBLEM_CATALOGUE) {
    const who = answeredBy(entry.type, operations);
    lines.push(
      `## ${entry.status} ${entry.title}`,
      '',
      `\`${entry.type}\``,
      '',
      `- **When:** ${entry.when}`,
      `- **Extension members:** ${entry.members}`,
      `- **What the client does:** ${entry.client}`,
      ...(who.length > 0 && who.length <= 12
        ? [`- **Operations:** ${who.map((id) => `\`${id}\``).join(', ')}`]
        : []),
      ...(who.length > 12
        ? [
            `- **Operations:** ${who.length} of the ${operations.length} (every operation that takes a path identifier, a body or a query, as applicable).`,
          ]
        : []),
      '',
    );
  }
  return lines.join('\n');
}
