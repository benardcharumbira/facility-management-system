import { ApiProblem } from '@/shared/api';

/** The first message for each field of a failed request, keyed by field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  const problem = ApiProblem.from(error);
  return Object.fromEntries(
    Object.entries(problem.errors).flatMap(([field, messages]) =>
      messages[0] ? [[field, messages[0]]] : [],
    ),
  );
}

/** What to tell the person when a request fails and there is no field to point at. */
export function failureMessage(error: unknown): string {
  const problem = ApiProblem.from(error);
  return problem.detail ?? problem.title;
}

/** One sentence for a failed request: its first field message if it has any, else its detail. */
export function explain(error: unknown): string {
  return Object.values(fieldErrors(error))[0] ?? failureMessage(error);
}
