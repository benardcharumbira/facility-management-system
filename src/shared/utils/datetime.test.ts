import { describe, expect, it } from 'vitest';
import { fromApiInstant, toApiInstant } from './datetime';

describe('datetime', () => {
  it('renders an instant in the facility zone, not the runtime zone', () => {
    const value = fromApiInstant('2026-03-01T22:30:00Z', 'Africa/Johannesburg');
    expect(value.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-03-02 00:30');
  });

  it('round-trips to a UTC instant', () => {
    const value = fromApiInstant('2026-03-01T22:30:00Z', 'Africa/Johannesburg');
    expect(toApiInstant(value)).toBe('2026-03-01T22:30:00.000Z');
  });

  it('rejects invalid input', () => {
    expect(() => fromApiInstant('nope', 'UTC')).toThrow();
  });
});
