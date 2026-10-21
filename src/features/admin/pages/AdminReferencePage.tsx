import { useState } from 'react';
import { useBlocker } from 'react-router';
import {
  ConfirmDialog,
  PageLayout,
  SectionedEditLayout,
  type EditSection,
} from '@/shared/components';
import { useUrlState } from '@/shared/hooks';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import { TermsSection } from '../reference/components/TermsSection';
import { VocabularyEditor } from '../reference/components/VocabularyEditor';

const SECTION_IDS = ['seating', 'event-types', 'terms'] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  seating: 'Seating arrangements',
  'event-types': 'Event types',
  terms: 'Terms and conditions',
};

const sectionCodec = createParamsCodec<{ section: SectionId }>({
  section: param.oneOf(SECTION_IDS, 'seating'),
});

export default function AdminReferencePage() {
  const [state] = useUrlState(sectionCodec);
  const section = state.section;
  const [dirty, setDirty] = useState(false);

  // A draft that has not been saved is not lost by clicking another section.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  const hrefFor = (target: string) => {
    const search = sectionCodec.toSearchString({ section: target as SectionId });
    return `/admin/reference${search ? `?${search}` : ''}`;
  };
  const sections: EditSection[] = SECTION_IDS.map((id) => ({ id, label: SECTION_LABELS[id] }));

  const body = {
    seating: (
      <VocabularyEditor
        path="seating-arrangements"
        title="Seating arrangements"
        noun="seating arrangement"
        description="How a venue can be laid out. Offered on the booking form, and used for each facility’s capacity. These are provisional until the municipality supplies its own list."
        archiveEffect={(name) =>
          `${name} will no longer be offered on the booking form or when setting a facility’s capacity. Bookings that chose it keep it, and you can restore it later.`
        }
      />
    ),
    'event-types': (
      <VocabularyEditor
        path="event-types"
        title="Event types"
        noun="event type"
        description="The kinds of event an applicant can say they are holding. Offered on the booking form."
        archiveEffect={(name) =>
          `${name} will no longer be offered on the booking form. Bookings that chose it keep it, and you can restore it later.`
        }
        footnote="Today an event type affects nothing beyond reporting: not who approves a request and not whether a venue can be booked. Whether it should is an open question for the client."
      />
    ),
    terms: <TermsSection onDirtyChange={setDirty} />,
  }[section];

  return (
    <PageLayout
      title="Reference data"
      description="The lists the booking form depends on. Nothing here is ever deleted: bookings refer to it."
    >
      <SectionedEditLayout
        sections={sections}
        current={section}
        hrefFor={hrefFor}
        label="Reference data sections"
      >
        <div key={section}>{body}</div>
      </SectionedEditLayout>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        destructive
        title="Leave without saving?"
        description="You have a draft that has not been saved. If you leave, it is lost."
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={async () => {
          setDirty(false);
          blocker.proceed?.();
        }}
      />
    </PageLayout>
  );
}
