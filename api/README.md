# The API contract

This directory is what the backend is built against.

| File               | What it is                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `openapi.yaml`     | Every operation, schema, status code and example. **Generated.**                                         |
| `BEHAVIOUR.md`     | The twelve rules a schema cannot carry, each marked agreed or open. **Read it first.**                   |
| `CONVENTIONS.md`   | The conventions that recur: envelope, filters, sorting, dates and times, identifiers, authentication.    |
| `ERRORS.md`        | The error catalogue: every problem `type` the client handles specifically. **Generated.**                |
| `INVENTORY.md`     | Every operation by the slice that defined it, as a checked list. **Generated.**                          |
| `DISCREPANCIES.md` | Where a slice prompt and its handler disagreed, and the decision.                                        |
| `CHANGELOG.md`     | Every change to the contract.                                                                            |
| `build/index.html` | The same contract rendered with Redoc, one self contained page. Not committed; built by `npm run build`. |

`openapi.yaml`, `ERRORS.md` and `INVENTORY.md` are not written by hand. `BEHAVIOUR.md` and `CONVENTIONS.md` are, and are included in the rendered view.

## Where it comes from

```
src/shared/api/schemas/    Zod schemas for every request and response shape
src/shared/api/schemas/operations.ts   every operation: path, access, schemas, problems, example scenarios
        │
        ├── runtime validation   (the schemas)
        ├── TypeScript types     (checked equal to the interfaces in src/shared/api/contracts)
        └── the contract         (npm run api:generate  ->  this directory)

examples: each scenario in operations.ts is run against the mock and its real response is kept
```

One definition gives the runtime validation, the types and the published contract, and the mock is held to it:

- **Every response a default handler sends is validated against its schema, and every request the client makes against its request schema, in every test.** A handler that sends a field the contract does not describe, a status it does not list, a problem without a catalogue `type`, or a client that sends an undeclared query parameter, fails the test it happened in. (`src/test/contract.ts`, `src/api-contract/validate.ts`.)
- **The committed copy is checked for staleness** by a test and by `npm run api:check`, which CI runs: it regenerates everything and fails if the result differs.
- **The schemas cannot drift from the interfaces:** each schema file ends with compile time checks that its schema and the matching interface in `src/shared/api/contracts` are assignable to each other.

## Commands

```
npm run api:generate   regenerate openapi.yaml, ERRORS.md and INVENTORY.md from the schemas and the mock
npm run api:check      fail if the committed copies are stale (CI runs this)
npm run api:docs       render the HTML view into api/build/ and check it shows every operation
```

## Changing the contract

**A change to the contract needs a changelog entry and a message to the backend developer before it merges. A breaking change is flagged as such.**

1. Change the schema (and the interface) and the operation, then the mock.
2. `npm run api:generate`, and commit the result with the change.
3. Add a line to `CHANGELOG.md`, marked **BREAKING** if a client built against the previous version would get it wrong.
4. Tell the backend developer before the merge, not after.

## Handing it over

How the backend developer receives this is agreed before the handover, not after. The proposal: the repository is shared read only, the backend developer builds against `main`, and they are added to the pull request review for any change under `api/` or `src/shared/api/schemas/`. The rendered `api/build/index.html` is attached to each release for anyone who prefers not to run the project.

Two earlier documents are superseded by this one on the points listed under "Corrections to earlier documents" in `BEHAVIOUR.md`: the Backend Specification (recurring series are void) and the Developer Onboarding Brief (the weekly league example).
