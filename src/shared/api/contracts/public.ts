/**
 * Contract for the public content: what anyone can read without signing in. This file is the
 * specification handed to the backend; the MSW handlers implement it.
 *
 * ```
 * GET /api/public/facilities/featured    a small fixed selection, unauthenticated
 * GET /api/public/terms                  the currently published terms, unauthenticated; 404 if none
 * GET /api/public/content/{slug}         privacy, accessibility, help or contact; unauthenticated
 * ```
 *
 * **Served, not hardcoded.** The privacy notice is a POPIA document and may need correcting at
 * short notice, so the pages render what the API serves and the municipality can change it without
 * a deployment. Nothing here is behind authentication, and none of it is full anonymous browsing:
 * the featured selection is small, fixed and chosen by the municipality.
 *
 * **Placeholders.** The delivery team does not write legal text. Until the municipality supplies
 * its own, a page's `status` says so, and the client shows a notice in development and withholds
 * placeholder legal text altogether in a production build.
 */

/** An image sized for the layout, with modern formats offered where they exist. */
export interface VenueImage {
  /** The fallback, and the one a browser without the sources uses. */
  src: string;
  /** Intrinsic size, so the page does not shift as it loads. */
  width: number;
  height: number;
  /** Empty when the image is decoration beside a name. */
  alt: string;
  /** Alternative formats, most preferred first, such as AVIF then WebP. */
  sources?: Array<{ type: string; srcSet: string }>;
}

export interface FeaturedFacility {
  id: string;
  name: string;
  locality: string;
  typeName: string;
  capacity: number | null;
  shortDescription: string;
  image: VenueImage | null;
}

export const CONTENT_SLUGS = ['privacy', 'accessibility', 'help', 'contact'] as const;
export type ContentSlug = (typeof CONTENT_SLUGS)[number];

/**
 * `placeholder`: stand-in wording, awaiting text the municipality must supply (the privacy notice
 * and contact details). `draft_for_review`: written by the delivery team, awaiting municipal review.
 * `approved`: the municipality's own.
 */
export type ContentStatus = 'placeholder' | 'draft_for_review' | 'approved';

export interface ContentSection {
  id: string;
  heading: string;
  paragraphs: string[];
  /** A bulleted list after the paragraphs. */
  items?: string[];
}

export interface ContentPageData {
  slug: ContentSlug;
  title: string;
  /** The page's meta description. */
  description: string;
  status: ContentStatus;
  /** A UTC instant, or null if it has not been reviewed. */
  reviewedAt: string | null;
  sections: ContentSection[];
}

/** `GET /api/public/terms`. */
export interface PublishedTerms {
  version: string;
  title: string;
  paragraphs: string[];
  publishedAt: string;
  /** True while the wording is the delivery team's stand-in for the municipality's own. */
  placeholder: boolean;
}
