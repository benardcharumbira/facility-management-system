# Conventions

These recur across the whole API. They are stated once here; the examples in `openapi.yaml` follow them.

## Base URL and versioning

All paths are relative to `/api`. There is no version segment yet. A breaking change is announced under the change process in `api/README.md` and recorded in `api/CHANGELOG.md`.

## Authentication

Clerk issues a session JWT to the browser, which sends it as `Authorization: Bearer <token>`. The backend validates the signature against Clerk’s published JWKS, checks the issuer and expiry, and takes the **Clerk subject** as the user’s identity.

**Application roles are never in the token.** The backend resolves the role (`applicant`, `internal`, `facility_admin`, `system_admin`) from the subject, from its own data, on every request. The client reads it from `GET /me` for display only; the server enforces it. `public` operations need no token.

The mock accepts `Authorization: Bearer user:<id>` to act as a named user. That is a mock convention only: do not implement it.

## Identifiers

Opaque strings, stable for the life of the record, never reused, and not to be parsed by clients. The mock’s readable ids (`rothdene-hall`, `bk-12`) are for readability; the real ones may be anything. A booking’s `reference` (for example `MVL-2026-00417`) is a different thing: it is shown to people, assigned when the draft is created, and never changes.

## Collections

Every list that can grow returns **one envelope** and nothing else:

```json
{ "items": [], "page": 1, "pageSize": 24, "totalItems": 0, "totalPages": 0 }
```

`page` is 1 based. `totalPages` is **0** when there are no items. `pageSize` has a default per endpoint and a maximum of 100; a larger value is clamped, a malformed one is a 400. What a page past the end returns is not part of the contract (the mock is not consistent about it); clients never ask for one. Small fixed lists (the vocabularies, the terms versions, a facility’s blackouts) are plain arrays and say so.

## Filtering

- A multi value filter is sent as **a repeated parameter**: `type=hall&type=room`. Never comma separated.
- **Different filters combine with AND.** How the values of one filter combine is stated on that parameter. The rule differs by filter and is not to be assumed:
  - `GET /facilities`: `type` and `locality` are OR (any of them); `amenities` is AND (all of them); `minCapacity` and `maxCapacity` are inclusive and exclude facilities with no capacity.
  - Lists elsewhere (`status`, `role`, `category`, `facilityId`, `entityType`, `action`): values are OR.
- `q` is free text. It is split on whitespace and **every word must match** (case insensitive substring) one of the fields the endpoint names.
- `from` and `to` on a list are inclusive **dates** in the facility time zone.
- An unknown parameter is a 400. A client must not send a parameter an endpoint does not list.

## Sorting

`sort` takes one field name from the endpoint’s list. A leading `-` is descending: `-capacity`. Each endpoint states its default. Ties break by a stable secondary key so paging is repeatable.

## Dates and times

This is the part most likely to be gotten wrong, so it is stated without exceptions.

1. **Every instant that crosses the API is UTC ISO 8601, ending in `Z`**: `2026-11-14T06:00:00Z`. No offsets, no local times, no milliseconds required. This covers `startsAt`, `endsAt`, `submittedAt`, `holdExpiresAt`, `occurredAt`, segment bounds and every other `…At`.
2. **A facility has one time zone** (`Africa/Johannesburg`), returned wherever it matters as `timeZone` (on a booking’s `facility`, on an availability response, on an impacted booking). Clients do all display and selection in that zone and never in the browser’s. A facility’s zone does not change.
3. **A date with no time is an ISO date in the facility zone**: `2026-11-14`. That is what `date`, `from` and `to` mean on availability, on lists and on the audit trail. “The 14th” is the 14th in Johannesburg, whatever the caller’s zone.
4. **A wall clock time with no date is `HH:mm`, 24 hour, in the facility zone**: operating hours (`opensAt`, `closesAt`) and nothing else.
5. **Which day an instant is on** is decided by converting it to the facility zone. A booking from Friday 14:00 to Sunday 12:00 is `2026-11-27T12:00:00Z` to `2026-11-29T10:00:00Z` and covers the local days 27, 28 and 29. An end at exactly local midnight does not cover the next day.
6. **Daylight saving.** South Africa has none, but nothing may depend on that: arithmetic on local days is done in the zone, not by adding 24 hours to an instant.
7. **“Now”** is the server’s clock. The client never sends it. Rules that depend on it (minimum notice, the horizon, hold expiry) are decided on the server.

## Errors

RFC 7807 problem documents, `application/problem+json`, with a stable `type` URI. The full catalogue, with when each is sent and what the client does with it, is `api/ERRORS.md`. In short: 400 invalid query, 401 no session, 403 role not allowed, 404 not found (also used where telling someone a record exists would leak it), 409 a state conflict (with specific types for a slot conflict, an already decided item, an action not allowed and a batch not saved), 422 validation with field level `errors`, 5xx failure.

## Permissions

Stated per operation (`Roles:` in its description). They are enforced on the server from the resolved role; the interface hiding a control is a courtesy, not a control. Collection endpoints scope by the caller’s identity on the server and never take a user parameter.

## Uploads and downloads

Uploads are `multipart/form-data` with a part named `file`. Downloads send the file with `Content-Disposition: attachment`. Both go through the same authentication as everything else; a document is never a public URL.

## Idempotence and concurrency

`submit`, `approve`, `reject` and the other state changes are safe to repeat: repeating one that has already happened returns the current state, or a 409 saying someone else got there first (`already decided`). Nothing in the API relies on optimistic locking tokens yet.
