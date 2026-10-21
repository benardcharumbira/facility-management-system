import { describe, expect, it } from 'vitest';
import {
  createApiClient,
  isApiProblem,
  type ApiProblem,
  type ContentPageData,
  type FeaturedFacility,
  type MyProfile,
  type PublishedTerms,
} from '@/shared/api';
import { TEST_API_BASE_URL } from './server';

const as = (token: string | null) =>
  createApiClient({ baseUrl: TEST_API_BASE_URL, getToken: async () => token });
const visitor = as(null);
const sysadmin = as('user:mock-sysadmin');

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => {
      if (!isApiProblem(error)) throw error;
      return error as ApiProblem;
    },
  );

describe('featured venues', () => {
  it('are four, fixed, and need no sign in', async () => {
    const featured = await visitor.get<FeaturedFacility[]>('/public/facilities/featured');
    expect(featured.map((f) => f.id)).toEqual([
      'rothdene-hall',
      'lakeside-hall',
      'vaal-marina-hall',
      'city-hall',
    ]);
    expect(featured[0]).toMatchObject({
      name: 'Rothdene Hall',
      image: { src: '/images/venues/rothdene-hall.svg', width: 640, height: 400, alt: '' },
    });
  });

  it('leave out a venue that has been archived', async () => {
    await sysadmin.post('/admin/facilities/lakeside-hall/archive');
    const featured = await visitor.get<FeaturedFacility[]>('/public/facilities/featured');
    expect(featured.map((f) => f.id)).not.toContain('lakeside-hall');
  });

  it('give only what the landing page shows, not the estate', async () => {
    const [first] = await visitor.get<FeaturedFacility[]>('/public/facilities/featured');
    expect(Object.keys(first ?? {}).sort()).toEqual(
      ['capacity', 'id', 'image', 'locality', 'name', 'shortDescription', 'typeName'].sort(),
    );
  });
});

describe('the published terms', () => {
  it('are readable without signing in, with their version and date', async () => {
    const terms = await visitor.get<PublishedTerms>('/public/terms');
    expect(terms).toMatchObject({ version: '2026-1', placeholder: true });
    expect(terms.publishedAt).toBe('2026-02-01T06:00:00Z');
    expect(terms.paragraphs.length).toBeGreaterThan(1);
  });

  it('follow a newly published version, which is no longer placeholder wording', async () => {
    await sysadmin.post('/admin/terms', {
      body: { title: 'Terms of hire', paragraphs: ['Real.'] },
    });
    await sysadmin.post('/admin/terms/terms-2026-3/publish');
    expect(await visitor.get<PublishedTerms>('/public/terms')).toMatchObject({
      version: '2026-3',
      placeholder: false,
      paragraphs: ['Real.'],
    });
  });
});

describe('the served pages', () => {
  it.each(['privacy', 'accessibility', 'help', 'contact'] as const)(
    'give %s without signing in',
    async (slug) => {
      const page = await visitor.get<ContentPageData>(`/public/content/${slug}`);
      expect(page.slug).toBe(slug);
      expect(page.title).not.toBe('');
      expect(page.description.length).toBeGreaterThan(30);
      expect(page.sections.length).toBeGreaterThan(2);
    },
  );

  it('mark the legal pages and the contact details as awaiting the municipality, and the rest as for review', async () => {
    const status = async (slug: string) =>
      (await visitor.get<ContentPageData>(`/public/content/${slug}`)).status;
    expect(await status('privacy')).toBe('placeholder');
    expect(await status('contact')).toBe('placeholder');
    expect(await status('help')).toBe('draft_for_review');
    expect(await status('accessibility')).toBe('draft_for_review');
  });

  it('structure the privacy notice by what POPIA has a responsible party disclose, with the Information Officer', async () => {
    const page = await visitor.get<ContentPageData>('/public/content/privacy');
    expect(page.sections.map((s) => s.heading)).toEqual([
      'What personal information we collect',
      'Why we collect it',
      'The lawful basis',
      'Who we share it with',
      'How long we keep it',
      'Your rights and how to use them',
      'Our Information Officer',
    ]);
  });

  it('invent no telephone number, address or person', async () => {
    const text = JSON.stringify(
      await Promise.all(
        ['privacy', 'contact'].map((slug) =>
          visitor.get<ContentPageData>(`/public/content/${slug}`),
        ),
      ),
    );
    expect(text).not.toMatch(/\d{3}[\s-]?\d{3}[\s-]?\d{4}/);
    expect(text).not.toMatch(/@[a-z]+\.[a-z]/);
    expect(text).toContain('Awaiting the municipality');
  });

  it('leave the accessibility conformance claim for the audit', async () => {
    const page = await visitor.get<ContentPageData>('/public/content/accessibility');
    const status = page.sections.find((s) => s.id === 'status');
    expect(status?.paragraphs.join(' ')).toMatch(/not made yet/);
    expect(JSON.stringify(page)).toContain('WCAG) 2.2');
    expect(JSON.stringify(page)).not.toMatch(/fully conform|is compliant|meets all/i);
  });

  it('answer an unknown page 404', async () => {
    expect((await failure(visitor.get('/public/content/pricing'))).status).toBe(404);
  });
});

describe('the profile', () => {
  it('has no telephone number to begin with', async () => {
    expect(await as('user:applicant-001').get<MyProfile>('/me/profile')).toEqual({
      telephone: null,
      updatedAt: null,
    });
  });

  it('has one for an applicant who gave it', async () => {
    expect((await as('user:applicant-priya').get<MyProfile>('/me/profile')).telephone).toBe(
      '082 555 0142',
    );
  });

  it('saves a number, trimmed, for that user only', async () => {
    const me = as('user:applicant-001');
    const saved = await me.patch<MyProfile>('/me/profile', {
      body: { telephone: ' 011 555 0100 ' },
    });
    expect(saved.telephone).toBe('011 555 0100');
    expect(saved.updatedAt).not.toBeNull();
    expect((await me.get<MyProfile>('/me/profile')).telephone).toBe('011 555 0100');
    expect((await as('user:applicant-002').get<MyProfile>('/me/profile')).telephone).toBeNull();
  });

  it('removes the number when given nothing', async () => {
    const me = as('user:applicant-priya');
    expect(
      (await me.patch<MyProfile>('/me/profile', { body: { telephone: null } })).telephone,
    ).toBeNull();
    expect((await me.get<MyProfile>('/me/profile')).telephone).toBeNull();
  });

  it.each(['abc', '12', '12345678901234567890', '<script>'])('refuses %s', async (telephone) => {
    const refused = await failure(as(null).patch('/me/profile', { body: { telephone } }));
    expect(refused.status).toBe(422);
    expect(refused.errors.telephone).toBeDefined();
  });

  it('can fail to save, which leaves the number as it was', async () => {
    const me = as('user:applicant-priya');
    const refused = await failure(me.patch('/me/profile', { body: { telephone: '000 000 0000' } }));
    expect(refused.status).toBe(503);
    expect((await me.get<MyProfile>('/me/profile')).telephone).toBe('082 555 0142');
  });
});
