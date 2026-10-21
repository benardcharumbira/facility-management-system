import type { SetupServer } from 'msw/node';
import { validateRequest, validateResponse } from '@/api-contract/validate';

/**
 * Holds every request the client makes and every response a default handler sends to the API
 * contract, for the whole test run. A request the contract does not allow, or a response it does
 * not describe, fails the test it happened in.
 *
 * A test that installs its own handler with `server.use` is deliberately off the contract (it is
 * making the server misbehave to see what the client does), so its responses are not checked. Its
 * requests still are.
 */
/**
 * A test that sends the server something the contract forbids, to see that it is refused, says so
 * with this. Responses are still checked: the refusal has to be a documented one.
 */
export function sendsInvalidRequests() {
  exemptions.invalidRequests = true;
}
const exemptions = { invalidRequests: false };

export function installContractChecks(server: SetupServer) {
  let issues: string[] = [];
  let pending: Promise<void>[] = [];
  let overridden = false;

  const addHandlers = server.use.bind(server);
  server.use = (...handlers) => {
    overridden = true;
    addHandlers(...handlers);
  };

  server.events.on('request:start', ({ request }) => {
    pending.push(
      request
        .clone()
        .text()
        .then((bodyText) => {
          if (exemptions.invalidRequests) return;
          issues.push(
            ...validateRequest({
              method: request.method,
              url: request.url,
              contentType: request.headers.get('Content-Type') ?? '',
              bodyText,
            }),
          );
        }),
    );
  });

  server.events.on('response:mocked', ({ request, response }) => {
    if (overridden) return;
    pending.push(
      response
        .clone()
        .text()
        .then((bodyText) => {
          issues.push(
            ...validateResponse({
              method: request.method,
              url: request.url,
              status: response.status,
              contentType: response.headers.get('Content-Type') ?? '',
              bodyText,
              headers: response.headers,
            }),
          );
        }),
    );
  });

  return {
    reset() {
      issues = [];
      pending = [];
      overridden = false;
      exemptions.invalidRequests = false;
    },
    /** Throws, naming every way the API contract was broken during the test. */
    async assertClean() {
      await Promise.all(pending);
      if (issues.length > 0) {
        const found = [...new Set(issues)].slice(0, 12);
        throw new Error(`The API contract was broken:\n  - ${found.join('\n  - ')}`);
      }
    },
  };
}
