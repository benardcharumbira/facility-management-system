# Behaviour the schema cannot carry

`openapi.yaml` says what the shapes are. It cannot say what the backend must **do**. These rules were specified, one slice at a time, in prompts the backend developer has never read, and none survives in a schema. A backend can match every shape and still be wrong: double book a hall, hold a slot for a draft nobody finished, or let an "impact check" cancel the bookings it was warning about.

Each rule is one line of what, one of why, and a status:

- **Agreed**: specified in a slice brief and not in question.
- **Open**: a recommendation the client has not yet confirmed. Build it as written, but keep it easy to change. The number refers to the question in `docs/facilities-data-gaps.md`.

Everything the frontend does is implemented by the mock in `src/mocks`, and the contract tests hold the mock to `openapi.yaml`, so the mock is the executable reference for any rule below that is unclear.

## 1. Hierarchy blocking is resolved server side. — Agreed

Facilities nest: a hall contains wings; a civic centre contains a committee room. Booking a parent blocks every child, and booking any child blocks the parent, for that window plus its buffers. `GET /facilities/{id}/availability` returns the result as `blocked_by_related` segments **naming the related facility** (`relatedFacility`, with its `relationship` to the one asked about), and the client draws what it is given. _Why:_ this system's main failure mode is double booking, and two implementations of containment (one in the client, one on the server) will eventually disagree.

## 2. Holds are placed on submit, never on draft save. — Agreed

`POST /bookings` and `PATCH /bookings/{id}` never hold or reserve time. Only `POST /bookings/{id}/submit` checks availability, across every day of the window, and places the hold (setting `holdExpiresAt`, then releasing the slot if it lapses undecided). A draft whose slot is taken in the meantime fails at `submit` with the slot conflict problem. _Why:_ otherwise every abandoned draft silently blocks a slot. (How long a hold lasts, and whether a long booking should hold for the same time, is open: Q47. The mock uses 72 hours.)

## 3. Competing requests must be hierarchy aware. — Agreed

`GET /approvals/{id}` returns `context.competingRequests` (other pending items that approving this one would make impossible) and `context.blockedBy` (approved bookings already in the way), computed on the **same facility, its parent and its children**, with each one’s `relationship` to the item being decided. A competing request is **not** rejected automatically when its rival is approved: it stays in the queue, can no longer be approved (`actions.approve.allowed` is false, with a reason), and needs a reason of its own to be rejected. _Why:_ an approver deciding one request must see everything it affects, and an applicant must be told by a person.

## 4. Impact checks never mutate. — Agreed

Every `…/impact` operation previews and returns. It does not cancel a booking, notify an applicant, or change any state, and it is safe to call as often as you like. It names the approved and pending bookings that have not yet ended and would be affected. A client calls it first and confirms before making the change; the change itself decides nothing about those bookings either. _Why:_ an administrator needs to see the consequence of a change before making it, and a check that acted would remove the choice.

## 5. Archive, never hard delete. — Agreed

Facilities, resources, seating arrangements, event types and users are archived (or deactivated), never deleted. There is no delete operation for any of them; the only deletes are a draft booking, a document, a blackout and an image. An archived record leaves the public estate and the booking form and keeps its name on everything that refers to it. _Why:_ they all appear in bookings and in the audit trail, which must stay readable. (How long archived personal data is kept is open: Q36.)

## 6. Published terms are immutable, and a booking records the version current at submission. — Agreed

A terms version is `draft`, `published` or `superseded`. Only a draft can be edited (`PATCH` on anything else is 409). Publishing supersedes the previous version in the same step, so exactly one version is published. A submission carrying any version other than the one published at that moment is refused (422 on `termsAccepted`), so the version recorded on a booking is the one the applicant was shown, not the one current when their draft was started. _Why:_ applicants accepted specific words.

## 7. Audit exports are themselves audited. — Agreed

`GET /admin/audit/export` records an `audit.exported` event with the actor, the filters and the row count, and requires both ends of a date range (422 otherwise): there is no unfiltered export. A refused export records nothing, because nothing was exported. _Why:_ an export of personal data that leaves no trace is the problem the audit trail exists to prevent.

## 8. Allocation batch saves are atomic. — Agreed

`PUT /admin/resource-allocations` (and the per facility form) applies every change or none. The server validates every change first and refuses the whole batch with 422, naming the cells at fault. If applying then fails part way, it puts everything back and answers 409 `batch-not-saved`. _Why:_ a partial save across a grid of edits is worse than a failed one, because nobody can tell what was applied.

## 9. Collection endpoints scope by identity on the server. — Agreed

`GET /bookings` returns the caller’s bookings; `GET /approvals` returns the queue of the facilities the caller is designated against (a system administrator sees all). Neither takes a user parameter, and the contract tests reject one. Asking for a record outside the caller’s scope answers **404**, not 403. _Why:_ identity comes from the session, and identifiers must not be probeable.

## 10. Recurring bookings are out of scope. — Agreed

Every booking is a single occurrence. There are no series, no occurrences, no partial availability within a booking and no per day cancellation. A booking over several days is **one** continuous span, with one reference, one approval decision and one status, which either fits or does not. If the client ever asks for any of those, it is recurring bookings returning under another name and should be re-scoped, not absorbed.

## 11. Operating hours constrain the first and last day of a span only. — Open (Q44)

Hours bind the **start** on the first day and the **end** on the last. Days wholly inside a span are occupied in full, whatever the venue’s hours, so a venue closed on Sundays can take a Friday to Sunday wedding; such a day appears in availability as `fully_booked` with `closedBy: "schedule"` and a segment covering the whole local day. A span cannot start or end on a closed day. **Blackouts still block the whole span** (`closedBy: "blackout"`). A public holiday is treated like weekly hours, not like a blackout. A booking may cover at most the facility’s `maximumBookingDays` calendar days. _Why:_ the common multi day case is a weekend event at a venue not staffed on Sundays.

## 12. Buffers apply at the outer edges of a booking. — Open (Q45)

A facility’s set-up and clear-down time are added **before the booking’s first moment and after its last**, never between the days of a span, and must be reflected in what availability returns (as `buffer` segments, or as `blocked_by_related` for a related facility’s buffer). A moment is never blocked twice: where intervals overlap the engine returns one segment by priority (closure, booked, held, blocked by related, buffer). Buffers do not count toward a span’s length. Whether a day to decorate should be a booked day or a buffer is open (Q45); today the applicant’s days and the municipality’s buffer are separate things.

---

## Also worth knowing

- **Roles are enforced on the server** from the resolved role, per operation. A grant (raising someone’s role) needs `confirmGrant: true`. Nobody can remove their own system administrator role or deactivate themselves, and the last active system administrator cannot be removed; `GET /admin/users/{id}` says so in advance in `protections`.
- **Deactivating a user, or removing the facility administrator role, removes their designations**, and reactivating does not restore them (Q33). Both can leave a facility with no approver, which `…/roles/impact` reports.
- **Clerk owns identity.** No endpoint writes a name, email address, password or contact detail held by Clerk. The only profile field this service owns is the optional contact telephone number (`/me/profile`), which is an addition the client has yet to confirm (Q41).
- **Placeholder content.** The legal pages and the terms wording in the mock are stand-ins (`status: placeholder`, `placeholder: true`). The real ones are the municipality’s to supply (Q37, Q38, Q39). The client withholds placeholder legal text in a production build.
- **What the mock does that the real API must not.** It accepts `Bearer user:<id>`; it returns facility images as `data:` URIs and `provisionalFields` on facilities; it has a `?mock=` switch; some operations are not authenticated that the contract says are.

## Corrections to earlier documents

Two delivered documents contradict this contract. **This contract supersedes them on these points:**

- **The Backend Specification** says the model must carry recurring series that expand into occurrences, and asks whether approval applies to a series or an occurrence. **Both are void.** Recurring bookings are out of scope (rule 10); the question does not arise. A booking is one occurrence and is approved as one.
- **The Developer Onboarding Brief** uses a nine month weekly league as its example of varied booking shapes. **The example is wrong** (it is a recurring series). The point it makes still holds for three shapes: an **hourly** booking, a **session** (a morning or an evening) and a **multi day** span. Those are all one start and one end instant; what differs is the rules around them.
