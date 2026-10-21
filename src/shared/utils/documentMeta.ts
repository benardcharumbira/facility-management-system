const SITE_NAME = 'Facilities Booking';

/** The description of any page that does not give its own. */
export const DEFAULT_DESCRIPTION =
  'Ask to book a hall, meeting room or other venue from Midvaal Local Municipality. Find a venue, check when it is free and send a request.';

/**
 * Sets the document title and meta description. The application has no server rendering, so each
 * route does this on navigation. Every title follows one pattern: "Page · Facilities Booking".
 */
export function setDocumentMeta(title: string, description: string = DEFAULT_DESCRIPTION) {
  document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  let tag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'description';
    document.head.append(tag);
  }
  tag.content = description;
}
