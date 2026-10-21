/**
 * The mock's terms and conditions. Versions are authored as drafts, published, and superseded by
 * the next to be published. A published version is never edited. The wording is PLACEHOLDER: the
 * municipality will supply the real terms.
 */
import type { TermsStatus } from '@/shared/api';

export interface StoredTerms {
  id: string;
  version: string;
  title: string;
  paragraphs: string[];
  status: TermsStatus;
  createdAt: string;
  createdBy: { id: string; name: string };
  publishedAt: string | null;
  publishedBy: { id: string; name: string } | null;
  supersededAt: string | null;
}

/** The version the seeded bookings accepted. */
export const TERMS_VERSION = '2026-1';

const AUTHOR = { id: 'mock-sysadmin', name: 'Sipho Nkosi' };

const seedVersions = (): StoredTerms[] => [
  {
    id: 'terms-2025-1',
    version: '2025-1',
    title: 'Terms and conditions of hire',
    paragraphs: [
      'This is placeholder wording from the first edition. A booking request is not a confirmed booking.',
      'You are responsible for the venue and its contents for the duration of the hire.',
    ],
    status: 'superseded',
    createdAt: '2025-08-20T08:00:00Z',
    createdBy: AUTHOR,
    publishedAt: '2025-09-01T06:00:00Z',
    publishedBy: AUTHOR,
    supersededAt: '2026-02-01T06:00:00Z',
  },
  {
    id: 'terms-2026-1',
    version: TERMS_VERSION,
    title: 'Terms and conditions of hire',
    paragraphs: [
      'This is placeholder wording. The municipality will supply the terms and conditions that apply to the hire of its venues.',
      'A booking request is not a confirmed booking. The venue is reserved for you only once the request has been approved.',
      'You are responsible for the venue, its contents and the conduct of your guests for the duration of the hire, including set-up and clear-down time.',
    ],
    status: 'published',
    createdAt: '2026-01-20T08:00:00Z',
    createdBy: AUTHOR,
    publishedAt: '2026-02-01T06:00:00Z',
    publishedBy: AUTHOR,
    supersededAt: null,
  },
  {
    id: 'terms-2026-2',
    version: '2026-2',
    title: 'Terms and conditions of hire',
    paragraphs: [
      'This is placeholder wording. The municipality will supply the terms and conditions that apply to the hire of its venues.',
      'A booking request is not a confirmed booking. The venue is reserved for you only once the request has been approved.',
      'You are responsible for the venue, its contents and the conduct of your guests for the duration of the hire, including set-up and clear-down time.',
      'Cancellations made fewer than seven days before the event may not be refunded.',
    ],
    status: 'draft',
    createdAt: '2026-10-20T08:00:00Z',
    createdBy: AUTHOR,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
  },
];

const versions = new Map<string, StoredTerms>();
function seed() {
  versions.clear();
  for (const v of seedVersions()) versions.set(v.id, v);
}
seed();

export const termsStore = {
  /** Newest first. */
  all: (): StoredTerms[] =>
    [...versions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  get: (id: string): StoredTerms | undefined => versions.get(id),
  published: (): StoredTerms => {
    const found = [...versions.values()].find((v) => v.status === 'published');
    if (!found) throw new Error('No terms version is published.');
    return found;
  },
  set: (terms: StoredTerms) => versions.set(terms.id, terms),
  /** The next label for a year: 2026-1, 2026-2, and so on. */
  nextVersion(year: number): string {
    const used = [...versions.values()]
      .filter((v) => v.version.startsWith(`${year}-`))
      .map((v) => Number(v.version.slice(5)));
    return `${year}-${Math.max(0, ...used) + 1}`;
  },
  reset: seed,
};

export function resetTermsStore() {
  termsStore.reset();
}
