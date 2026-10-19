import { describe, expect, it } from 'vitest';
import { groupOperatingHours } from './operatingHours';

const day = (dayOfWeek: number, opensAt: string | null, closesAt: string | null) => ({
  dayOfWeek,
  opensAt,
  closesAt,
});

describe('groupOperatingHours', () => {
  it('groups consecutive days with the same hours', () => {
    const office = [1, 2, 3, 4, 5].map((d) => day(d, '08:00', '16:30'));
    const weekend = [6, 7].map((d) => day(d, null, null));
    expect(groupOperatingHours([...office, ...weekend])).toEqual([
      { days: 'Monday to Friday', hours: '08:00 to 16:30' },
      { days: 'Saturday and Sunday', hours: 'Closed' },
    ]);
  });

  it('keeps a single different day on its own and sorts by day', () => {
    const week = [7, 3, 1, 2, 4, 5, 6].map((d) => day(d, '07:00', d === 7 ? '12:00' : '23:00'));
    expect(groupOperatingHours(week)).toEqual([
      { days: 'Monday to Saturday', hours: '07:00 to 23:00' },
      { days: 'Sunday', hours: '07:00 to 12:00' },
    ]);
  });

  it('treats a day with a missing time as closed', () => {
    expect(groupOperatingHours([day(1, '08:00', null)])).toEqual([
      { days: 'Monday', hours: 'Closed' },
    ]);
  });
});
