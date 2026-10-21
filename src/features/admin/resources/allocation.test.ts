import { describe, expect, it } from 'vitest';
import {
  baseOf,
  copyColumn,
  fillColumn,
  fillRow,
  keyOf,
  toChanges,
  valueAt,
  withEdit,
  type Edits,
} from './allocation';

const base = baseOf([
  { facilityId: 'a', resourceId: 'chairs', value: 100 },
  { facilityId: 'b', resourceId: 'chairs', value: 50 },
  { facilityId: 'a', resourceId: 'stage', value: true },
  { facilityId: 'b', resourceId: 'stage', value: false },
  { facilityId: 'a', resourceId: 'cups', value: 20 },
  { facilityId: 'b', resourceId: 'cups', value: 0 },
]);
const chairs = { id: 'chairs', quantified: true };
const stage = { id: 'stage', quantified: false };
const cups = { id: 'cups', quantified: true };
const none: Edits = {};

describe('editing a cell', () => {
  it('shows an edit over what is saved', () => {
    const edits = withEdit(none, base, 'a', 'chairs', 90);
    expect(valueAt(edits, base, 'a', 'chairs')).toBe(90);
    expect(valueAt(edits, base, 'b', 'chairs')).toBe(50);
  });

  it('stops counting a cell once it is back at its saved value', () => {
    const edits = withEdit(withEdit(none, base, 'a', 'chairs', 90), base, 'a', 'chairs', 100);
    expect(edits).toEqual({});
  });
});

describe('fillRow', () => {
  it('gives one resource the same value at the facilities given, and no others', () => {
    const edits = fillRow(none, base, chairs, ['a'], 10);
    expect(valueAt(edits, base, 'a', 'chairs')).toBe(10);
    expect(valueAt(edits, base, 'b', 'chairs')).toBe(50);
    expect(Object.keys(edits)).toEqual([keyOf('a', 'chairs')]);
  });

  it('treats an uncounted resource as available or not, whatever it is given', () => {
    const edits = fillRow(none, base, stage, ['a', 'b'], 7);
    expect(valueAt(edits, base, 'b', 'stage')).toBe(true);
    // 'a' already had it available, so that is no change.
    expect(Object.keys(edits)).toEqual([keyOf('b', 'stage')]);
  });
});

describe('fillColumn', () => {
  it('gives counted resources the number and the rest available or not', () => {
    const edits = fillColumn(none, base, 'b', [chairs, stage, cups], { count: 3, available: true });
    expect(valueAt(edits, base, 'b', 'chairs')).toBe(3);
    expect(valueAt(edits, base, 'b', 'cups')).toBe(3);
    expect(valueAt(edits, base, 'b', 'stage')).toBe(true);
  });

  it('touches only the resources given', () => {
    const edits = fillColumn(none, base, 'b', [chairs], { count: 0, available: false });
    expect(valueAt(edits, base, 'b', 'cups')).toBe(0);
    expect(Object.keys(edits)).toEqual([keyOf('b', 'chairs')]);
  });
});

describe('copyColumn', () => {
  it('copies one facility to another for the resources given', () => {
    const edits = copyColumn(none, base, 'a', 'b', [chairs, stage]);
    expect(valueAt(edits, base, 'b', 'chairs')).toBe(100);
    expect(valueAt(edits, base, 'b', 'stage')).toBe(true);
    // Cups was not among the resources given.
    expect(valueAt(edits, base, 'b', 'cups')).toBe(0);
  });

  it('copies what the source shows now, including its own unsaved edits', () => {
    const edited = withEdit(none, base, 'a', 'chairs', 7);
    const edits = copyColumn(edited, base, 'a', 'b', [chairs]);
    expect(valueAt(edits, base, 'b', 'chairs')).toBe(7);
  });
});

describe('toChanges', () => {
  it('sends every edit as a facility, a resource and a value', () => {
    const edits = withEdit(withEdit(none, base, 'a', 'chairs', 1), base, 'b', 'stage', true);
    expect(toChanges(edits)).toEqual([
      { facilityId: 'a', resourceId: 'chairs', value: 1 },
      { facilityId: 'b', resourceId: 'stage', value: true },
    ]);
  });
});
