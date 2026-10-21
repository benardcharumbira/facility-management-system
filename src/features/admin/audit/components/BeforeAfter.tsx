import type { AuditEntry } from '@/shared/api';

const humanise = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function show(value: unknown): string {
  if (value === undefined || value === null) return 'Not set';
  if (typeof value === 'string') return value === '' ? 'Empty' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * What an entry changed: every field in the state before and after, side by side, with the ones
 * that differ marked in words, not only by style. An entry with no before state created something.
 */
export function BeforeAfter({
  before: recordedBefore,
  after: recordedAfter,
}: Pick<AuditEntry, 'before' | 'after'>) {
  const before = recordedBefore ?? {};
  const after = recordedAfter ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  if (keys.length === 0) {
    return <p className="text-muted">No state was recorded for this entry.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {recordedBefore === null && (
        <p className="text-sm text-muted">There was nothing before: this entry created it.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-96 border-collapse text-left text-sm">
          <caption className="sr-only">State before and after</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="py-1 pr-3 font-medium">
                Field
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Before
              </th>
              <th scope="col" className="py-1 font-medium">
                After
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const changed = show(before[key]) !== show(after[key]);
              return (
                <tr key={key} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-medium">
                    {humanise(key)}
                    {changed && <span className="font-normal text-muted"> (changed)</span>}
                  </th>
                  <td className="py-1.5 pr-3 [overflow-wrap:anywhere]">{show(before[key])}</td>
                  <td
                    className={`py-1.5 [overflow-wrap:anywhere] ${changed ? 'font-semibold' : ''}`}
                  >
                    {show(after[key])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
