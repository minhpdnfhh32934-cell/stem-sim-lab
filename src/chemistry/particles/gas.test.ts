import { describe, expect, it } from 'vitest';
import { Gas2D, TYPE_A, TYPE_B, TYPE_C, mb2d, mb3d } from './gas';

function simpson(f: (x: number) => number, a: number, b: number, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

describe('2D hard-disk gas', () => {
  it('conserves kinetic energy and momentum in elastic collisions', () => {
    const g = new Gas2D({ n: 150, box: 30, seed: 3 });
    const e0 = g.kineticEnergy();
    for (let k = 0; k < 200; k++) g.advance(0.05);
    expect(Math.abs(g.kineticEnergy() - e0) / e0).toBeLessThan(1e-9);
  });

  it('relaxes from equal speeds to the 2D Maxwell–Boltzmann distribution', () => {
    const g = new Gas2D({ n: 400, box: 40, seed: 5, start: 'equal' });
    for (let k = 0; k < 400; k++) g.advance(0.05);
    // Mean speed of the 2D distribution: √(πkT/2m).
    let sum = 0;
    const samples: number[] = [];
    for (let rep = 0; rep < 40; rep++) {
      g.advance(0.25);
      for (let i = 0; i < g.n; i++) {
        const v = g.speed(i);
        sum += v;
        samples.push(v);
      }
    }
    const mean = sum / samples.length;
    expect(Math.abs(mean - Math.sqrt(Math.PI / 2))).toBeLessThan(0.03);
    // Histogram vs theory: total absolute deviation small.
    const bins = 12;
    const vmax = 4;
    const hist = new Array<number>(bins).fill(0);
    for (const v of samples) if (v < vmax) hist[Math.floor((v / vmax) * bins)]! += 1;
    let err = 0;
    for (let b = 0; b < bins; b++) {
      const lo = (b * vmax) / bins;
      const hi = ((b + 1) * vmax) / bins;
      const p = simpson(mb2d, lo, hi, 200);
      err += Math.abs((hist[b] ?? 0) / samples.length - p);
    }
    expect(err).toBeLessThan(0.05);
  });

  it('theoretical densities are normalized', () => {
    expect(simpson(mb2d, 0, 12)).toBeCloseTo(1, 6);
    expect(simpson(mb3d, 0, 12)).toBeCloseTo(1, 6);
  });

  it('fraction of energetic A–B collisions ≈ exp(−Eₐ/k_BT) (line-of-centres model)', () => {
    for (const ea of [0.5, 1.5]) {
      // Reversible so reactants never run out; only collision statistics are measured.
      const g = new Gas2D({ n: 400, box: 32, seed: 9, fractionB: 0.5, ea, reversible: true });
      for (let k = 0; k < 800; k++) g.advance(0.05);
      const frac = g.energeticCollisions / g.pairCollisions;
      expect(g.pairCollisions).toBeGreaterThan(2000);
      expect(Math.abs(frac - Math.exp(-ea))).toBeLessThan(0.03);
    }
  });

  it('A + B → C + D converts reactants and conserves particle count', () => {
    const g = new Gas2D({ n: 200, box: 30, seed: 2, fractionB: 0.5, ea: 0.5 });
    const a0 = g.count(TYPE_A);
    const b0 = g.count(TYPE_B);
    for (let k = 0; k < 200; k++) g.advance(0.05);
    expect(g.count(TYPE_C)).toBe(a0 - g.count(TYPE_A));
    expect(a0 - g.count(TYPE_A)).toBe(b0 - g.count(TYPE_B));
    expect(g.count(TYPE_C)).toBeGreaterThan(0);
    expect(g.count(TYPE_A) + g.count(TYPE_B) + 2 * g.count(TYPE_C)).toBe(200);
  });
});
