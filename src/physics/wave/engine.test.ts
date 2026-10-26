import { describe, expect, it } from 'vitest';
import { EngineRunner } from '@/core/sim/runner';
import {
  MODE,
  SW,
  StandingWaveEngine,
  checkedFrequency,
  latticeOmega,
  latticeAt,
  latticeFrequency,
  standingInput,
  waveOf,
} from './engine';
import { harmonicFrequency, standing } from './model';

const base = { mode: MODE.frequency, L: 1.2, n: 3, v: 20, A: 0.01, xP: 0.2 };

function run(p: Record<string, number>, frames: number) {
  const e = new StandingWaveEngine();
  e.reset(p);
  const r = new EngineRunner(e, 1000);
  const out = new Float64Array(e.stateSize);
  const samples: { t: number; s: Float64Array }[] = [];
  for (let i = 0; i < frames; i++) {
    const f = r.frame(1 / 60, 0.1);
    if ('code' in f) throw new Error(f.code);
    e.readState(out);
    samples.push({ t: e.time(), s: Float64Array.from(out) });
  }
  return { e, samples };
}

describe('standing wave engine', () => {
  it('state = closed form y₁, y₂, y at the probe at every step; phase = ωt', () => {
    const w = waveOf(standingInput(base));
    if (!w) throw new Error('no wave');
    const { samples } = run(base, 120);
    for (const { t, s } of samples) {
      expect(s[SW.phi]).toBeCloseTo(w.omega * t, 9);
      expect(s[SW.y1]).toBeCloseTo(0.01 * Math.cos(w.omega * t - w.k * 0.2), 12);
      expect(s[SW.y2]).toBeCloseTo(-0.01 * Math.cos(w.omega * t + w.k * 0.2), 12);
      expect((s[SW.y1] ?? 0) + (s[SW.y2] ?? 0)).toBeCloseTo(s[SW.y] ?? NaN, 12);
      expect(s[SW.y]).toBeCloseTo(standing(w, 0.2, t), 12);
    }
  });

  it('a probe at a node or at either clamped end never moves', () => {
    for (const xP of [0, 0.4, 0.8, 1.2]) {
      for (const { s } of run({ ...base, xP }, 90).samples)
        expect(Math.abs(s[SW.y] ?? NaN)).toBeLessThan(1e-12);
    }
  });

  it('Δt resolves each period (≤ T/200) and the run stops after 20 periods', () => {
    const e = new StandingWaveEngine();
    e.reset(base);
    expect(e.dt).toBeLessThanOrEqual(1 / 25 / 200);
    while (!e.finished()) e.step();
    expect(e.time()).toBeGreaterThanOrEqual(0.8);
    expect(e.time() - 0.8).toBeLessThan(e.dt);
  });

  it('v from tension and linear density gives the same f, λ and n as typing v', () => {
    // v = √(2 N / 0.005 kg/m) = 20 m/s.
    const typed = standingInput(base);
    const fromT = standingInput({ ...base, v: 99, vFrom: 1, tension: 2, muL: 0.005 });
    expect(fromT.v).toBeCloseTo(20, 12);
    expect(fromT.f).toBeCloseTo(typed.f, 12);
    expect(fromT.v / fromT.f).toBeCloseTo(typed.v / typed.f, 12);
    const h = standingInput({
      ...base,
      mode: MODE.harmonic,
      f: 25,
      vFrom: 1,
      tension: 2,
      muL: 0.005,
    });
    expect(h.n).toBe(3);
  });

  it('three modes: L, v, n → f; L, f, n → v; L, f, v → n', () => {
    expect(standingInput(base).f).toBeCloseTo(25, 12);
    expect(standingInput({ ...base, mode: MODE.speed, f: 25, v: 99 }).v).toBeCloseTo(20, 12);
    const h = standingInput({ ...base, mode: MODE.harmonic, f: 25, n: 7 });
    expect(h.n).toBe(3);
    expect(h.m).toBeCloseTo(3, 12);
  });

  it('a frequency with no whole number of half wavelengths is not rounded: no wave is drawn', () => {
    const q = standingInput({ ...base, mode: MODE.harmonic, f: 30 });
    expect(q.m).toBeCloseTo(3.6, 12);
    expect(q.n).toBeNull();
    expect(q.f).toBe(30);
    expect(waveOf(q)).toBeNull();
    for (const { s } of run({ ...base, mode: MODE.harmonic, f: 30 }, 10).samples)
      expect(s[SW.y]).toBe(0);
    // A typed n that is not whole is not rounded either.
    expect(standingInput({ ...base, n: 2.5 }).n).toBeNull();
    expect(standingInput({ ...base, n: 3 + 1e-12 }).n).toBe(3);
    // m ≈ 0 is whole within round-off, but there is no harmonic n = 0.
    expect(standingInput({ ...base, mode: MODE.harmonic, f: 1e-12 }).n).toBeNull();
  });
});

describe('DOPRI5 cross-check: wave equation on a lattice with both ends fixed', () => {
  const q = { L: 1.2, v: 20, n: 3, A: 0.01 };
  const omega = 2 * Math.PI * harmonicFrequency(3, 20, 1.2);
  const k = (3 * Math.PI) / 1.2;
  const T = (2 * Math.PI) / omega;
  const times = Array.from({ length: 16 }, (_, j) => ((j + 1) * T) / 8);

  /** Worst |y_lattice − 2A sin(kx) sin(ωt)| at the antinodes and nodes. */
  function errors(N: number) {
    const rows = latticeAt(q, N, times);
    let antinode = 0;
    let node = 0;
    rows.forEach((row, j) => {
      const t = times[j] ?? 0;
      for (const i of [N / 6, N / 2, (5 * N) / 6]) {
        const exact = 2 * q.A * Math.sin((k * (i * q.L)) / N) * Math.sin(omega * t);
        antinode = Math.max(antinode, Math.abs((row[i] ?? NaN) - exact));
      }
      for (const i of [0, N / 3, (2 * N) / 3, N]) node = Math.max(node, Math.abs(row[i] ?? NaN));
    });
    return { antinode, node };
  }

  it('matches 2A·sin(kx)·sin(ωt) within the O(Δx²) discretisation error, nodes at rest', () => {
    const N = 240;
    const dx = q.L / N;
    // ω_N = (2v/Δx)·sin(kΔx/2) = ω(1 − ε), ε ≈ (kΔx)²/24; the error grows as 2A·ε·(1 + ωt).
    const eps = 1 - (2 * q.v * Math.sin((k * dx) / 2)) / dx / omega;
    const { antinode, node } = errors(N);
    expect(antinode).toBeLessThan(1.1 * 2 * q.A * eps * (1 + omega * 2 * T));
    // At t = 2T the lattice lags by the phase ε·ω·t: the error is not smaller than predicted.
    expect(antinode).toBeGreaterThan(0.9 * 2 * q.A * eps * omega * 2 * T);
    expect(node).toBeLessThan(1e-12);
  });

  it('DOPRI5 reproduces the exact lattice mode 2A(ω/ω_N)·sin(kxᵢ)·sin(ω_N t)', () => {
    const N = 240;
    const dx = q.L / N;
    const omegaN = ((2 * q.v) / dx) * Math.sin((k * dx) / 2);
    let worst = 0;
    latticeAt(q, N, times).forEach((row, j) => {
      const t = times[j] ?? 0;
      for (let i = 0; i <= N; i++) {
        const exact = 2 * q.A * (omega / omegaN) * Math.sin(k * i * dx) * Math.sin(omegaN * t);
        worst = Math.max(worst, Math.abs((row[i] ?? NaN) - exact));
      }
    });
    expect(worst).toBeLessThan(1e-8 * 2 * q.A);
  });

  it('halving Δx cuts the error about four times (second-order convergence)', () => {
    const ratio = errors(480).antinode / errors(240).antinode;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.3);
  });

  it('a coarse lattice (12 cells) measures its own dispersion, 2,6 % off ω', () => {
    const dx = q.L / 12;
    const wN = latticeOmega(q.L, q.v, 3, 12);
    expect(Math.abs(wN / ((2 * q.v * Math.sin((k * dx) / 2)) / dx) - 1)).toBeLessThan(1e-8);
    expect(1 - wN / omega).toBeGreaterThan(0.02);
    expect(1 - wN / omega).toBeLessThan(0.03);
  });

  it('the check refuses a mode number that is not a whole n ≥ 1 (no endless search)', () => {
    for (const n of [0, -1, 2.5, Number.NaN]) expect(checkedFrequency(1.2, 20, n)).toBeNaN();
  });

  it('the cached check rescales the unit lattice exactly (units of L and L/v)', () => {
    for (const [L, v, n] of [
      [1.2, 20, 3],
      [0.65, 143, 1],
    ] as const)
      expect(Math.abs(checkedFrequency(L, v, n) / latticeFrequency(L, v, n) - 1)).toBeLessThan(
        1e-9,
      );
  });

  it('the lattice mode frequency, with its dispersion inverted, gives f_n = n·v/(2L)', () => {
    for (const [L, v, n] of [
      [1.2, 20, 3],
      [0.65, 143, 1],
      [2, 8, 7],
    ] as const) {
      expect(latticeFrequency(L, v, n)).toBeCloseTo(harmonicFrequency(n, v, L), 7);
      expect(Math.abs(latticeFrequency(L, v, n) / harmonicFrequency(n, v, L) - 1)).toBeLessThan(
        1e-9,
      );
    }
  });
});
