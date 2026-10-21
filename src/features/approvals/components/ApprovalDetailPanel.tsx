import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowLeft, CircleCheck, CircleX } from 'lucide-react';
import type { DateTime } from 'luxon';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { isApiProblem, type ApprovalDetail } from '@/shared/api';
import {
  Alert,
  BookingStatusBadge,
  Button,
  ErrorState,
  Kbd,
  NotFoundState,
  Skeleton,
} from '@/shared/components';
import { dateAndTime, describeWindow, elapsed } from '@/shared/utils/format';
import { urgencyOf } from '../urgency';
import { WorkTypeBadge } from '../workType';
import { CompetingRequestList } from './CompetingRequestList';
import { ContextFacts } from './ContextFacts';
import { HierarchyConsequence } from './HierarchyConsequence';
import { RequestSummary } from './RequestSummary';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function WindowCard({ title, window, muted }: { title: string; window: string; muted?: boolean }) {
  return (
    <div
      className={`rounded-md border p-3 ${muted ? 'border-line bg-sunken' : 'border-primary-line bg-primary-soft'}`}
    >
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="font-semibold">{window}</p>
    </div>
  );
}

interface ApprovalDetailPanelProps {
  query: UseQueryResult<ApprovalDetail>;
  search: string;
  now: DateTime;
  /** Where "back to the queue" goes. Shown only when the queue is not beside the detail. */
  backTo: string | null;
  onApprove: () => void;
  onReject: () => void;
  onDownload: (documentId: string, name: string) => void;
  downloadError: string | null;
}

/** The selected work item: what is being asked, who competes with it, the facts, and the two decisions. */
export function ApprovalDetailPanel({
  query,
  search,
  now,
  backTo,
  onApprove,
  onReject,
  onDownload,
  downloadError,
}: ApprovalDetailPanelProps) {
  const back = backTo && (
    <Link
      to={backTo}
      className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to the queue
    </Link>
  );

  if (query.isError) {
    const missing = isApiProblem(query.error) && query.error.status === 404;
    return (
      <div className="flex flex-col gap-3 p-4">
        {back}
        {missing ? (
          <NotFoundState
            title="We could not find that request"
            description="It may have been removed, or it is not one of the facilities you approve for."
            action={{ label: 'Back to the queue', to: `/approvals${search}` }}
          />
        ) : (
          <ErrorState
            title="We could not load this request"
            problem={query.error}
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  const detail = query.data;
  if (!detail) {
    return (
      <div aria-busy className="flex flex-col gap-3 p-4">
        {back}
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const zone = detail.facility.timeZone;
  const { context } = detail;
  const when = describeWindow(detail.startsAt, detail.endsAt, zone);
  const current = detail.currentWindow
    ? describeWindow(detail.currentWindow.startsAt, detail.currentWindow.endsAt, zone)
    : null;
  const urgency = urgencyOf(detail, now);
  const pending = detail.status === 'pending';
  const decision = detail.decision;

  return (
    <article aria-label={`${detail.reference} detail`} className="flex flex-col">
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-surface p-4">
        {back}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 data-detail-heading tabIndex={-1} className="text-xl font-semibold outline-none">
            {detail.reference}
          </h2>
          <WorkTypeBadge type={detail.type} />
          <BookingStatusBadge status={detail.status} />
        </div>
        <p className="text-muted">
          <Link
            to={`/facilities/${encodeURIComponent(detail.facility.id)}`}
            className="font-medium text-primary underline underline-offset-2"
          >
            {detail.facility.name}
          </Link>
          {` · ${detail.applicantName}`}
        </p>
        {pending && (
          <div className="flex flex-wrap items-center gap-2">
            {detail.actions.approve.allowed && (
              <Button onClick={onApprove} aria-keyshortcuts="a">
                Approve
                <span aria-hidden>
                  <Kbd>a</Kbd>
                </span>
              </Button>
            )}
            {detail.actions.reject.allowed && (
              <Button variant="secondary" onClick={onReject} aria-keyshortcuts="r">
                Reject
                <span aria-hidden>
                  <Kbd>r</Kbd>
                </span>
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-5 p-4">
        {pending && !detail.actions.approve.allowed && (
          <Alert severity="error" title="This request cannot be approved">
            {detail.actions.approve.blockedReason}
          </Alert>
        )}

        {decision && (
          <Alert
            severity={decision.outcome === 'approved' ? 'info' : 'warning'}
            title={`${decision.outcome === 'approved' ? 'Approved' : 'Rejected'}${
              decision.decidedBy ? ` by ${decision.decidedBy}` : ''
            } on ${dateAndTime(decision.decidedAt, zone)}`}
          >
            {decision.outcome === 'rejected' && decision.reason && (
              <>
                <p className="font-medium">Reason sent to the applicant:</p>
                <p className="whitespace-pre-wrap">{decision.reason}</p>
              </>
            )}
            {decision.outcome === 'approved' && decision.internalNote && (
              <>
                <p className="font-medium">Internal note:</p>
                <p className="whitespace-pre-wrap">{decision.internalNote}</p>
              </>
            )}
          </Alert>
        )}

        <Block title={detail.type === 'booking_request' ? 'When' : 'The change asked for'}>
          {current ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <WindowCard muted title="Booked now" window={`${current.text}`} />
              <WindowCard title="Proposed" window={`${when.text}`} />
            </div>
          ) : (
            <p className="text-lg font-semibold">{when.text}</p>
          )}
          {pending && (
            <>
              <p>
                Waiting {elapsed(detail.raisedAt, now)}, since {dateAndTime(detail.raisedAt, zone)}.
                {urgency.target && <strong> {urgency.target.label}.</strong>}
              </p>
              {context.holdExpiresAt && (
                <p>
                  The applicant&apos;s hold on this time ends on{' '}
                  {dateAndTime(context.holdExpiresAt, zone)}.
                  {urgency.hold?.state === 'lapsed'
                    ? ' It has lapsed, so the time is no longer held for them.'
                    : urgency.hold
                      ? ' After that the time is released.'
                      : ''}
                </p>
              )}
            </>
          )}
          <HierarchyConsequence
            facilityName={detail.facility.name}
            affected={context.affectedFacilities}
          />
        </Block>

        {(pending || context.competingRequests.length > 0 || context.blockedBy.length > 0) && (
          <Block title="Competing requests">
            {context.blockedBy.length > 0 && (
              <>
                <p className="font-medium text-danger">
                  Already approved at an overlapping time. This is why it cannot be approved.
                </p>
                <CompetingRequestList
                  label="Approved bookings in the way"
                  requests={context.blockedBy}
                  facilityName={detail.facility.name}
                  zone={zone}
                  search={search}
                />
              </>
            )}
            {context.competingRequests.length > 0 ? (
              <>
                <p>
                  {context.competingRequests.length === 1
                    ? '1 other pending request wants'
                    : `${context.competingRequests.length} other pending requests want`}{' '}
                  overlapping time. If you approve this one,{' '}
                  {context.competingRequests.length === 1 ? 'it' : 'they'} can no longer be
                  approved. {context.competingRequests.length === 1 ? 'It stays' : 'They stay'} in
                  the queue and each needs a rejection with a reason.
                </p>
                <CompetingRequestList
                  label="Competing requests"
                  requests={context.competingRequests}
                  facilityName={detail.facility.name}
                  zone={zone}
                  search={search}
                />
              </>
            ) : (
              pending &&
              context.blockedBy.length === 0 && (
                <p className="flex items-center gap-2 text-muted">
                  <CircleCheck aria-hidden className="size-5 text-primary" />
                  No other request competes for this time.
                </p>
              )
            )}
            {!pending &&
              context.competingRequests.length === 0 &&
              context.blockedBy.length === 0 && (
                <p className="flex items-center gap-2 text-muted">
                  <CircleX aria-hidden className="size-5 text-subtle" />
                  Decided. Competition is only shown while a request is waiting.
                </p>
              )}
          </Block>
        )}

        <Block title="Context for the decision">
          <ContextFacts detail={detail} />
        </Block>

        <Block title="Request">
          {downloadError && <Alert severity="error">{downloadError}</Alert>}
          <RequestSummary detail={detail} onDownload={onDownload} />
        </Block>
      </div>
    </article>
  );
}
