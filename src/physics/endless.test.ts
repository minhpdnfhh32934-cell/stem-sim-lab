import { describe, expect, it } from 'vitest';
import { CircularEngine, CE } from './circular/engine';
import { MODE as CIRCLE } from './circular/model';
import { InterferenceEngine, IF, interferenceInput, MODE as WAVES } from './interference/engine';
import { KeplerEngine, KE } from './kepler/engine';
import { gm, orbit, semiMinor, A as SEMI_MAJOR } from './kepler/model';
import { ResonanceEngine, RE } from './resonance/engine';
import { SpringEngine, SP } from './spring/engine';
import { StandingWaveEngine, SW, standingInput } from './wave/engine';

/**
 * #205 C1: the periodic lessons have no end of their own and keep time as steps × dt. Run for
 * real to t = 10⁵ s, each engine still matches its closed form, written here on its own.
 */
const T_LONG = 1e5;

function runTo(e: { dt: number; step(): void; time(): number; finished(): boolean }, t: number) {
  const n = Math.round(t / e.dt);
  for (let i = 0; i < n; i++) e.step();
  expect(e.finished()).toBe(false);
  // Steps × dt: no time is lost or gained to rounding over 10⁵ s.
  expect(e.time()).toBe(n * e.dt);
  return e.time();
}

// Up to 5·10⁸ steps (a counter each): seconds, not the 5 s default, on a slow CI runner.
describe('periodic lessons run on: closed form at t = 10⁵ s (#205 C1)', { timeout: 60_000 }, () => {
  it('uniform circular motion: phase φ₀ + ωt, radius r, speed v', () => {
    const p = { mode: CIRCLE.v, r: 1.5, v: 4, phi0: 0.3, dir: 1, m: 1 };
    const e = new CircularEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const phi = 0.3 + (4 / 1.5) * t;
    expect(Math.abs(out[CE.x]! - 1.5 * Math.cos(phi))).toBeLessThan(1e-9);
    expect(Math.abs(out[CE.y]! - 1.5 * Math.sin(phi))).toBeLessThan(1e-9);
  });

  it('undamped spring: x₀ cos ωt + (v₀/ω) sin ωt, stepped 2.4·10⁷ times', () => {
    const p = { m: 0.5, k: 20, b: 0, x0: 0.1, v0: 0.3 };
    const e = new SpringEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const w = Math.sqrt(20 / 0.5);
    const x = 0.1 * Math.cos(w * t) + (0.3 / w) * Math.sin(w * t);
    const v = -0.1 * w * Math.sin(w * t) + 0.3 * Math.cos(w * t);
    expect(Math.abs(out[SP.x]! - x)).toBeLessThan(1e-9);
    expect(Math.abs(out[SP.v]! - v)).toBeLessThan(1e-8);
  });

  it('damped spring settles at rest and stays there', () => {
    const e = new SpringEngine();
    e.reset({ m: 0.5, k: 20, b: 0.4, x0: 0.1, v0: 0 });
    runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    expect(Math.abs(out[SP.x]!)).toBeLessThan(1e-12);
  });

  it('forced oscillation: the steady state A cos(Ωt − φ) with A, φ from the driven equation', () => {
    const p = { m: 0.5, k: 50, b: 0.5, F0: 1, Omega: 8 };
    const e = new ResonanceEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const w0sq = 50 / 0.5;
    const twoGammaW = (0.5 / 0.5) * 8;
    const A = 1 / 0.5 / Math.hypot(w0sq - 64, twoGammaW);
    const phi = Math.atan2(twoGammaW, w0sq - 64);
    expect(Math.abs(out[RE.x]! - A * Math.cos(8 * t - phi))).toBeLessThan(1e-9);
  });

  it("Kepler: on the ellipse r = a(1 − e cos E) with E from Kepler's equation, area rate πab/T", () => {
    const p = { e: 0.5, T: 7 };
    const o = orbit(p);
    const e = new KeplerEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    // Mean anomaly → eccentric anomaly by Newton's method, here on its own.
    const M = ((2 * Math.PI * t) / o.T) % (2 * Math.PI);
    let E = M;
    for (let i = 0; i < 50; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
    expect(Math.abs(out[KE.r]! - SEMI_MAJOR * (1 - o.e * Math.cos(E)))).toBeLessThan(1e-9);
    expect(Math.abs(out[KE.areal]! - (Math.PI * SEMI_MAJOR * semiMinor(o)) / o.T)).toBeLessThan(
      1e-9,
    );
    // Energy of the orbit: v²/2 − GM/r = −GM/(2a).
    const energy = out[KE.v]! ** 2 / 2 - gm(o) / out[KE.r]!;
    expect(Math.abs(energy + gm(o) / (2 * SEMI_MAJOR)) / (gm(o) / (2 * SEMI_MAJOR))).toBeLessThan(
      1e-9,
    );
  });

  it('two in-phase sources: u = a cos(ωt − kd₁) + a cos(ωt − kd₂)', () => {
    const p = { mode: WAVES.same, d: 0.1, f: 10, v: 0.3, a: 2e-4, d1: 0.09, d2: 0.12 };
    const q = interferenceInput(p);
    const e = new InterferenceEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const w = 2 * Math.PI * 10;
    const k = w / q.v;
    const u = 2e-4 * Math.cos(w * t - k * 0.09) + 2e-4 * Math.cos(w * t - k * 0.12);
    expect(Math.abs(out[IF.u]! - u)).toBeLessThan(1e-12);
  });

  it('standing wave: y = 2A sin(kx) sin(ωt) at the probe', () => {
    const p = { L: 1, f: 25, v: 10, A: 0.01, xP: 0.3 };
    const q = standingInput(p);
    const e = new StandingWaveEngine();
    e.reset(p);
    const t = runTo(e, T_LONG);
    const out = new Float64Array(e.stateSize);
    e.readState(out);
    const w = 2 * Math.PI * q.f;
    const k = w / q.v;
    expect(Math.abs(out[SW.y]! - 2 * q.A * Math.sin(k * q.xP) * Math.sin(w * t))).toBeLessThan(
      1e-12,
    );
  });
});
