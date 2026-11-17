import { describe, expect, it } from 'vitest';
import { EFFICIENCY_RANGE, PYRAMIDS, efficiencies, upright, zoneAt } from './model';

const pyramid = (id: string) => {
  const p = PYRAMIDS.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('ecology (SH12 Bài 23, 29)', () => {
  it('the tolerance example: 0 and 40 °C are the limits, 20–30 °C the best range', () => {
    expect(zoneAt(-1)).toBe('below');
    expect(zoneAt(0)).toBe('lowStress');
    expect(zoneAt(10)).toBe('lowStress');
    expect(zoneAt(25)).toBe('optimum');
    expect(zoneAt(35)).toBe('highStress');
    expect(zoneAt(40)).toBe('highStress');
    expect(zoneAt(41)).toBe('above');
  });

  it('Hình 29.6: grassland and Silver Springs upright, forest and English Channel inverted', () => {
    expect(upright(pyramid('grassland'))).toBe(true);
    expect(upright(pyramid('springs'))).toBe(true);
    expect(upright(pyramid('reef'))).toBe(true);
    expect(upright(pyramid('forest'))).toBe(false);
    expect(upright(pyramid('channel'))).toBe(false);
  });

  it('Silver Springs: each step within the book’s 5–20 %', () => {
    const e = efficiencies(pyramid('springs'));
    expect(e[0]).toBeCloseTo(3368 / 20810, 12);
    for (const x of e) {
      expect(x).toBeGreaterThanOrEqual(EFFICIENCY_RANGE[0]);
      expect(x).toBeLessThanOrEqual(EFFICIENCY_RANGE[1]);
    }
  });
});
