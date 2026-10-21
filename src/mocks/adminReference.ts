/**
 * The server side behaviour the real reference data API must reproduce. In particular:
 *
 * - System administrators only.
 * - Seating arrangements and event types are archived, never deleted: bookings and capacity figures
 *   refer to them. An archived entry leaves the booking form and keeps its name on old bookings.
 * - Archiving a seating arrangement that facilities hold capacity figures against has an impact
 *   check, which names the facilities and the bookings. Renaming one carries the figures with it.
 * - A published terms version is immutable. Publishing a draft supersedes the one before it in the
 *   same step. A booking submission must carry the version current at that moment.
 * - Every change is recorded in the audit trail.
 */
import { DateTime } from 'luxon';
import { delay, http, HttpResponse } from 'msw';
import {
  MAX_TERMS_PARAGRAPH_LENGTH,
  MAX_TERMS_PARAGRAPHS,
  type CreateReferenceRequest,
  type CreateTermsRequest,
  type PublishedTerms,
  type ReferenceEntry,
  type TermsVersion,
  type UpdateReferenceRequest,
} from '@/shared/api';
import { addError, invalid, problem, requireSystemAdmin, type Errors } from './adminGuard';
import { auditStore, type NewAuditEntry } from './data/auditStore';
import { bookingStore } from './data/bookingStore';
import { facilityStore } from './data/facilityStore';
import { referenceStore, type ReferenceKind, type StoredReference } from './data/referenceStore';
import { termsStore, type StoredTerms } from './data/termsStore';
import { userIdOf } from './data/staff';
import { seatingImpact } from './data/userImpact';
import { userStore } from './data/userStore';

const MAX_NAME = 60;
const MAX_TITLE = 120;
const MAX_ORDER = 9999;

const KINDS: Array<{ kind: ReferenceKind; path: string; noun: string }> = [
  { kind: 'seating_arrangement', path: 'seating-arrangements', noun: 'seating arrangement' },
  { kind: 'event_type', path: 'event-types', noun: 'event type' },
];

function usage(kind: ReferenceKind, entry: StoredReference): ReferenceEntry['usage'] {
  if (kind === 'event_type') {
    return {
      facilities: 0,
      bookings: bookingStore.all().filter((b) => b.booking.eventTypeId === entry.id).length,
    };
  }
  const name = entry.name.toLowerCase();
  return {
    facilities: facilityStore
      .all()
      .filter(
        (f) =>
          !f.archived && f.capacity.byArrangement.some((c) => c.arrangement.toLowerCase() === name),
      ).length,
    bookings: bookingStore.all().filter((b) => b.booking.seatingArrangementId === entry.id).length,
  };
}

const toEntry = (kind: ReferenceKind, r: StoredReference): ReferenceEntry => ({
  id: r.id,
  name: r.name,
  displayOrder: r.displayOrder,
  status: r.archived ? 'archived' : 'active',
  usage: usage(kind, r),
});

function validateEntry(
  kind: ReferenceKind,
  body: Partial<CreateReferenceRequest>,
  current: StoredReference | null,
): Errors {
  const errors: Errors = {};
  if (!current || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') addError(errors, 'name', 'Enter a name.');
    else if (name.length > MAX_NAME)
      addError(errors, 'name', `Use ${MAX_NAME} characters or fewer.`);
    else if (
      referenceStore
        .all(kind)
        .some((r) => r.id !== current?.id && r.name.toLowerCase() === name.toLowerCase())
    ) {
      addError(errors, 'name', `There is already one called ${name}.`);
    }
  }
  if (body.displayOrder !== undefined) {
    if (
      !Number.isInteger(body.displayOrder) ||
      body.displayOrder < 0 ||
      body.displayOrder > MAX_ORDER
    ) {
      addError(errors, 'displayOrder', `Enter a whole number from 0 to ${MAX_ORDER}.`);
    }
  }
  return errors;
}

function validateTerms(body: Partial<CreateTermsRequest>, partial: boolean): Errors {
  const errors: Errors = {};
  if (!partial || body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title === '') addError(errors, 'title', 'Enter a title.');
    else if (title.length > MAX_TITLE)
      addError(errors, 'title', `Use ${MAX_TITLE} characters or fewer.`);
  }
  if (!partial || body.paragraphs !== undefined) {
    const paragraphs = body.paragraphs;
    if (
      !Array.isArray(paragraphs) ||
      paragraphs.some((p) => typeof p !== 'string') ||
      paragraphs.every((p) => (p as string).trim() === '')
    ) {
      addError(errors, 'paragraphs', 'Write the terms: at least one paragraph.');
    } else if (paragraphs.length > MAX_TERMS_PARAGRAPHS) {
      addError(errors, 'paragraphs', `Use ${MAX_TERMS_PARAGRAPHS} paragraphs or fewer.`);
    } else if ((paragraphs as string[]).some((p) => p.length > MAX_TERMS_PARAGRAPH_LENGTH)) {
      addError(
        errors,
        'paragraphs',
        `Keep each paragraph to ${MAX_TERMS_PARAGRAPH_LENGTH} characters or fewer.`,
      );
    }
  }
  return errors;
}

const cleanParagraphs = (paragraphs: string[]) =>
  paragraphs.map((p) => p.trim()).filter((p) => p !== '');

const toTerms = (t: StoredTerms): TermsVersion => ({
  ...t,
  bookings: bookingStore.all().filter((b) => b.booking.acceptedTermsVersion === t.version).length,
});

export interface AdminReferenceHandlerOptions {
  delayMs: number;
  now?: () => DateTime;
  fail?: () => boolean;
  ready?: () => void;
}

export function createAdminReferenceHandlers(
  root: string,
  { delayMs, now = () => DateTime.now(), fail, ready }: AdminReferenceHandlerOptions,
) {
  const wait = () => (delayMs > 0 ? delay(delayMs) : Promise.resolve());
  const stamp = () => now().toUTC().toISO({ suppressMilliseconds: true }) ?? '';

  const sysadmin =
    (
      handle: (context: {
        request: Request;
        params: Record<string, unknown>;
      }) => Response | Promise<Response>,
    ) =>
    async ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
      await wait();
      ready?.();
      const refused = requireSystemAdmin(request, 'reference data');
      if (refused) return refused;
      if (fail?.())
        return problem(500, 'Mock failure', 'The reference data service is unavailable.');
      return handle({ request, params });
    };

  const audit = (request: Request, entry: Omit<NewAuditEntry, 'occurredAt' | 'actor'>) =>
    auditStore.record({ ...entry, occurredAt: stamp(), actor: userIdOf(request) });

  const vocabulary = ({ kind, path, noun }: (typeof KINDS)[number]) => {
    const base = `${root}/admin/${path}`;
    const withEntry = (
      handle: (r: StoredReference, request: Request) => Response | Promise<Response>,
    ) =>
      sysadmin(({ request, params }) => {
        const found = referenceStore.get(kind, String(params.id));
        return found ? handle(found, request) : problem(404, `${noun} not found`);
      });
    const record = (
      request: Request,
      action: 'created' | 'updated' | 'archived' | 'restored',
      entry: StoredReference,
      before: Record<string, unknown> | null,
      summary: string,
    ) =>
      audit(request, {
        action: `${kind}.${action}` as `${typeof kind}.${typeof action}`,
        entityType: kind,
        entityId: entry.id,
        entityLabel: entry.name,
        summary,
        before,
        after: { name: entry.name, displayOrder: entry.displayOrder, archived: entry.archived },
      });
    const state = (r: StoredReference) => ({
      name: r.name,
      displayOrder: r.displayOrder,
      archived: r.archived,
    });
    const archivedProblem = () =>
      problem(409, `That ${noun} is archived`, 'Restore it before changing it.');

    return [
      http.get(
        base,
        sysadmin(() => HttpResponse.json(referenceStore.all(kind).map((r) => toEntry(kind, r)))),
      ),

      http.post(
        base,
        sysadmin(async ({ request }) => {
          const body = (await request.json().catch(() => ({}))) as Partial<CreateReferenceRequest>;
          const errors = validateEntry(kind, body, null);
          if (Object.keys(errors).length > 0) return invalid(errors);
          const name = (body.name as string).trim();
          const entry: StoredReference = {
            id: referenceStore.newId(kind, name),
            name,
            displayOrder: body.displayOrder ?? referenceStore.nextOrder(kind),
            archived: false,
          };
          referenceStore.set(kind, entry);
          record(request, 'created', entry, null, `Added the ${noun} ${name}.`);
          return HttpResponse.json(toEntry(kind, entry), { status: 201 });
        }),
      ),

      http.patch(
        `${base}/:id`,
        withEntry(async (entry, request) => {
          if (entry.archived) return archivedProblem();
          const body = (await request.json().catch(() => ({}))) as UpdateReferenceRequest;
          const errors = validateEntry(kind, body, entry);
          if (Object.keys(errors).length > 0) return invalid(errors);
          const updated = {
            ...entry,
            name: body.name === undefined ? entry.name : body.name.trim(),
            displayOrder: body.displayOrder ?? entry.displayOrder,
          };
          // Capacity figures name the arrangement, so a rename carries them with it.
          if (kind === 'seating_arrangement' && updated.name !== entry.name) {
            for (const f of facilityStore.all()) {
              if (
                f.capacity.byArrangement.some(
                  (c) => c.arrangement.toLowerCase() === entry.name.toLowerCase(),
                )
              ) {
                facilityStore.set({
                  ...f,
                  capacity: {
                    ...f.capacity,
                    byArrangement: f.capacity.byArrangement.map((c) =>
                      c.arrangement.toLowerCase() === entry.name.toLowerCase()
                        ? { ...c, arrangement: updated.name }
                        : c,
                    ),
                  },
                });
              }
            }
          }
          referenceStore.set(kind, updated);
          record(request, 'updated', updated, state(entry), `Changed the ${noun} ${entry.name}.`);
          return HttpResponse.json(toEntry(kind, updated));
        }),
      ),

      http.post(
        `${base}/:id/archive`,
        withEntry((entry, request) => {
          if (entry.archived) return HttpResponse.json(toEntry(kind, entry));
          const archived = { ...entry, archived: true };
          referenceStore.set(kind, archived);
          record(
            request,
            'archived',
            archived,
            state(entry),
            `Archived the ${noun} ${entry.name}.`,
          );
          return HttpResponse.json(toEntry(kind, archived));
        }),
      ),

      http.post(
        `${base}/:id/restore`,
        withEntry((entry, request) => {
          if (!entry.archived) return HttpResponse.json(toEntry(kind, entry));
          const restored = { ...entry, archived: false };
          referenceStore.set(kind, restored);
          record(
            request,
            'restored',
            restored,
            state(entry),
            `Restored the ${noun} ${entry.name}.`,
          );
          return HttpResponse.json(toEntry(kind, restored));
        }),
      ),
    ];
  };

  const withTerms = (handle: (t: StoredTerms, request: Request) => Response | Promise<Response>) =>
    sysadmin(({ request, params }) => {
      const found = termsStore.get(String(params.id));
      return found ? handle(found, request) : problem(404, 'Terms version not found');
    });

  const termsState = (t: StoredTerms) => ({
    version: t.version,
    status: t.status,
    title: t.title,
    paragraphs: t.paragraphs.length,
  });

  return [
    ...KINDS.flatMap(vocabulary),

    http.post(
      `${root}/admin/seating-arrangements/:id/impact`,
      sysadmin(({ params }) =>
        referenceStore.get('seating_arrangement', String(params.id))
          ? HttpResponse.json(seatingImpact(String(params.id), now()))
          : problem(404, 'seating arrangement not found'),
      ),
    ),

    // --- terms ----------------------------------------------------------------------------------
    http.get(
      `${root}/admin/terms`,
      sysadmin(() => HttpResponse.json(termsStore.all().map(toTerms))),
    ),

    http.post(
      `${root}/admin/terms`,
      sysadmin(async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Partial<CreateTermsRequest>;
        const errors = validateTerms(body, false);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const author = userStore.get(userIdOf(request));
        const version = termsStore.nextVersion(now().year);
        const created: StoredTerms = {
          id: `terms-${version}`,
          version,
          title: (body.title as string).trim(),
          paragraphs: cleanParagraphs(body.paragraphs as string[]),
          status: 'draft',
          createdAt: stamp(),
          createdBy: { id: userIdOf(request), name: author?.name ?? userIdOf(request) },
          publishedAt: null,
          publishedBy: null,
          supersededAt: null,
        };
        termsStore.set(created);
        audit(request, {
          action: 'terms.draft_created',
          entityType: 'terms',
          entityId: created.id,
          entityLabel: created.version,
          summary: `Started a draft of the terms, version ${created.version}.`,
          before: null,
          after: termsState(created),
        });
        return HttpResponse.json(toTerms(created), { status: 201 });
      }),
    ),

    http.patch(
      `${root}/admin/terms/:id`,
      withTerms(async (terms, request) => {
        if (terms.status !== 'draft') {
          return problem(
            409,
            'Published terms cannot be edited',
            `Version ${terms.version} is ${terms.status}. Applicants accepted those exact words, so it is never changed: publish a new version instead.`,
            { code: 'terms_immutable' },
          );
        }
        const body = (await request.json().catch(() => ({}))) as Partial<CreateTermsRequest>;
        const errors = validateTerms(body, true);
        if (Object.keys(errors).length > 0) return invalid(errors);
        const updated: StoredTerms = {
          ...terms,
          title: body.title === undefined ? terms.title : body.title.trim(),
          paragraphs:
            body.paragraphs === undefined ? terms.paragraphs : cleanParagraphs(body.paragraphs),
        };
        termsStore.set(updated);
        audit(request, {
          action: 'terms.draft_updated',
          entityType: 'terms',
          entityId: updated.id,
          entityLabel: updated.version,
          summary: `Edited the draft terms, version ${updated.version}.`,
          before: termsState(terms),
          after: termsState(updated),
        });
        return HttpResponse.json(toTerms(updated));
      }),
    ),

    http.post(
      `${root}/admin/terms/:id/publish`,
      withTerms((terms, request) => {
        if (terms.status !== 'draft') {
          return problem(
            409,
            'Only a draft can be published',
            `Version ${terms.version} is already ${terms.status}.`,
            { code: 'terms_not_draft' },
          );
        }
        const at = stamp();
        const previous = termsStore.published();
        const publisher = userStore.get(userIdOf(request));
        // One step: the previous version is superseded as this one is published.
        termsStore.set({ ...previous, status: 'superseded', supersededAt: at });
        const published: StoredTerms = {
          ...terms,
          status: 'published',
          publishedAt: at,
          publishedBy: { id: userIdOf(request), name: publisher?.name ?? userIdOf(request) },
        };
        termsStore.set(published);
        audit(request, {
          action: 'terms.published',
          entityType: 'terms',
          entityId: published.id,
          entityLabel: published.version,
          summary: `Published version ${published.version} of the terms, superseding ${previous.version}.`,
          before: { currentVersion: previous.version },
          after: { currentVersion: published.version },
        });
        return HttpResponse.json(toTerms(published));
      }),
    ),

    // Public: the published version, which the public terms page renders.
    http.get(`${root}/terms/current`, async () => {
      await wait();
      ready?.();
      const current = termsStore.published();
      const body: PublishedTerms = {
        version: current.version,
        title: current.title,
        paragraphs: current.paragraphs,
        publishedAt: current.publishedAt ?? current.createdAt,
      };
      return HttpResponse.json(body);
    }),
  ];
}
