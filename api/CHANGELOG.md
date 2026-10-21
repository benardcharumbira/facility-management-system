# API changelog

Every change to the contract, newest first. A **breaking** change is one a client built against the previous version would get wrong: a removed or renamed field, a narrowed value, a changed status or problem `type`, a new required request field. It is marked **BREAKING** and the backend developer is told before it merges. See the change process in `api/README.md`.

The version in `openapi.yaml` is `1.0.0` until the backend first builds against it; from then, additive changes bump the minor number and breaking ones the major.

## 1.0.0 — the first consolidated contract

The contract as it stands after thirteen slices of the frontend, written down for the first time as one document. It is generated from the schemas and the mock; nothing here was hand written.

**Added**

- `api/openapi.yaml`: 87 operations, every schema, every status, with examples captured from the mock.
- `api/BEHAVIOUR.md`: the twelve rules a schema cannot carry.
- `api/CONVENTIONS.md`, `api/ERRORS.md`, `api/INVENTORY.md`, `api/DISCREPANCIES.md`.

**Changed in the mock to make the contract unambiguous** (nothing the backend has built against yet, so not marked breaking)

- Every problem document now carries a stable `type` URI from the catalogue in `api/ERRORS.md`. Before, only a slot conflict, an already decided item and an action not allowed had one; the rest were `about:blank`. The three existing URIs are unchanged.
- Allocation batch failures (`PUT /admin/resource-allocations`, `PUT /admin/facilities/{id}/resources`) now use the `batch-not-saved` type.
- Guard rail refusals on a user’s role or account use the `action-not-allowed` type, with their `code`.
- Requests and responses are checked against the schemas in every test run. Objects are strict: the mock may not send a field the contract does not describe, and the client may not send a query parameter an operation does not list.
