import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import {
  IF,
  InterferenceEngine,
  MODE,
  interferenceInput,
  measureBeatPeriod,
  measuredBeatPeriod,
  pointM,
  rayLattice,
  runEnd,
} from './engine';
import { amplitudeAt } from './model';

const base = { mode: MODE.same, d: 0.1, f: 10, v: 0.3, a: 2e-4, d1: 0.09, d2: 0.12 };

function run(p: Record<string, number>, frames: number) {
  const e = new InterferenceEngine();
  e.reset(p);
  const r = new EngineRunner(e, 1000);
  const out = new Float64Array(e.stateSize);
  const samples: Float64Array[] = [];
  for (let i = 0; i < frames; i++) {
    const f = r.frame(1 / 60, 0.25);
    if ('code' in f) throw new Error(f.code);
    e.readState(out);
    samples.push(Float64Array.from(out));
  }
  return samples;
}

describe('interference engine', () => {
  it('state = closed form u₁, u₂, u at M; equal frequencies: u = 2a·cos(πΔr/λ)·cos(ωt − π(r₁ + r₂)/λ)', () => {
    const lambda = 0.03;
    const w = 2 * Math.PI * 10;
    for (const s of run(base, 120)) {
      const t = s[IF.t] ?? NaN;
      expect(s[IF.u1]).toBeCloseTo(2e-4 * Math.cos(w * t - (2 * Math.PI * 0.09) / lambda), 15);
      expect(s[IF.u2]).toBeCloseTo(2e-4 * Math.cos(w * t - (2 * Math.PI * 0.12) / lambda), 15);
      const product =
        2 * 2e-4 * Math.cos((Math.PI * 0.03) / lambda) * Math.cos(w * t - (Math.PI * 0.21) / lambda);
      expect(s[IF.u]).toBeCloseTo(product, 15);
      expect(s[IF.env]).toBeCloseTo(amplitudeAt(2e-4, 0.03, lambda), 15);
    }
  });

  it('beats: |u| never exceeds the envelope and touches it once per carrier half-period', () => {
    const samples = run({ ...base, mode: MODE.beats, f2: 11 }, 200);
    for (const s of samples)
      expect(Math.abs(s[IF.u] ?? 0)).toBeLessThanOrEqual((s[IF.env] ?? 0) + 1e-15);
    // Envelope = 2a|cos(½[(ω₁ − ω₂)t − (k₁r₁ − k₂r₂)])|.
    const q = interferenceInput({ ...base, mode: MODE.beats, f2: 11 });
    const k1 = (2 * Math.PI) / q.lambda1;
    const k2 = (2 * Math.PI) / q.lambda2;
    for (const s of samples) {
      const t = s[IF.t] ?? NaN;
      const env = 4e-4 * Math.abs(Math.cos((-2 * Math.PI * t - (k1 * 0.09 - k2 * 0.12)) / 2));
      expect(s[IF.env]).toBeCloseTo(env, 15);
    }
  });

  it('Δt ≤ T/200 of the faster source; the run lasts 20 periods or 3 beat periods', () => {
    const e = new InterferenceEngine();
    e.reset(base);
    expect(e.dt).toBeLessThanOrEqual(1 / 2000);
    while (!e.finished()) e.step();
    expect(e.time() - 2).toBeLessThan(e.dt);
    expect(runEnd(interferenceInput({ ...base, mode: MODE.beats, f2: 11 }))).toBeCloseTo(3, 12);
    expect(runEnd(interferenceInput({ ...base, mode: MODE.beats, f2: 30 }))).toBeCloseTo(2 / 3, 12);
  });

  it('point M: at d₁ from S₁ and d₂ from S₂ (y ≥ 0), or none', () => {
    const m = pointM(0.1, 0.09, 0.12);
    if (!m) throw new Error('no M');
    expect(Math.hypot(m.x + 0.05, m.y)).toBeCloseTo(0.09, 14);
    expect(Math.hypot(m.x - 0.05, m.y)).toBeCloseTo(0.12, 14);
    expect(m.y).toBeGreaterThan(0);
    expect(pointM(0.1, 0.03, 0.07)).toEqual({ x: expect.closeTo(-0.02, 14), y: 0 });
    expect(pointM(0.1, 0.02, 0.07)).toBeNull();
    expect(pointM(0.1, 0.01, 0.12)).toBeNull();
    expect(pointM(0.1, 0, 0.1)).toBeNull();
  });

  it('beat period measured on the engine’s own samples = 1/|f₁ − f₂|', () => {
    for (const [f, f2, d1, d2] of [
      [10, 11, 0.09, 0.12],
      [20, 22, 0.05, 0.08],
      [30, 29.5, 0.1, 0.1],
      [8, 10, 0.03, 0.07],
    ] as const) {
      const T = measuredBeatPeriod({ ...base, mode: MODE.beats, f, f2, d1, d2 });
      expect(Math.abs(T * Math.abs(f - f2) - 1), `${f} / ${f2} Hz`).toBeLessThan(2e-3);
    }
    expect(measuredBeatPeriod(base)).toBeNaN();
  });

  it('beat measurement on a plain sum of two cosines (no engine)', () => {
    const dt = 1e-3;
    const u = Float64Array.from({ length: 6000 }, (_, i) => {
      const t = i * dt;
      return Math.cos(2 * Math.PI * 15 * t + 0.3) + Math.cos(2 * Math.PI * 16.25 * t - 1);
    });
    expect(measureBeatPeriod(u, dt) * 1.25).toBeCloseTo(1, 3);
    expect(measureBeatPeriod(new Float64Array(100), dt)).toBeNaN();
  });
});

describe('DOPRI5 check: each wave from the wave equation along a ray', () => {
  const src = { a: 2e-4, f: 10, v: 0.3 };
  const lambda = 0.03;
  const T = 0.1;
  // Distances on nodes of both lattices (no interpolation error); every time is past the switch-on.
  const rs = [0.03, 0.09, 0.12, 0.15];
  const times = Array.from({ length: 16 }, (_, i) => 0.75 + (i * T) / 16);
  const exact = (r: number, t: number) => src.a * Math.sin(2 * Math.PI * src.f * (t - r / src.v));
  const maxErr = (per: number) => {
    const rows = rayLattice(src, per, rs, times);
    let e = 0;
    rows.forEach((row, i) =>
      rs.forEach((r, j) => {
        e = Math.max(e, Math.abs((row[j] ?? NaN) - exact(r, times[i] ?? NaN)));
      }),
    );
    return e;
  };

  it('converges to a·sin(ω(t − r/v)) with error O(Δx²)', () => {
    const coarse = maxErr(60);
    const fine = maxErr(120);
    expect(fine).toBeLessThan(0.01 * src.a);
    expect(coarse / fine).toBeGreaterThan(3.5);
    expect(coarse / fine).toBeLessThan(4.5);
  });

  it('superposed at M, the lattice waves give the engine’s u delayed by T/4 and its amplitude', () => {
    const p = { ...base, d1: 0.09, d2: 0.12 };
    const rows = rayLattice(src, 160, [0.09, 0.12], times);
    const e = new InterferenceEngine();
    const s = new Float64Array(e.stateSize);
    let peak = 0;
    rows.forEach((row, i) => {
      const sum = (row[0] ?? NaN) + (row[1] ?? NaN);
      peak = Math.max(peak, Math.abs(sum));
      e.reset(p);
      e.writeState(s, (times[i] ?? NaN) - T / 4);
      e.readState(s);
      expect(Math.abs(sum - (s[IF.u] ?? NaN))).toBeLessThan(0.01 * 2 * src.a);
    });
    // 16 samples per period: the sampled peak is within cos(π/16) of the amplitude.
    const A = amplitudeAt(src.a, 0.03, lambda);
    expect(peak).toBeLessThanOrEqual(A * 1.01);
    expect(peak).toBeGreaterThan(A * Math.cos(Math.PI / 16) * 0.99);
  });

  it('beats: the lattice sum of 10 Hz and 11 Hz waves repeats every 1/|f₁ − f₂| = 1 s', () => {
    const dt = 1 / 400;
    const ts = Array.from({ length: Math.round(3.6 / dt) }, (_, i) => 0.6 + i * dt);
    const w1 = rayLattice({ a: 1, f: 10, v: 0.3 }, 40, [0.09], ts);
    const w2 = rayLattice({ a: 1, f: 11, v: 0.3 }, 40, [0.12], ts);
    const u = Float64Array.from(ts, (_, i) => (w1[i]?.[0] ?? NaN) + (w2[i]?.[0] ?? NaN));
    expect(measureBeatPeriod(u, dt)).toBeCloseTo(1, 2);
  });
});
