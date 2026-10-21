import { Download } from 'lucide-react';
import type { ApprovalDetail } from '@/shared/api';
import { Button, formatBytes, ReviewList, type ReviewItem } from '@/shared/components';
import { dateAndTime } from '@/shared/utils/format';

const asList = (items: string[]) =>
  items.length === 0 ? (
    'None requested'
  ) : (
    <ul className="m-0 list-none p-0">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

/** Everything the applicant submitted, as the same label and value rows the booking form's review step uses. */
export function RequestSummary({
  detail,
  onDownload,
}: {
  detail: ApprovalDetail;
  onDownload: (documentId: string, name: string) => void;
}) {
  const resources = (category: 'venue' | 'kitchen') =>
    detail.resources
      .filter((r) => r.category === category)
      .map((r) => (r.quantified ? `${r.name} × ${r.quantity}` : r.name));

  const items: ReviewItem[] = [
    { key: 'applicant', label: 'Applicant', value: detail.applicantName },
    { key: 'type', label: 'Type of meeting or event', value: detail.eventTypeName ?? 'Not given' },
    {
      key: 'description',
      label: 'Event description',
      value: <span className="whitespace-pre-wrap">{detail.description || 'Not given'}</span>,
    },
    { key: 'attendees', label: 'Expected attendees', value: detail.attendeeCount ?? 'Not given' },
    {
      key: 'seating',
      label: 'Seating arrangement',
      value: detail.seatingArrangementName ?? 'Not given',
    },
    { key: 'venue', label: 'Venue resources', value: asList(resources('venue')) },
    { key: 'kitchen', label: 'Kitchen resources', value: asList(resources('kitchen')) },
    {
      key: 'documents',
      label: 'Documents',
      value:
        detail.documents.length === 0 ? (
          'None attached'
        ) : (
          <ul aria-label="Documents" className="m-0 flex list-none flex-col gap-2 p-0">
            {detail.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="[overflow-wrap:anywhere]">{doc.name}</span>
                <span className="text-sm text-muted">{formatBytes(doc.sizeBytes)}</span>
                <Button variant="secondary" size="sm" onClick={() => onDownload(doc.id, doc.name)}>
                  <Download aria-hidden className="size-4" />
                  {`Download ${doc.name}`}
                </Button>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'submitted',
      label: detail.type === 'booking_request' ? 'Submitted' : 'Change requested',
      value: dateAndTime(detail.raisedAt, detail.facility.timeZone),
    },
  ];
  return <ReviewList items={items} />;
}
