import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { KeyFacts, type KeyFact } from '../detail/KeyFacts';

export interface ConfirmationPanelProps {
  title: string;
  /** What was just done, one sentence. */
  summary?: ReactNode;
  referenceLabel?: string;
  reference: string;
  status?: ReactNode;
  details: KeyFact[];
  /** What happens next. */
  children?: ReactNode;
  actions?: ReactNode;
}

/** A full screen confirmation that carries the reference, the details and what comes next. */
export function ConfirmationPanel({
  title,
  summary,
  referenceLabel = 'Reference',
  reference,
  status,
  details,
  children,
  actions,
}: ConfirmationPanelProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <CheckCircle2 aria-hidden className="size-10 text-primary" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {summary && <p className="text-base text-muted">{summary}</p>}
      </div>

      <div className="rounded-lg border border-primary-line bg-primary-soft p-5">
        <p className="text-sm font-medium text-muted">{referenceLabel}</p>
        <p className="text-2xl font-semibold tracking-wide tabular-nums">{reference}</p>
        {status && <div className="mt-2">{status}</div>}
      </div>

      <KeyFacts title="Your request" items={details} />
      {children}
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
