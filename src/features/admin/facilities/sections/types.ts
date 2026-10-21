import type { AdminFacility } from '@/shared/api';
import type { GuardOutcome, GuardRequest } from '@/shared/components';

export interface SectionProps {
  facility: AdminFacility;
  /** Runs a change through the impact check. Throws if either step fails. */
  guard: (request: GuardRequest) => Promise<GuardOutcome>;
  /** Tells the screen there are unsaved edits, so leaving can be confirmed. */
  onDirtyChange: (dirty: boolean) => void;
}
