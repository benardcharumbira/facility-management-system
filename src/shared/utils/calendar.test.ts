import { describe, expect, it } from 'vitest';
import {
  addMonths,
  compareYearMonth,
  formatYearMonth,
  monthGridDays,
  monthGridRange,
  parseYearMonth,
} from './calendar';

describe('calendar helpers', () => {
  it('parses and formats year months, rejecting bad input', () => {
    expect(parseYearMonth('2026-11')).toEqual({ year: 2026, month: 11 });
    expect(formatYearMonth({ year: 2027, month: 1 })).toBe('2027-01');
    for (const bad of ['2026-13', '2026-00', '26-11', '2026-1', 'november']) {
      expect(parseYearMonth(bad)).toBeUndefined();
    }
  });

  it('adds months across year boundaries in both directions', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 });
    expect(compareYearMonth({ year: 2026, month: 11 }, { year: 2027, month: 1 })).toBeLessThan(0);
  });

  it('builds a six week, Monday first grid whatever the month', () => {
    // February 2027 starts on a Monday and has exactly four weeks; the grid still has six.
    const february = monthGridDays({ year: 2027, month: 2 }, 'Africa/Johannesburg');
    expect(february).toHaveLength(42);
    expect(february[0]?.toISODate()).toBe('2027-02-01');
    expect(february[41]?.toISODate()).toBe('2027-03-14');
    expect(february.every((d, i) => d.weekday === (i % 7) + 1)).toBe(true);
  });

  it('gives the inclusive date range the availability endpoint is asked for', () => {
    expect(monthGridRange({ year: 2026, month: 11 }, 'utc')).toEqual({
      from: '2026-10-26',
      to: '2026-12-06',
    });
  });
});
