/**
 * The static public pages, as the API serves them. Every word of the legal and contact pages is a
 * PLACEHOLDER: the privacy notice is a POPIA compliance document and the municipality must issue it,
 * naming its Information Officer; the contact details are the municipality's to supply. The
 * delivery team supplies headings and structure only. The help page and the accessibility statement
 * are the delivery team's own words, awaiting municipal review.
 *
 * No telephone number, address, name or hours are invented anywhere in this file.
 */
import type { ContentPageData, ContentSlug } from '@/shared/api';

const PENDING = '[Awaiting the municipality]';
const SUPPLY = (what: string) =>
  `${PENDING} The municipality has to supply ${what}. Nothing on this page is its wording yet.`;

export const PUBLIC_CONTENT: Record<ContentSlug, ContentPageData> = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy notice',
    description:
      'How the municipality collects, uses, shares and keeps your personal information when you use this service, and how to exercise your rights.',
    status: 'placeholder',
    reviewedAt: null,
    sections: [
      {
        id: 'collected',
        heading: 'What personal information we collect',
        paragraphs: [SUPPLY('the list of personal information this service collects')],
      },
      {
        id: 'why',
        heading: 'Why we collect it',
        paragraphs: [SUPPLY('the purposes for which it is collected and used')],
      },
      {
        id: 'basis',
        heading: 'The lawful basis',
        paragraphs: [SUPPLY('the lawful basis for processing, under POPIA')],
      },
      {
        id: 'shared',
        heading: 'Who we share it with',
        paragraphs: [
          SUPPLY('the people and organisations it is shared with, including any operators'),
        ],
      },
      {
        id: 'kept',
        heading: 'How long we keep it',
        paragraphs: [SUPPLY('the retention periods and what happens at the end of them')],
      },
      {
        id: 'rights',
        heading: 'Your rights and how to use them',
        paragraphs: [
          SUPPLY(
            'the rights of a data subject, and how to ask to see, correct or delete personal information',
          ),
        ],
      },
      {
        id: 'officer',
        heading: 'Our Information Officer',
        paragraphs: [
          `${PENDING} The municipality has to supply the name and contact details of its Information Officer. They are deliberately not filled in here.`,
        ],
      },
    ],
  },

  accessibility: {
    slug: 'accessibility',
    title: 'Accessibility statement',
    description:
      'How accessible this service is, the standard it aims for, what is known not to work yet, and how to report a problem.',
    status: 'draft_for_review',
    reviewedAt: null,
    sections: [
      {
        id: 'standard',
        heading: 'The standard we aim for',
        paragraphs: [
          'This service aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. That is the standard we have built to; it is not yet a claim that we meet it.',
        ],
      },
      {
        id: 'status',
        heading: 'Conformance status',
        paragraphs: [
          'The conformance claim is not made yet. It will be written after the service has been independently audited against WCAG 2.2 AA, and this statement will then say, honestly, whether the service fully, partly or does not conform.',
        ],
      },
      {
        id: 'done',
        heading: 'What we have done',
        paragraphs: ['While building the service we have designed for:'],
        items: [
          'use with a keyboard alone, including every dialog, menu and form',
          'clear focus on whatever you are using, and focus moved sensibly after you act',
          'meaning that does not depend on colour alone',
          'text that can be enlarged and pages that fit a narrow phone screen without sideways scrolling',
          'labels, hints and error messages tied to the fields they describe',
        ],
      },
      {
        id: 'known',
        heading: 'What is known not to conform',
        paragraphs: [
          'The audit has not been done, so this list is incomplete. What we know so far:',
        ],
        items: [
          'The service has not yet been tested with screen readers on real devices and browsers.',
          'The calendar and the editable tables used by staff have not been checked on a touch screen with assistive technology.',
          'Sign in and registration are provided by Clerk, a third party, and are covered by its own accessibility work.',
        ],
      },
      {
        id: 'report',
        heading: 'How to report a problem',
        paragraphs: [
          'If something is hard or impossible to use, tell us. Say which page, what you were trying to do and what you use to browse (a phone, a screen reader, a keyboard). Use the details on the contact page.',
        ],
      },
      {
        id: 'reviewed',
        heading: 'When this was last reviewed',
        paragraphs: [
          'It has not been reviewed yet. The date will be recorded here after the audit.',
        ],
      },
    ],
  },

  help: {
    slug: 'help',
    title: 'How the service works',
    description:
      'How to register, find a venue, see when it is free, send a request, and what happens next, including cancelling or moving a booking.',
    status: 'draft_for_review',
    reviewedAt: null,
    sections: [
      {
        id: 'request',
        heading: 'A booking is a request',
        paragraphs: [
          'When you send a booking you are asking for the venue. Nothing is confirmed until the municipality approves it, and you are told either way.',
        ],
      },
      {
        id: 'register',
        heading: 'Registering',
        paragraphs: [
          'You need an account to see venues and to ask to book one. Choose Register, give your name and email address, and confirm the email address when we send you a message. You can read the terms and conditions and the privacy notice before you do.',
        ],
      },
      {
        id: 'find',
        heading: 'Finding a venue',
        paragraphs: [
          'Once you are signed in, Facilities lists the municipality’s venues. You can search by name, and narrow the list by type, place, how many people it holds and what it has.',
        ],
      },
      {
        id: 'availability',
        heading: 'Checking when it is free',
        paragraphs: [
          'Each venue has a calendar. It shows the days and times that are free, taken or closed. A request that is waiting for an answer holds its time for a while, so a time that looks taken may be released if that request is not decided. Choose a free time and carry on to the request.',
        ],
      },
      {
        id: 'submit',
        heading: 'Sending a request',
        paragraphs: [
          'The request asks what the event is, how many people are coming, how you want the room laid out, and what you need. You can add documents, and you accept the terms and conditions before you send it. Your answers are saved as you go, so you can leave and come back.',
        ],
      },
      {
        id: 'after',
        heading: 'After you send it',
        paragraphs: [
          'The municipality reviews it. Your booking page shows where it stands and when to expect an answer. If it is approved the booking is confirmed. If it is not, you are given the reason.',
        ],
      },
      {
        id: 'cancel',
        heading: 'Cancelling',
        paragraphs: [
          'Open the booking under My bookings and choose Cancel. Where a booking can no longer be cancelled online, the page says why.',
        ],
      },
      {
        id: 'move',
        heading: 'Asking to move a booking',
        paragraphs: [
          'Open an approved booking and ask to move it to another time. This is a request too: the booking stays where it is until the municipality agrees.',
        ],
      },
    ],
  },

  contact: {
    slug: 'contact',
    title: 'Contact us',
    description:
      'How to contact the municipality about a booking or about this service, and when someone can answer.',
    status: 'placeholder',
    reviewedAt: null,
    sections: [
      {
        id: 'who',
        heading: 'Who to contact',
        paragraphs: [
          SUPPLY('the name of the office or team that answers questions about venue bookings'),
        ],
      },
      {
        id: 'how',
        heading: 'How to reach them',
        paragraphs: [
          `${PENDING} The municipality has to supply the telephone number, email address and physical address. They are deliberately not filled in here.`,
        ],
      },
      {
        id: 'hours',
        heading: 'When someone can answer',
        paragraphs: [SUPPLY('the hours the office is open and answers calls')],
      },
      {
        id: 'booking',
        heading: 'If your question is about a booking',
        paragraphs: [
          'Quote the booking reference, which is shown on your booking and in the emails we send, for example MVL-2026-00417. Say which venue it is for.',
          'Each venue’s page names the municipal department that manages it, under “Managed by”. That department is the one that can answer questions about that venue.',
        ],
      },
    ],
  },
};
