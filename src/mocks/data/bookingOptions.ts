/**
 * Controlled lists for the booking form. The resources and the kitchen items are the confirmed
 * lists from BRD section 8.4, kept in the resource catalogue. The event types, seating
 * arrangements and terms are maintained by administrators (reference data); their seed values are
 * PROVISIONAL, since the municipality has not supplied them. The upload rules and the turnaround
 * are assumed. See docs/facilities-data-gaps.md.
 */
import type { BookingOptionItem, BookingOptions } from '@/shared/api';
import { referenceStore } from './referenceStore';
import { termsStore, TERMS_VERSION } from './termsStore';

export { TERMS_VERSION };

const asOptions = (items: Array<{ id: string; name: string }>): BookingOptionItem[] =>
  items.map(({ id, name }) => ({ id, name }));

/** What the booking form is offered now, and the archived entries only so old bookings can name them. */
export function bookingOptions(): Omit<BookingOptions, 'resources' | 'retiredResources'> {
  const current = termsStore.published();
  return {
    eventTypes: asOptions(referenceStore.active('event_type')),
    seatingArrangements: asOptions(referenceStore.active('seating_arrangement')),
    retiredEventTypes: asOptions(referenceStore.archived('event_type')),
    retiredSeatingArrangements: asOptions(referenceStore.archived('seating_arrangement')),
    terms: { version: current.version, title: current.title, paragraphs: current.paragraphs },
    uploads: {
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxFiles: 5,
      acceptedTypes: [
        { extension: '.pdf', contentType: 'application/pdf', label: 'PDF' },
        { extension: '.jpg', contentType: 'image/jpeg', label: 'JPEG' },
        { extension: '.jpeg', contentType: 'image/jpeg', label: 'JPEG' },
        { extension: '.png', contentType: 'image/png', label: 'PNG' },
        { extension: '.doc', contentType: 'application/msword', label: 'Word' },
        {
          extension: '.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          label: 'Word',
        },
        { extension: '.xls', contentType: 'application/vnd.ms-excel', label: 'Excel' },
        {
          extension: '.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          label: 'Excel',
        },
      ],
    },
    expectedTurnaround: 'within 5 working days',
  };
}
