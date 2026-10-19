/**
 * Controlled lists for the booking form. The resources and the kitchen items are the confirmed
 * lists from BRD section 8.4. Everything else is PROVISIONAL: the event types and seating
 * arrangements are not in the document, the terms text is placeholder wording, the upload rules
 * and the turnaround are assumed. See docs/facilities-data-gaps.md.
 */
import type { BookingOptions } from '@/shared/api';
import { KITCHEN_ITEMS } from './facilityDetail';

export const TERMS_VERSION = '2026-1';

export const BOOKING_OPTIONS: BookingOptions = {
  eventTypes: [
    { id: 'meeting', name: 'Meeting' },
    { id: 'workshop', name: 'Workshop or training' },
    { id: 'conference', name: 'Conference' },
    { id: 'wedding', name: 'Wedding' },
    { id: 'family-function', name: 'Birthday or family function' },
    { id: 'memorial', name: 'Funeral or memorial service' },
    { id: 'religious', name: 'Church or community gathering' },
    { id: 'fundraiser', name: 'Fundraiser' },
    { id: 'other', name: 'Other' },
  ],
  seatingArrangements: [
    { id: 'cinema', name: 'Cinema' },
    { id: 'banquet', name: 'Banquet' },
    { id: 'school-room', name: 'School room' },
    { id: 'u-shape', name: 'U-shape' },
    { id: 'boardroom', name: 'Boardroom' },
  ],
  resources: [
    { id: 'tables', name: 'Tables', category: 'venue' },
    { id: 'chairs', name: 'Chairs', category: 'venue' },
    { id: 'stage', name: 'Stage', category: 'venue' },
    { id: 'podium', name: 'Podium', category: 'venue' },
    { id: 'sound-system', name: 'Sound system', category: 'venue' },
    ...KITCHEN_ITEMS.map((item) => ({
      id: `kitchen-${item.id}`,
      name: item.name,
      category: 'kitchen' as const,
    })),
  ],
  terms: {
    version: TERMS_VERSION,
    title: 'Terms and conditions of hire',
    paragraphs: [
      'This is placeholder wording. The municipality will supply the terms and conditions that apply to the hire of its venues.',
      'A booking request is not a confirmed booking. The venue is reserved for you only once the request has been approved.',
      'You are responsible for the venue, its contents and the conduct of your guests for the duration of the hire, including set-up and clear-down time.',
    ],
  },
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
