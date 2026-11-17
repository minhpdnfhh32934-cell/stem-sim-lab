import { describe, expect, it } from 'vitest';
import { sgkVl12 } from '../common/sources';
import { magneticCard } from './card';
import {
  COIL,
  TABLE_15_1,
  cross,
  currentFromElectrons,
  fieldFromForce,
  force,
  forceDirection,
  measure,
} from './model';
import { loadExample, setMagnetic, useMagneticStore } from './store';

describe('magnetic force (VL12 Bài 15)', () => {
  it('Bảng 15.1 as printed; its F/(IL) column is the computed value rounded', () => {
    expect(TABLE_15_1.map((r) => [r.I, r.F])).toEqual([
      [0.1, 0.02],
      [0.2, 0.05],
      [0.3, 0.07],
      [0.4, 0.09],
    ]);
    expect(COIL.turns * COIL.side_m).toBeCloseTo(COIL.length_m, 12);
    const m = measure();
    m.values.forEach((b, i) => {
      expect(b).toBeCloseTo(TABLE_15_1[i]?.B_printed ?? 0, 3);
    });
  });

  it('question 1, tr. 63: 1 m, 3 A, 5·10⁻² T, 60° → F ≈ 0,13 N', () => {
    expect(force(5e-2, 3, 1, 60)).toBeCloseTo(0.15 * (Math.sqrt(3) / 2), 12);
    expect(force(5e-2, 3, 1, 0)).toBe(0);
    expect(force(5e-2, 3, 1, 180)).toBe(0);
    expect(fieldFromForce(force(0.2, 2, 0.5, 30), 2, 0.5, 30)).toBeCloseTo(0.2, 12);
    expect(fieldFromForce(1, 2, 0.5, 0)).toBeNull();
  });

  it('question 2, tr. 63: 10¹⁸ electrons each second is 0,16 A; 50 cm across 5 mT → 4·10⁻⁴ N', () => {
    const I = currentFromElectrons(1e18);
    expect(I).toBeCloseTo(0.16, 12);
    expect(force(5e-3, I, 0.5, 90)).toBeCloseTo(4e-4, 15);
  });

  it('the direction is I⃗ × B⃗ (left-hand rule): perpendicular to the page, flips with the current', () => {
    for (const alpha of [10, 60, 90, 135, 170]) {
      const a = (alpha * Math.PI) / 180;
      for (const reversed of [false, true]) {
        const s = reversed ? -1 : 1;
        const z = cross([s * Math.cos(a), s * Math.sin(a), 0], [1, 0, 0])[2];
        expect(forceDirection(alpha, reversed)).toBe(z < 0 ? 'into' : 'outOf');
      }
    }
    expect(forceDirection(0, false)).toBe('none');
    expect(forceDirection(180, true)).toBe('none');
  });

  it('measuring B from Bảng 15.1: mean, mean absolute error, slope through the origin', () => {
    const m = measure();
    expect(m.mean).toBeCloseTo((0.01 + 0.0125 + 0.07 / 6 + 0.01125) / 4, 12);
    expect(m.error).toBeCloseTo(0.000729, 6);
    // ΣIF / ΣI² = 0,069 / 0,3 = 0,23 N/A, so B = 0,23 / 20 = 0,0115 T.
    expect(m.slope).toBeCloseTo(0.23, 12);
    expect(m.fromSlope).toBeCloseTo(0.0115, 12);
    expect(m.relative).toBeLessThan(0.07);
  });

  it('the store opens on question 1 and loads question 2 with its current', () => {
    const s = useMagneticStore.getState();
    expect(force(s.B, s.I, s.L, s.alpha)).toBeCloseTo(0.1299, 4);
    loadExample('electrons');
    expect(useMagneticStore.getState()).toMatchObject({ L: 0.5, alpha: 90, B: 5e-3 });
    expect(useMagneticStore.getState().I).toBeCloseTo(0.16, 12);
    setMagnetic({ alpha: 400, reversed: 'yes' });
    expect(useMagneticStore.getState()).toMatchObject({ alpha: 180, reversed: false });
    loadExample('wire-60');
    expect(magneticCard().sources.map((x) => x.id)).toEqual(
      expect.arrayContaining([sgkVl12(15).id]),
    );
  });
});
