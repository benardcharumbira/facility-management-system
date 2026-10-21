import type { DateTime } from 'luxon';
import { DateTime as Luxon } from 'luxon';
import type { ApprovalListItem } from '@/shared/api';
import { durationText } from '@/shared/utils/format';

/** An item is "approaching" its target when it falls due within this many hours. */
export const APPROACHING_TARGET_HOURS = 24;
/** A hold is "expiring soon" when it lapses within this many hours. */
export const HOLD_SOON_HOURS = 24;

export interface Urgency {
  target: { state: 'over' | 'soon'; label: string } | null;
  hold: { state: 'lapsed' | 'soon'; label: string } | null;
}

type Subject = Pick<
  ApprovalListItem,
  'status' | 'type' | 'raisedAt' | 'turnaroundTargetHours' | 'holdExpiresAt'
>;

/**
 * What needs hurrying. Only for something still waiting. The target is the API's (where it gives
 * one); the thresholds for "approaching" are this screen's.
 */
export function urgencyOf(item: Subject, now: DateTime): Urgency {
  const none: Urgency = { target: null, hold: null };
  if (item.status !== 'pending') return none;

  let target: Urgency['target'] = null;
  if (item.turnaroundTargetHours !== null) {
    const waited = now.diff(Luxon.fromISO(item.raisedAt, { zone: 'utc' }), 'hours').hours;
    const remaining = item.turnaroundTargetHours - waited;
    if (remaining < 0) {
      target = { state: 'over', label: `Over target by ${durationText(-remaining)}` };
    } else if (remaining <= APPROACHING_TARGET_HOURS) {
      target = { state: 'soon', label: `Target in ${durationText(remaining)}` };
    }
  }

  let hold: Urgency['hold'] = null;
  if (item.holdExpiresAt) {
    const left = Luxon.fromISO(item.holdExpiresAt, { zone: 'utc' }).diff(now, 'hours').hours;
    if (left <= 0) hold = { state: 'lapsed', label: 'Hold has lapsed' };
    else if (left <= HOLD_SOON_HOURS) {
      hold = { state: 'soon', label: `Hold ends in ${durationText(left)}` };
    }
  }
  return { target, hold };
}
