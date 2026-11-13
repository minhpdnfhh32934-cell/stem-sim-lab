import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { ellipticK, PENDULUM_OSCILLATIONS, pendulumModel } from './pendulum';

const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'pendulum'),
);

const DEG = Math.PI / 180;
interface Swing {
  length?: number;
  angle: number;
  gravity?: number;
  omega0?: number;
  mass?: number;
}

const start = ({ length = 1, angle, gravity = 9.81, omega0 = 0, mass = 0.5 }: Swing) => {
  const run = new ExperimentRuntime('test', definition, pendulumModel, {
    length,
    angle,
    gravity,
    omega0,
    mass,
  });
  run.start();
  return run;
};

/** Runs the experiment headless to the end. */
function swing(input: Swing) {
  const run = start(input);
  run.runToCompletion();
  expect(run.status).toBe('completed');
  expect(run.endReason).toBe('model');
  return run;
}

/** Steps a started run until its own clock passes `t` (1 ms frames). */
const advanceTo = (run: ExperimentRuntime, t: number) => {
  while (run.status === 'running' && run.value('clock') < t) run.advance(0.001);
};

const samples = (run: ExperimentRuntime, id: string) =>
  Array.from(
    run.sampleValues[definition.measurements.findIndex((m) => m.id === id)]?.subarray(
      0,
      run.sampleCount,
    ) ?? [],
  );

/** The small-angle period, written out independently of the model. */
const smallAngle = (length: number, g: number) => 2 * Math.PI * Math.sqrt(length / g);
// T/T₀ = (2/π)·K(sin(θ₀/2)) for a release from rest, from tables of the complete elliptic
// integral of the first kind (K(sin 15°) = 1.5981420021, K(sin 30°) = 1.6857503548).
const RATIO: Record<number, number> = { 30: 1.0174087976, 60: 1.0731820071 };

describe('pendulum theory', () => {
  it('computes the complete elliptic integral K(k) to tabulated precision', () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 15);
    expect(ellipticK(0.5)).toBeCloseTo(1.685750354812596, 13);
    expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(1.854074677301372, 13);
    expect(((2 / Math.PI) * ellipticK(Math.sin(15 * DEG))) / RATIO[30]!).toBeCloseTo(1, 9);
    expect(ellipticK(1)).toBe(Infinity);
  });

  it('predicts T₀ = 2π√(L/g), the exact period, the amplitude, speed and energy', () => {
    const p = pendulumModel.predict!({ length: 2, angle: 60, gravity: 9.81, mass: 0.5, omega0: 0 });
    expect(p.smallAnglePeriod).toBeCloseTo(smallAngle(2, 9.81), 12);
    expect(p.period! / smallAngle(2, 9.81)).toBeCloseTo(RATIO[60]!, 9);
    expect(p.amplitude).toBeCloseTo(60 * DEG, 12);
    // From energy: v = √(2gL(1 − cos θ₀)), E = m g L (1 − cos θ₀) (bob's lowest point as zero).
    expect(p.maxSpeed).toBeCloseTo(Math.sqrt(2 * 9.81 * 2 * (1 - Math.cos(60 * DEG))), 12);
    expect(p.energy).toBeCloseTo(0.5 * 9.81 * 2 * (1 - Math.cos(60 * DEG)), 12);
  });
});

describe('pendulum model against independent references', () => {
  it('small swings: the period is 2π√(L/g), with the θ₀²/16 correction', () => {
    const run = swing({ angle: 1 });
    const T0 = smallAngle(1, 9.81);
    const period = run.results?.period ?? NaN;
    expect(Math.abs(period / T0 - 1)).toBeLessThan(3e-5); // within the small-angle regime
    expect(period / (T0 * (1 + (1 * DEG) ** 2 / 16))).toBeCloseTo(1, 9); // series to θ₀²
  });

  it('large swings take longer than 2π√(L/g), as the exact theory says', () => {
    for (const angle of [30, 60]) {
      const run = swing({ angle });
      const T0 = smallAngle(1, 9.81);
      expect((run.results?.period ?? NaN) / T0, `${angle}°`).toBeCloseTo(RATIO[angle]!, 7);
    }
    const shorter = swing({ angle: 60, length: 0.5 });
    expect(shorter.results?.period).toBeCloseTo(smallAngle(0.5, 9.81) * RATIO[60]!, 7);
  });

  it('finds zero crossings and turning points where theory puts them', () => {
    const T = smallAngle(1, 9.81) * RATIO[30]!;
    const run = start({ angle: 30 });
    advanceTo(run, T / 4 + 0.005); // first crossing at T/4
    expect(run.value('crossings')).toBe(1);
    expect(run.value('firstCrossing')).toBeCloseTo(T / 4, 7);
    expect(run.value('turns')).toBe(0); // the release from rest is not a turning point
    advanceTo(run, T / 2 + 0.005); // first turning point at T/2, on the other side
    expect(run.value('turns')).toBe(1);
    expect(run.value('lastTurn')).toBeCloseTo(T / 2, 7);
    // 5 ms after turning it has swung back ½·|α|·t² ≈ 6·10⁻⁵ rad from −θ₀.
    expect(run.value('theta')).toBeCloseTo(-30 * DEG, 3);
    advanceTo(run, (3 * T) / 4 + 0.005);
    expect(run.value('crossings')).toBe(2);
    expect(run.value('lastCrossing')).toBeCloseTo((3 * T) / 4, 7);
    expect(run.value('period')).toBeCloseTo(T, 7); // two crossings: one half period apart
  });

  it(`ends at the turning point that completes ${PENDULUM_OSCILLATIONS} oscillations`, () => {
    const T = smallAngle(1, 9.81) * RATIO[30]!;
    const run = swing({ angle: 30 });
    expect(run.value('turns')).toBe(2 * PENDULUM_OSCILLATIONS);
    expect(run.value('crossings')).toBe(2 * PENDULUM_OSCILLATIONS);
    expect(run.time).toBeCloseTo(PENDULUM_OSCILLATIONS * T, 6);
    expect(run.value('theta')).toBeCloseTo(30 * DEG, 7); // back where it was released
    expect(Math.abs(run.value('omega'))).toBeLessThan(1e-6); // momentarily at rest
    expect(run.results?.period).toBeCloseTo(T, 7);
    expect(run.results?.amplitude).toBeCloseTo(30 * DEG, 6);
  });

  it('mirrors a negative release angle exactly', () => {
    const right = swing({ angle: 40 });
    const left = swing({ angle: -40 });
    for (const id of ['theta', 'omega', 'alpha', 'x']) {
      const mirrored = samples(right, id);
      // Exactly opposite at every sample (sums to 0; compared this way +0 and −0 agree).
      samples(left, id).forEach((v, i) => expect(v + (mirrored[i] ?? NaN), id).toBe(0));
    }
    expect(left.results?.period).toBe(right.results?.period);
    expect(left.results?.amplitude).toBeCloseTo(40 * DEG, 6); // max θ is reached on the far side
  });

  it('accelerates back towards the vertical: α = −(g/L)·sin θ', () => {
    const run = swing({ angle: 50, length: 1.5, gravity: 3.71 });
    const theta = samples(run, 'theta');
    const alpha = samples(run, 'alpha');
    expect(theta.length).toBeGreaterThan(100);
    theta.forEach((t, i) => {
      expect(alpha[i]).toBeCloseTo(-(3.71 / 1.5) * Math.sin(t), 12);
      expect((alpha[i] ?? 0) * t).toBeLessThanOrEqual(0);
    });
    expect(alpha[0]).toBeCloseTo(-(3.71 / 1.5) * Math.sin(50 * DEG), 12);
  });

  it('conserves mechanical energy to RK4 precision', () => {
    const run = swing({ angle: 60, mass: 0.5 });
    const E0 = 0.5 * 9.81 * 1 * (1 - Math.cos(60 * DEG)); // m g L (1 − cos θ₀)
    for (const e of samples(run, 'energy')) expect(Math.abs(e - E0) / E0).toBeLessThan(1e-9);
    const kinetic = samples(run, 'kinetic');
    const potential = samples(run, 'potential');
    expect(Math.max(...kinetic)).toBeCloseTo(E0, 5); // all kinetic at the bottom
    expect(Math.max(...potential)).toBeCloseTo(E0, 6); // all potential at a turning point
    expect(run.results?.['max-speed']).toBeCloseTo(
      Math.sqrt(2 * 9.81 * (1 - Math.cos(60 * DEG))),
      5,
    );
  });

  it('follows gravity and length: T ∝ √(L/g)', () => {
    const earth = swing({ angle: 20 }).results?.period ?? NaN;
    const moon = swing({ angle: 20, gravity: 1.62 }).results?.period ?? NaN;
    const quarter = swing({ angle: 20, length: 0.25 }).results?.period ?? NaN;
    expect(moon / earth).toBeCloseTo(Math.sqrt(9.81 / 1.62), 9);
    expect(quarter / earth).toBeCloseTo(0.5, 9);
  });

  it('takes the amplitude from energy when released with an angular velocity', () => {
    const run = swing({ angle: 0, omega0: 1.5 });
    // ½ (Lω₀)² = g L (1 − cos θmax)
    const amplitude = Math.acos(1 - (1.5 * 1.5 * 1) / (2 * 9.81));
    expect(run.results?.amplitude).toBeCloseTo(amplitude, 6);
    expect(run.theory()?.amplitude).toBeCloseTo(amplitude, 12);
    expect(run.results?.period).toBeCloseTo(run.theory()?.period ?? NaN, 7);
  });

  it('predicts what it measures; only the small-angle row differs, by the nonlinearity', () => {
    const run = swing({ angle: 60, length: 2 });
    const theory = run.theory()!;
    expect(run.results?.period).toBeCloseTo(theory.period!, 7);
    expect(run.results?.amplitude).toBeCloseTo(theory.amplitude!, 6);
    expect(run.results?.['max-speed']).toBeCloseTo(theory.maxSpeed!, 5);
    expect(run.results?.energy).toBeCloseTo(theory.energy!, 9);
    const difference = (run.results?.['period-small-angle'] ?? NaN) / theory.smallAnglePeriod! - 1;
    expect(difference).toBeCloseTo(RATIO[60]! - 1, 7); // 7.3 %, not an error: T₀ is approximate
  });

  it('is deterministic: the same inputs give bit-identical samples and results', () => {
    const a = swing({ angle: 35, length: 0.75, gravity: 1.62 });
    const b = swing({ angle: 35, length: 0.75, gravity: 1.62 });
    for (const m of definition.measurements) expect(samples(a, m.id)).toEqual(samples(b, m.id));
    expect(a.results).toEqual(b.results);
    expect(Array.from(a.sampleTimes.subarray(0, a.sampleCount))).toEqual(
      Array.from(b.sampleTimes.subarray(0, b.sampleCount)),
    );
  });

  it('gives the same run however real time is cut into frames', () => {
    const instant = swing({ angle: 25 });
    const framed = start({ angle: 25 });
    const frames = [1 / 60, 1 / 30, 0.0043, 1 / 300, 0.1, 1 / 144];
    for (let i = 0; framed.status === 'running' && i < 100_000; i++) {
      framed.advance(frames[i % frames.length] ?? 1 / 60);
    }
    expect(framed.results).toEqual(instant.results);
    expect(samples(framed, 'theta')).toEqual(samples(instant, 'theta'));
  });

  it('stays stable and accurate across the supported range', () => {
    for (const input of [
      { length: 0.25, angle: 60, gravity: 24.79 }, // fastest: ω₀ = √(g/L) ≈ 10 rad/s
      { length: 3, angle: 60, gravity: 1.62 }, // slowest: 3 periods ≈ 27.5 s of 40 s allowed
      { length: 3, angle: -5, gravity: 1.62 },
      { length: 0.25, angle: 5, gravity: 1.62 },
    ]) {
      const run = swing(input);
      const theory = run.theory()!;
      const energy = samples(run, 'energy');
      const E0 = energy[0] ?? NaN;
      for (const e of energy) expect(Math.abs(e - E0) / E0).toBeLessThan(1e-8);
      expect((run.results?.period ?? NaN) / theory.period!).toBeCloseTo(1, 6);
      expect(run.time).toBeLessThan(definition.simulation.maxDuration);
    }
  });
});
