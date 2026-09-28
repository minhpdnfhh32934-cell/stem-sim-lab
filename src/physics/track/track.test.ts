import { describe, expect, it } from 'vitest';
import { TS, TrackEngine } from './engine';
import { parabola, speedAt, trackAccel } from './model';
import { energyConservation, lowestPoint, numericLowSpeed } from './scenes';

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
