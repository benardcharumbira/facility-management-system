import type { OperatingDay } from '@/shared/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface HoursGroup {
  /** e.g. "Monday to Friday", "Saturday and Sunday", "Sunday". */
  days: string;
  /** e.g. "08:00 to 16:30", or "Closed". */
  hours: string;
}

function describeDays(names: string[]): string {
  const [first] = names;
  const last = names[names.length - 1];
  if (names.length === 1 || first === undefined || last === undefined) return first ?? '';
  return names.length === 2 ? `${first} and ${last}` : `${first} to ${last}`;
}

/** Collapses consecutive days with the same hours into ranges, in week order. */
export function groupOperatingHours(schedule: readonly OperatingDay[]): HoursGroup[] {
  const sorted = [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const groups: Array<{ names: string[]; hours: string }> = [];

  for (const day of sorted) {
    const name = DAY_NAMES[day.dayOfWeek - 1];
    if (name === undefined) continue;
    const hours =
      day.opensAt !== null && day.closesAt !== null
        ? `${day.opensAt} to ${day.closesAt}`
        : 'Closed';
    const previous = groups[groups.length - 1];
    if (previous && previous.hours === hours) previous.names.push(name);
    else groups.push({ names: [name], hours });
  }

  return groups.map((g) => ({ days: describeDays(g.names), hours: g.hours }));
}
