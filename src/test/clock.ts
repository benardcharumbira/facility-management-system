import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach } from 'vitest';

/**
 * Every test runs at the same instant, so the calendar (which is generated relative to "now")
 * is the same in every run. Monday 2 November 2026, 10:00 in Africa/Johannesburg.
 */
export const FIXED_NOW = DateTime.fromISO('2026-11-02T08:00:00Z', { zone: 'utc' });

beforeEach(() => {
  Settings.now = () => FIXED_NOW.toMillis();
});

afterEach(() => {
  Settings.now = () => Date.now();
});
