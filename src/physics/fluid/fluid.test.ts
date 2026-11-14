import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { checkMisses, sliderEnds, sliderSweep } from '../testing';
import { FL, FluidFallEngine, runLength } from './engine';
import {
  direction,
  dragB,
  fallInput,
  motionAt,
  netWeight,
  reynolds,
  startAccel,
  terminalSpeed,
  travelTime,
  volume,
  type FallInput,
} from './model';
import { fluidFall, reInRange } from './scenes';

const base = { ...fluidFall.defaults, g: 9.81 };
const CASES: [string, FallInput][] = [
  ['light ball in air (defaults)', fallInput(base)],
  ['steel ball in water', fallInput({ ...base, fluid: 1, m: 0.26, r: 0.02, H: 5 })],
  ['light ball rising in water', fallInput({ ...base, fluid: 1, m: 0.0027, r: 0.02, H: 3 })],
  ['heavy ball in air, high', fallInput({ ...base, m: 5, r: 0.05, H: 200 })],
];

/** Speed and distance along the motion from DOPRI5, with no closed form involved. */
function reference(q: FallInput, t: number) {
  const W = Math.abs(netWeight(q));
  const b = dragB(q);
  const r = dopri5(
    (_t, y, dy) => {
      dy[0] = y[1] ?? 0;
      // Inertia with the added mass of a sphere, half the displaced fluid (Lamb).
      dy[1] = (W - b * (y[1] ?? 0) ** 2) / (q.m + 0.5 * q.fluid.rho * volume(q));
    },
    [0, 0],
    0,
    t,
    { rtol: 1e-12, atol: 1e-14 },
  );
  return { s: r.y[0] ?? 0, v: r.y[1] ?? 0 };
}

describe('falling and rising through a fluid (VL10 Bài 19)', () => {
  it.each(CASES)('%s: closed form = DOPRI5 (speed and distance)', (_n, q) => {
    const T = travelTime(q);
    for (const f of [0.05, 0.3, 0.7, 1]) {
      const exact = motionAt(q, f * T);
      const ref = reference(q, f * T);
      expect(exact.v).toBeCloseTo(ref.v, 8);
      expect(exact.s / q.H).toBeCloseTo(ref.s / q.H, 9);
    }
    // The travel time is exactly the time to cross the column.
    expect(motionAt(q, T).s / q.H).toBeCloseTo(1, 12);
  });

  it.each(CASES)('%s: at the terminal speed the drag balances weight minus upthrust', (_n, q) => {
    const vt = terminalSpeed(q);
    expect(dragB(q) * vt * vt).toBeCloseTo(Math.abs(netWeight(q)), 10);
    // From rest the speed only approaches v_t: never above it.
    for (const t of [0.1, 1, 10, 100].map((k) => (k * vt) / startAccel(q)))
      expect(motionAt(q, t).v).toBeLessThanOrEqual(vt * (1 + 1e-12));
  });

  it('sinks when denser than the fluid, rises when lighter, hovers when equal', () => {
    expect(direction(CASES[1]?.[1] as FallInput)).toBe(1);
    expect(direction(CASES[2]?.[1] as FallInput)).toBe(-1);
    const q = fallInput({ ...base, fluid: 1, r: 0.02 });
    const hover = fallInput({ ...base, fluid: 1, r: 0.02, m: q.fluid.rho * volume(q) });
    expect(direction(hover)).toBe(0);
    expect(
      fluidFall
        .solve({ ...base, fluid: 1, r: 0.02, m: q.fluid.rho * volume(q) }, 'vi')
        .answers.map((a) => a.id),
    ).toEqual(['P', 'FA']);
  });

  it.each(CASES)('%s: the engine ends exactly at the bottom (or the surface)', (_n, q) => {
    const e = new FluidFallEngine();
    const p = { ...base, m: q.m, r: q.r, H: q.H, fluid: q.fluid.rho > 10 ? 1 : 0 };
    e.reset(p);
    const s = new Float64Array(e.stateSize);
    let n = 0;
    while (!e.finished() && n < 1e6) {
      e.step();
      n++;
      e.readState(s);
      // Drag never larger than weight minus upthrust (released from rest).
      expect(Math.abs(s[FL.Fd] ?? 0)).toBeLessThanOrEqual(Math.abs(netWeight(q)) * (1 + 1e-12));
    }
    expect(e.time()).toBeCloseTo(runLength(q), 12);
    expect(s[FL.y]).toBeCloseTo(direction(q) > 0 ? 0 : q.H, 9);
  });

  it('the added mass (half the displaced fluid) matters in water, hardly in air', () => {
    const inAir = fallInput(base);
    const inWater = fallInput({ ...base, fluid: 1 });
    const bare = (q: FallInput) => Math.abs(netWeight(q)) / q.m;
    expect(startAccel(inAir) / bare(inAir)).toBeGreaterThan(0.99);
    // A 2,7 g ball of radius 2 cm in water carries about 16,7 g of water with it.
    expect(startAccel(inWater) / bare(inWater)).toBeLessThan(0.2);
    // The terminal speed does not depend on it.
    expect(dragB(inWater) * terminalSpeed(inWater) ** 2).toBeCloseTo(
      Math.abs(netWeight(inWater)),
      10,
    );
  });

  it('the vacuum ball lands at √(2H/g) with √(2gH)', () => {
    const p = fluidFall.solve(base, 'vi').answers;
    const t = p.find((a) => a.id === 'tVac')?.value ?? 0;
    expect(t).toBeCloseTo(Math.sqrt((2 * 20) / 9.81), 12);
    // With drag the same height takes longer.
    expect(p.find((a) => a.id === 'tEnd')?.value ?? 0).toBeGreaterThan(t);
  });

  it('every cross-check agrees, at the slider ends and over a sweep (each fluid)', () => {
    for (const fluid of [0, 1, 2]) {
      const sets = [
        ...sliderEnds(fluidFall).map((p) => ({ ...p, fluid, g: p.g ?? 9.81 })),
        ...sliderSweep(fluidFall, 150, 19 + fluid, { fluid }).map((p) => ({
          ...p,
          g: p.g ?? 9.81,
        })),
      ];
      const misses = sets
        .map((p) => ({ p, m: checkMisses(fluidFall, p) }))
        .filter((r) => r.m.length > 0);
      expect(misses).toEqual([]);
      const checked = sets.filter((p) =>
        fluidFall.solve(p, 'vi').answers.some((a) => a.check !== undefined),
      ).length;
      expect(checked).toBeGreaterThan(sets.length * 0.9);
    }
  });

  it('says when the constant-C_d law does not hold, and cannot tell for a typed-in fluid', () => {
    const q = fallInput(base);
    const re = reynolds(q, terminalSpeed(q));
    // Defaults: about 2,2·10⁴, inside 10³ – 2·10⁵.
    expect(re).toBeGreaterThan(1e3);
    expect(re).toBeLessThan(2e5);
    expect(fluidFall.scienceCard(base).confidence).toBe('exact');
    // A 2 mm bead of 0,04 g sinking slowly in water: Re ≈ 590, below 10³.
    const slow = { ...base, fluid: 1, m: 0.00004, r: 0.002 };
    expect(reInRange(fallInput(slow))).toBe(false);
    expect(fluidFall.scienceCard(slow).confidence).toBe('approx');
    expect(fluidFall.solve(slow, 'vi').notes?.[0]?.vi).toMatch(/^Re = [\d.,]+ nằm ngoài/);
    const custom = { ...base, fluid: 2, rhoF: 1.29 };
    expect(reInRange(fallInput(custom))).toBeNull();
    expect(fluidFall.solve(custom, 'vi').answers.some((a) => a.id === 'Re')).toBe(false);
  });

  it('Science Card cites the fluid data and the drag law', () => {
    const c = fluidFall.scienceCard(base);
    const ids = c.sources.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['iso-2533', 'iapws-water', 'hoerner-drag']));
  });
});
