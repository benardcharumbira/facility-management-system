import {
  ACTION_NOT_ALLOWED_PROBLEM_TYPE,
  ALREADY_DECIDED_PROBLEM_TYPE,
  ApiProblem,
  type AlreadyDecidedExtensions,
  type ApprovalDetail,
} from '@/shared/api';
import { DecisionDialog, type DecisionFailure } from '@/shared/components';
import { dateAndTime, describeWindow } from '@/shared/utils/format';
import type { Decision } from '../hooks';

export interface DecisionTarget {
  kind: 'approve' | 'reject';
  /** The item as it was when the dialog opened, so it does not change under the dialog as the queue moves on. */
  item: ApprovalDetail;
  open: boolean;
}

interface ApprovalDecisionsProps {
  dialog: DecisionTarget | null;
  note: string;
  onNoteChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  /** Makes the decision, refreshes the queue and moves on. Throws if the decision fails. */
  onDecide: (item: ApprovalDetail, decision: Decision) => Promise<void>;
  /** The decision was lost to someone else: move on without having made it. */
  onSettled: () => void;
  returnFocus: () => HTMLElement | null;
}

function failureOf(
  error: unknown,
  item: ApprovalDetail,
  typed: string,
  noun: string,
): DecisionFailure {
  const problem = ApiProblem.from(error);
  const zone = item.facility.timeZone;

  if (problem.status === 409 && problem.type === ALREADY_DECIDED_PROBLEM_TYPE) {
    const { decision } = problem.extensions as unknown as AlreadyDecidedExtensions;
    const by = decision.decidedBy ? ` by ${decision.decidedBy}` : '';
    return {
      title: 'Already decided',
      final: true,
      message: (
        <>
          <p>
            This request was {decision.outcome}
            {by} on {dateAndTime(decision.decidedAt, zone)}. Your decision has not been made.
          </p>
          {typed.trim() !== '' && (
            <p className="mt-1">
              Your {noun} was not sent. It is still in the box below if you want to keep it.
            </p>
          )}
        </>
      ),
    };
  }
  if (problem.status === 409 && problem.type === ACTION_NOT_ALLOWED_PROBLEM_TYPE) {
    return {
      title: 'This can no longer be done',
      final: true,
      message: problem.detail ?? 'The request has changed since you opened it.',
    };
  }
  if (problem.status === 422 && problem.errors.reason?.[0]) {
    return { title: 'Check your reason', message: problem.errors.reason[0] };
  }
  return {
    title: 'That did not work',
    message: problem.detail ?? 'Something went wrong. Please try again.',
  };
}

function Affected({ item }: { item: ApprovalDetail }) {
  const competing = item.context.competingRequests;
  if (competing.length === 0) return <li>No other pending request is affected.</li>;
  return (
    <li>
      {competing.length === 1
        ? 'This pending request becomes impossible. It stays in the queue and needs a rejection with a reason:'
        : `These ${competing.length} pending requests become impossible. They stay in the queue and each needs a rejection with a reason:`}
      <ul aria-label="Requests that become impossible" className="mt-1 list-disc pl-5">
        {competing.map((c) => (
          <li key={c.workItemId}>
            <strong>{c.reference}</strong>, {c.applicantName}, {c.facility.name}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The approve and reject confirmations, each saying what follows from it. */
export function ApprovalDecisions({
  dialog,
  note,
  onNoteChange,
  reason,
  onReasonChange,
  onOpenChange,
  onDecide,
  onSettled,
  returnFocus,
}: ApprovalDecisionsProps) {
  if (!dialog) return null;
  const { item, kind, open } = dialog;
  const zone = item.facility.timeZone;
  const when = describeWindow(item.startsAt, item.endsAt, zone);
  const now =
    item.currentWindow &&
    describeWindow(item.currentWindow.startsAt, item.currentWindow.endsAt, zone);
  const isMove = item.type === 'reschedule_request';

  if (kind === 'approve') {
    return (
      <DecisionDialog
        open={open}
        onOpenChange={onOpenChange}
        returnFocus={returnFocus}
        title={isMove ? 'Approve this change of date?' : 'Approve this request?'}
        description={
          <div className="flex flex-col gap-2 text-ink">
            <p>
              <strong>{item.reference}</strong> for <strong>{item.applicantName}</strong> at{' '}
              {item.facility.name}, {when.date}, {when.time}.
            </p>
            <ul className="m-0 list-disc pl-5">
              {isMove && now ? (
                <li>
                  The booking moves from {now.date}, {now.time}, and that time is released.
                </li>
              ) : (
                <li>The slot is confirmed.</li>
              )}
              <li>{item.applicantName} is emailed the decision.</li>
              <Affected item={item} />
            </ul>
          </div>
        }
        confirmLabel={isMove ? 'Approve change' : 'Approve request'}
        initialFocus="confirm"
        field={{
          label: 'Internal note (optional)',
          hint: 'Only approvers see this. It is not sent to the applicant.',
          value: note,
          onChange: onNoteChange,
          rows: 2,
          maxLength: 1000,
        }}
        onConfirm={() => onDecide(item, { kind: 'approve', note })}
        describeFailure={(error) => failureOf(error, item, note, 'note')}
        onContinue={onSettled}
      />
    );
  }

  return (
    <DecisionDialog
      open={open}
      onOpenChange={onOpenChange}
      returnFocus={returnFocus}
      tone="danger"
      title={isMove ? 'Reject this change of date?' : 'Reject this request?'}
      description={
        <div className="flex flex-col gap-2 text-ink">
          <p>
            <strong>{item.reference}</strong> for <strong>{item.applicantName}</strong> at{' '}
            {item.facility.name}, {when.date}, {when.time}.
          </p>
          <ul className="m-0 list-disc pl-5">
            {isMove && now ? (
              <li>
                The booking stays approved where it is: {now.date}, {now.time}.
              </li>
            ) : (
              <li>The time held for the applicant is released.</li>
            )}
            <li>
              {item.applicantName} is emailed that this was not approved, with the reason you write
              below.
            </li>
          </ul>
        </div>
      }
      confirmLabel={isMove ? 'Reject change' : 'Reject request'}
      initialFocus="field"
      field={{
        label: 'Reason for the applicant',
        hint: 'Sent to the applicant exactly as you write it. It is the only explanation they will receive, so say what they can do next.',
        value: reason,
        onChange: onReasonChange,
        required: true,
        requiredMessage: 'Give a reason. The applicant receives it as written.',
        rows: 5,
        maxLength: 1000,
      }}
      onConfirm={() => onDecide(item, { kind: 'reject', reason })}
      describeFailure={(error) => failureOf(error, item, reason, 'reason')}
      onContinue={onSettled}
    />
  );
}
