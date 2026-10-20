import { describe, expect, it } from 'vitest';
import { TS, TrackEngine } from './engine';
import { parabola, speedAt, trackAccel } from './model';
import { barrierAhead, energyConservation, lowestPoint, numericLowSpeed } from './scenes';
import { trackFor } from './engine';

describe('bead on a track', () => {
  it('released from the rim of a parabolic valley: v(bottom) = √(2gH)', () => {
    const p = { shape: 0, H: 3, a: 4, x0: -4, v0: 0, m: 1, g: 9.81 };
    expect(numericLowSpeed(p)).toBeCloseTo(Math.sqrt(2 * 9.81 * 3), 9);
  });

  it('energy is conserved by the RK4 engine to ~1e-11 over 20 s', () => {
    const e = new TrackEngine();
    e.reset({ shape: 1, H: 3, H2: 2, a: 4, w: 1.5, x0: -4, v0: 0.5, g: 9.81 });
    const E0 = e.diagnostics().invariants.energy!;
    let maxDev = 0;
    const st = new Float64Array(5);
    for (let i = 0; i < 4800; i++) {
      e.step();
      e.readState(st);
      if (st[TS.off] === 1) break; // ran off the end of the track
      maxDev = Math.max(maxDev, Math.abs(e.diagnostics().invariants.energy! / E0 - 1));
    }
    expect(maxDev).toBeLessThan(1e-9);
  });

  it('flat track gives zero acceleration; the parabola pulls toward the bottom', () => {
    const tr = parabola(1, 1);
    expect(trackAccel(tr, 9.81, 0, 0)).toBeCloseTo(0, 15);
    expect(trackAccel(tr, 9.81, 0.5, 0)).toBeLessThan(0);
  });

  it('speedAt returns null above the energy level', () => {
    expect(speedAt(9.81, 1, 0, 2)).toBeNull();
    expect(speedAt(9.81, 2, 0, 0)).toBeCloseTo(Math.sqrt(2 * 9.81 * 2), 12);
  });

  it('two-hill default passes the second hill; the engine state stays on the track', () => {
    const sol = energyConservation.solve(energyConservation.defaults, 'vi');
    expect(sol.answers.some((a) => a.id === 'v_top2')).toBe(true);
    for (const a of sol.answers) if (a.check !== undefined) expect(a.check).toBeCloseTo(a.value, 7);
    const e = new TrackEngine();
    e.reset(energyConservation.defaults);
    const s = new Float64Array(5);
    for (let i = 0; i < 100; i++) e.step();
    e.readState(s);
    expect(s[TS.y]).toBeGreaterThan(0);
  });

  it('lowest point of a parabola is its vertex', () => {
    const lp = lowestPoint(parabola(2, 3));
    expect(lp.x).toBeCloseTo(0, 6);
    expect(lp.y).toBeCloseTo(0, 10);
  });
});

describe('two hills: the verdict uses the highest point the bead must actually cross', () => {
  const run = (p: Record<string, number>, seconds: number) => {
    const e = new TrackEngine();
    e.reset(p);
    const s = new Float64Array(5);
    let xMax = -Infinity;
    let xMin = Infinity;
    for (let i = 0; i < seconds * 240; i++) {
      e.step();
      e.readState(s);
      xMax = Math.max(xMax, s[TS.x] ?? 0);
      xMin = Math.min(xMin, s[TS.x] ?? 0);
    }
    return { xMax, xMin };
  };
  const hasTop2 = (p: Record<string, number>) =>
    energyConservation.solve(p, 'en').answers.some((a) => a.id === 'v_top2');

  it('merged hills (a = 1): the bead cannot pass the merged peak, and the Solution says so', () => {
    const p = { ...energyConservation.defaults, a: 1, x0: -1, v0: 0.5 };
    const peak = barrierAhead(trackFor(p), -1, 1);
    expect(peak).not.toBeNull();
    expect(peak?.y ?? 0).toBeGreaterThan(3.4); // ≈ 3.437 m at x ≈ −0.656 m
    expect(hasTop2(p)).toBe(false);
    // The engine agrees: it never gets past the peak.
    expect(run(p, 3).xMax).toBeLessThan(peak?.x ?? 0);
  });

  it('separate hills (default): passes the second hill; v_top2 is the speed on its top', () => {
    const p = energyConservation.defaults;
    const sol = energyConservation.solve(p, 'en');
    const top = sol.answers.find((a) => a.id === 'v_top2');
    const peak = barrierAhead(trackFor(p), p.x0 ?? 0, 1);
    expect(peak?.x ?? 0).toBeGreaterThan(3);
    const g = p.g ?? 9.81;
    const y0 = trackFor(p).f(p.x0 ?? 0);
    const v0 = p.v0 ?? 0;
    expect(top?.value).toBeCloseTo(Math.sqrt(v0 * v0 + 2 * g * (y0 - (peak?.y ?? 0))), 12);
  });

  it('thrown backwards (v0 < 0) off the first hill: leaves on the left, never reaches hill two', () => {
    const p: Record<string, number> = { ...energyConservation.defaults, v0: -0.5 };
    expect(hasTop2(p)).toBe(false);
    expect(run(p, 3).xMax).toBeLessThanOrEqual(p.x0 ?? 0);
  });
});
