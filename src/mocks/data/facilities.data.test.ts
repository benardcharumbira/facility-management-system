import { describe, expect, it } from 'vitest';
import { CONFIRMED_FIELDS, REAL_FACILITIES } from './facilities.real';
import { VOLUME_FACILITIES } from './facilities.volume';

/** BRD v2.0 section 7, exactly as supplied. */
const CONFIRMED_NAMES = [
  'City Hall',
  'Mitchell Wing',
  'City Hall Committee Room',
  'Loch Wing',
  'Council Chambers',
  'Rothdene Hall',
  'Vaal Marina Hall',
  'Vaal Marina Board Room',
  'Activity Room',
  'Bantu Bonke Hall',
  'Sicelo Hall',
  'Lakeside Hall',
];

const byName = (name: string) => {
  const found = REAL_FACILITIES.find((f) => f.name === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
};

describe('Midvaal venues fixture', () => {
  it('contains exactly the twelve confirmed names, spelled as given', () => {
    expect(REAL_FACILITIES.map((f) => f.name).sort()).toEqual([...CONFIRMED_NAMES].sort());
  });

  it('lists every invented or inferred field in provisionalFields', () => {
    for (const record of REAL_FACILITIES) {
      const fields = Object.keys(record).filter((key) => key !== 'provisionalFields');
      const provisional = record.provisionalFields ?? [];
      // Every field is either confirmed or declared provisional, and never both.
      for (const field of fields) {
        const confirmed = (CONFIRMED_FIELDS as readonly string[]).includes(field);
        expect(provisional.includes(field), `${record.name}.${field}`).toBe(!confirmed);
      }
      expect(provisional.every((f) => fields.includes(f))).toBe(true);
      expect(provisional).toContain('capacity');
    }
  });

  it('models the inferred hierarchy and nothing more', () => {
    const parents = Object.fromEntries(
      REAL_FACILITIES.map((f) => [f.name, f.parentFacility?.name ?? null]),
    );
    expect(parents).toMatchObject({
      'Mitchell Wing': 'City Hall',
      'Loch Wing': 'City Hall',
      'City Hall Committee Room': 'City Hall',
      'Vaal Marina Board Room': 'Vaal Marina Hall',
      'Council Chambers': null,
      'Activity Room': null,
      'City Hall': null,
    });
    for (const f of REAL_FACILITIES.filter((f) => f.parentFacility)) {
      expect(REAL_FACILITIES.some((p) => p.id === f.parentFacility?.id)).toBe(true);
    }
  });

  it('places localities as inferred, with unknowns marked to be confirmed', () => {
    const locality = (n: string) => byName(n).locality;
    for (const n of [
      'City Hall',
      'Mitchell Wing',
      'Loch Wing',
      'City Hall Committee Room',
      'Council Chambers',
    ]) {
      expect(locality(n)).toBe('Meyerton');
    }
    expect(locality('Rothdene Hall')).toBe('Rothdene');
    expect(locality('Vaal Marina Hall')).toBe('Vaal Marina');
    expect(locality('Vaal Marina Board Room')).toBe('Vaal Marina');
    expect(locality('Sicelo Hall')).toBe('Sicelo');
    expect(locality('Lakeside Hall')).toBe('Lakeside');
    expect(locality('Bantu Bonke Hall')).toBe('To be confirmed');
    expect(locality('Activity Room')).toBe('To be confirmed');
  });

  it('uses only the venue derived type vocabulary', () => {
    expect(new Set(REAL_FACILITIES.map((f) => f.type.name))).toEqual(
      new Set([
        'Civic hall',
        'Hall',
        'Hall wing',
        'Committee room',
        'Board room',
        'Council chamber',
        'Activity room',
      ]),
    );
    expect(byName('City Hall').type.name).toBe('Civic hall');
    expect(byName('Mitchell Wing').type.name).toBe('Hall wing');
    expect(byName('Sicelo Hall').type.name).toBe('Hall');
  });

  it('uses only the resources named in BRD section 8.4, with none at the board room kitchen or stage', () => {
    const vocabulary = new Set(['Tables', 'Chairs', 'Stage', 'Podium', 'Sound system', 'Kitchen']);
    for (const f of REAL_FACILITIES)
      for (const a of f.amenities) expect(vocabulary.has(a.name)).toBe(true);
    const boardRoom = byName('Vaal Marina Board Room').amenities.map((a) => a.id);
    expect(boardRoom).not.toContain('kitchen');
    expect(boardRoom).not.toContain('stage');
  });

  it('has no photographs and no invented addresses or coordinates', () => {
    for (const f of REAL_FACILITIES) {
      expect(f.primaryImageUrl).toBeNull();
      expect(Object.keys(f)).not.toEqual(
        expect.arrayContaining(['address', 'latitude', 'longitude']),
      );
    }
  });

  it('has unique ids', () => {
    expect(new Set(REAL_FACILITIES.map((f) => f.id)).size).toBe(REAL_FACILITIES.length);
  });
});

describe('volume fixture', () => {
  it('is obviously fictional and shares no name with a Midvaal venue', () => {
    expect(VOLUME_FACILITIES.length).toBeGreaterThan(60);
    for (const f of VOLUME_FACILITIES) {
      expect(f.name).toContain('Volume Test');
      expect(f.shortDescription).toContain('Not a real venue');
      expect(CONFIRMED_NAMES).not.toContain(f.name);
      expect(f.provisionalFields?.length).toBeGreaterThan(0);
    }
    expect(VOLUME_FACILITIES.some((f) => f.capacity === null)).toBe(true);
    expect(VOLUME_FACILITIES.some((f) => f.status === 'unavailable')).toBe(true);
    expect(VOLUME_FACILITIES.some((f) => f.parentFacility)).toBe(true);
  });
});
