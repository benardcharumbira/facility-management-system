import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiProblem, isApiProblem, useApiClient, type Booking } from '@/shared/api';
import {
  Alert,
  DetailHeader,
  DetailLayout,
  DetailSkeleton,
  ErrorState,
  NotFoundState,
  ScreenOnly,
  Section,
  usePageHeader,
} from '@/shared/components';
import { useOriginList, useUrlState } from '@/shared/hooks';
import { createParamsCodec, param } from '@/shared/utils/params-codec';
import {
  bookingKeys,
  cancelBooking,
  deleteDraft,
  downloadDocument,
  requestReschedule,
} from '../api';
import { BookingActions } from '../components/BookingActions';
import { BookingDetails } from '../components/BookingDetails';
import { BookingHistory } from '../components/BookingHistory';
import { BookingStatusPanel } from '../components/BookingStatusPanel';
import { CancelDialog } from '../components/CancelDialog';
import { HierarchyNote } from '../components/HierarchyNote';
import { PrintBooking } from '../components/PrintBooking';
import { ReschedulePanel } from '../components/ReschedulePanel';
import { ConfirmDialog } from '@/shared/components';
import { saveBlob } from '../downloads';
import { describeWindow } from '../format';
import { useBooking, useBookingOptions, useFacilityDetail } from '../hooks';
import { facilityLink } from '../links';
import { BookingStatusBadge } from '../status';

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;
const proposalCodec = createParamsCodec<{
  proposedStartsAt: string | undefined;
  proposedEndsAt: string | undefined;
}>({
  proposedStartsAt: param.matching(INSTANT),
  proposedEndsAt: param.matching(INSTANT),
});

export default function BookingDetailPage() {
  const { id = '' } = useParams();
  const fromList = useOriginList();
  const booking = useBooking(id);
  const listTo = `/bookings${fromList}`;
  const crumbs = (last: string) => [{ label: 'My bookings', to: listTo }, { label: last }];

  if (booking.isError) {
    // Someone else's booking looks exactly like one that does not exist.
    const missing = isApiProblem(booking.error) && booking.error.status === 404;
    return (
      <Failed
        missing={missing}
        crumbs={crumbs}
        listTo={listTo}
        error={booking.error}
        onRetry={() => void booking.refetch()}
      />
    );
  }
  if (!booking.data) return <Loading />;
  return <Loaded booking={booking.data} fromList={fromList} />;
}

function Loading() {
  usePageHeader('Booking');
  return <DetailSkeleton />;
}

function Failed({
  missing,
  crumbs,
  listTo,
  error,
  onRetry,
}: {
  missing: boolean;
  crumbs: (last: string) => Array<{ label: string; to?: string }>;
  listTo: string;
  error: unknown;
  onRetry: () => void;
}) {
  usePageHeader(missing ? 'Booking not found' : 'Booking');
  return (
    <>
      <DetailHeader
        title={missing ? 'Booking not found' : 'Booking'}
        breadcrumbs={crumbs(missing ? 'Not found' : 'Error')}
      />
      {missing ? (
        <NotFoundState
          title="We could not find that booking"
          description="It may have been removed, or the link may be wrong."
          action={{ label: 'Back to my bookings', to: listTo }}
        />
      ) : (
        <ErrorState title="We could not load this booking" problem={error} onRetry={onRetry} />
      )}
    </>
  );
}

function Loaded({ booking, fromList }: { booking: Booking; fromList: string }) {
  usePageHeader(booking.reference);
  const api = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const options = useBookingOptions();
  const facility = useFacilityDetail(booking.facilityId);
  const [proposal, updateProposal] = useUrlState(proposalCodec);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const now = DateTime.now();
  const zone = booking.facility.timeZone;
  const window = describeWindow(booking.startsAt, booking.endsAt, zone);
  const listTo = `/bookings${fromList}`;

  /** A change came back from the server: show it in place and refresh whatever depends on it. */
  const adopt = (next: Booking) => {
    queryClient.setQueryData(bookingKeys.detail(next.id), next);
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['bookings', 'summary'] });
    // Time that was held or released shows differently on the calendar.
    void queryClient.invalidateQueries({ queryKey: ['facilities'] });
  };

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      cancelBooking(api, booking.id, { reason: reason.trim() || undefined }),
    meta: { silent: true },
  });
  const remove = useMutation({
    mutationFn: () => deleteDraft(api, booking.id),
    meta: { silent: true },
  });
  const reschedule = useMutation({
    mutationFn: (body: { startsAt: string; endsAt: string }) =>
      requestReschedule(api, booking.id, body),
    meta: { silent: true },
  });

  const localDate =
    DateTime.fromISO(booking.startsAt, { zone: 'utc' }).setZone(zone).toISODate() ?? '';
  const rescheduleHref = `/facilities/${encodeURIComponent(booking.facilityId)}?${new URLSearchParams(
    {
      month: localDate.slice(0, 7),
      date: localDate,
      reschedule: booking.id,
    },
  ).toString()}`;
  const stillAhead = DateTime.fromISO(booking.endsAt, { zone: 'utc' }) > now;
  const newRequestHref = `/bookings/new?${new URLSearchParams({
    facilityId: booking.facilityId,
    ...(stillAhead ? { startsAt: booking.startsAt, endsAt: booking.endsAt } : {}),
  }).toString()}`;

  const download = async (documentId: string, name: string) => {
    setDownloadError(null);
    try {
      saveBlob(await downloadDocument(api, booking.id, documentId), name);
    } catch (error) {
      setDownloadError(`${name} could not be downloaded. ${ApiProblem.from(error).title}.`);
    }
  };

  const proposing =
    booking.status === 'approved' &&
    booking.actions.reschedule.allowed &&
    proposal.proposedStartsAt &&
    proposal.proposedEndsAt;

  return (
    <>
      <ScreenOnly>
        <DetailHeader
          breadcrumbs={[{ label: 'My bookings', to: listTo }, { label: booking.reference }]}
          back={{ label: 'Back to my bookings', to: listTo }}
          title={booking.reference}
          status={<BookingStatusBadge status={booking.status} size="lg" />}
          subtitle={
            <>
              <Link
                to={facilityLink(booking.facility.id)}
                className="font-medium text-primary underline underline-offset-2"
              >
                {booking.facility.name}
              </Link>
              {` · ${window.date}, ${window.time}`}
            </>
          }
        >
          <BookingStatusPanel
            booking={booking}
            expectedTurnaround={options.data?.expectedTurnaround}
            now={now}
          />
        </DetailHeader>

        {notice && (
          <Alert severity="info" className="mb-6" title={notice}>
            {null}
          </Alert>
        )}

        <DetailLayout
          aside={
            <BookingActions
              booking={booking}
              rescheduleHref={rescheduleHref}
              newRequestHref={newRequestHref}
              onCancel={() => setCancelOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          }
        >
          {proposing && (
            <ReschedulePanel
              booking={booking}
              proposedStartsAt={proposal.proposedStartsAt ?? ''}
              proposedEndsAt={proposal.proposedEndsAt ?? ''}
              calendarHref={rescheduleHref}
              onDismiss={() =>
                updateProposal(
                  { proposedStartsAt: undefined, proposedEndsAt: undefined },
                  { replace: true },
                )
              }
              onSend={async () => {
                const sent = await reschedule.mutateAsync({
                  startsAt: proposal.proposedStartsAt ?? '',
                  endsAt: proposal.proposedEndsAt ?? '',
                });
                adopt(sent);
                updateProposal(
                  { proposedStartsAt: undefined, proposedEndsAt: undefined },
                  { replace: true },
                );
                setNotice(
                  `Your request to change the date has been sent. Your booking stays approved on ${window.date}, ${window.time} until the municipality decides.`,
                );
              }}
            />
          )}

          {booking.rescheduleRequest && booking.status === 'approved' && (
            <Section title="Change of date requested">
              <p>
                You asked to move this booking to{' '}
                <strong>
                  {
                    describeWindow(
                      booking.rescheduleRequest.proposedStartsAt,
                      booking.rescheduleRequest.proposedEndsAt,
                      zone,
                    ).date
                  }
                  ,{' '}
                  {
                    describeWindow(
                      booking.rescheduleRequest.proposedStartsAt,
                      booking.rescheduleRequest.proposedEndsAt,
                      zone,
                    ).time
                  }
                </strong>
                . The municipality has not decided yet. Until it does, the booking is approved on{' '}
                {window.date}, {window.time}.
              </p>
            </Section>
          )}

          <Section title="Booking details">
            <div className="flex flex-col gap-4">
              {facility.data && <HierarchyNote facility={facility.data} />}
              {downloadError && <Alert severity="error">{downloadError}</Alert>}
              <BookingDetails
                booking={booking}
                options={options.data}
                onDownload={(documentId, name) => void download(documentId, name)}
              />
            </div>
          </Section>

          <Section title="History">
            <BookingHistory booking={booking} />
          </Section>
        </DetailLayout>

        {(booking.status === 'pending' || booking.status === 'approved') && (
          <CancelDialog
            booking={booking}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            onConfirm={async (reason) => {
              const was = booking.status;
              const cancelled = await cancel.mutateAsync(reason);
              adopt(cancelled);
              setNotice(
                was === 'approved'
                  ? 'Your booking has been cancelled and the venue has been released.'
                  : 'Your request has been cancelled and the time held for you has been released.',
              );
            }}
          />
        )}
        {booking.status === 'draft' && (
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            destructive
            title="Delete this draft?"
            description="The draft will be deleted for good. Nothing has been sent to the municipality, so there is nothing to cancel."
            confirmLabel="Delete draft"
            cancelLabel="Keep my draft"
            onConfirm={async () => {
              await remove.mutateAsync();
              void queryClient.invalidateQueries({ queryKey: ['bookings'] });
              void navigate('/bookings', { replace: true });
            }}
          />
        )}
      </ScreenOnly>

      {booking.status === 'approved' && <PrintBooking booking={booking} options={options.data} />}
    </>
  );
}
