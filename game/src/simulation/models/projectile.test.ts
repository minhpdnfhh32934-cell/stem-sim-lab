import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { projectileModel } from './projectile';

const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'projectile-motion'),
);

interface Shot {
  velocity: number;
  angle: number;
  gravity?: number;
  height?: number;
}

/** Runs the experiment headless to the end. */
function fly({ velocity, angle, gravity = 9.81, height = 0 }: Shot) {
  const run = new ExperimentRuntime('test', definition, projectileModel, {
    velocity,
    angle,
    gravity,
    height,
  });
  run.runToCompletion();
  expect(run.status).toBe('completed');
  expect(run.endReason).toBe('model');
  return run;
}

const DEG = Math.PI / 180;
/** Textbook same-height formulas (launch and landing at the same height). */
const textbook = (v: number, angleDeg: number, g: number) => ({
  T: (2 * v * Math.sin(angleDeg * DEG)) / g,
  R: (v * v * Math.sin(2 * angleDeg * DEG)) / g,
  H: (v * v * Math.sin(angleDeg * DEG) ** 2) / (2 * g),
});
/** Maximum height error of a stepped state: the apex can fall between steps. */
const apexTolerance = (g: number) => (g * definition.simulation.timeStep ** 2) / 8 + 1e-12;

describe('projectile model against the analytical solution', () => {
  it('45°, 12 m/s, Earth gravity, same height: T 1.73 s, R 14.68 m, H 3.67 m', () => {
    const run = fly({ velocity: 12, angle: 45 });
    const { T, R, H } = textbook(12, 45, 9.81);
    expect(T).toBeCloseTo(1.73, 2);
    expect(R).toBeCloseTo(14.68, 2);
    expect(H).toBeCloseTo(3.67, 2);
    expect(run.results?.['flight-time']).toBeCloseTo(T, 9);
    expect(run.results?.range).toBeCloseTo(R, 9);
    expect(H - (run.results?.['max-height'] ?? NaN)).toBeGreaterThanOrEqual(0);
    expect(H - (run.results?.['max-height'] ?? NaN)).toBeLessThan(apexTolerance(9.81));
    expect(run.results?.['impact-speed']).toBeCloseTo(12, 9); // same height: same speed
  });

  it('0°: a horizontal launch from a height falls for √(2h/g)', () => {
    const run = fly({ velocity: 5, angle: 0, height: 1.2 });
    const T = Math.sqrt((2 * 1.2) / 9.81);
    expect(run.results?.['flight-time']).toBeCloseTo(T, 9);
    expect(run.results?.range).toBeCloseTo(5 * T, 9);
    expect(run.results?.['max-height']).toBe(1.2); // never above the launch point
    expect(run.results?.['impact-speed']).toBeCloseTo(Math.sqrt(25 + 2 * 9.81 * 1.2), 9);
  });

  it('0° from the floor lands at once: no flight, no failure', () => {
    const run = fly({ velocity: 5, angle: 0 });
    expect(run.results).toEqual({
      'flight-time': 0,
      range: 0,
      'max-height': 0,
      'impact-speed': 5,
    });
  });

  it('90°: straight up and down — T = 2v/g, no range, H = v²/2g', () => {
    const run = fly({ velocity: 6, angle: 90 });
    expect(run.results?.['flight-time']).toBeCloseTo((2 * 6) / 9.81, 9);
    expect(Math.abs(run.results?.range ?? NaN)).toBeLessThan(1e-12);
    expect(36 / (2 * 9.81) - (run.results?.['max-height'] ?? NaN)).toBeLessThan(
      apexTolerance(9.81),
    );
  });

  it('follows the gravity parameter: the Moon gives 9.81/1.62 times the range and time', () => {
    const earth = fly({ velocity: 4, angle: 30 });
    const moon = fly({ velocity: 4, angle: 30, gravity: 1.62 });
    const ratio = 9.81 / 1.62;
    expect(moon.results?.range).toBeCloseTo((earth.results?.range ?? NaN) * ratio, 8);
    expect(moon.results?.['flight-time']).toBeCloseTo(
      (earth.results?.['flight-time'] ?? NaN) * ratio,
      8,
    );
  });

  it('follows the velocity parameter: the same-height range grows with v²', () => {
    for (const v of [1, 3, 7.5, 15]) {
      const run = fly({ velocity: v, angle: 40 });
      expect(run.results?.range).toBeCloseTo(textbook(v, 40, 9.81).R, 9);
    }
    const slow = fly({ velocity: 5, angle: 40 });
    const fast = fly({ velocity: 10, angle: 40 });
    expect(fast.results?.range).toBeCloseTo(4 * (slow.results?.range ?? NaN), 8);
  });

  it('gives complementary angles the same same-height range, and 45° the largest', () => {
    const r = (angle: number) => fly({ velocity: 9, angle }).results?.range ?? NaN;
    expect(r(30)).toBeCloseTo(r(60), 9);
    expect(r(20)).toBeCloseTo(r(70), 9);
    expect(r(45)).toBeGreaterThan(r(40));
    expect(r(45)).toBeGreaterThan(r(50));
  });

  it('from a launch height, matches the general closed form', () => {
    const v = 8;
    const theta = 35 * DEG;
    const h = 0.5;
    const g = 9.81;
    const vy = v * Math.sin(theta);
    const T = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
    const run = fly({ velocity: v, angle: 35, height: h });
    expect(run.results?.['flight-time']).toBeCloseTo(T, 9);
    expect(run.results?.range).toBeCloseTo(v * Math.cos(theta) * T, 9);
    expect(run.results?.['impact-speed']).toBeCloseTo(Math.sqrt(v * v + 2 * g * h), 9);
    const theory = projectileModel.predict?.({ velocity: v, angle: 35, gravity: g, height: h });
    expect(theory?.flightTime).toBeCloseTo(T, 12);
    expect(theory?.maxHeight).toBeCloseTo(h + (vy * vy) / (2 * g), 12);
  });

  it('predicts what it measures: theory and run agree for every result', () => {
    const inputs = { velocity: 11, angle: 52, gravity: 3.71, height: 0.48 };
    const run = fly(inputs);
    const theory = run.theory();
    expect(theory).not.toBeNull();
    expect(run.results?.['flight-time']).toBeCloseTo(theory?.flightTime ?? NaN, 9);
    expect(run.results?.range).toBeCloseTo(theory?.range ?? NaN, 9);
    expect(run.results?.['impact-speed']).toBeCloseTo(theory?.impactSpeed ?? NaN, 9);
    expect((theory?.maxHeight ?? NaN) - (run.results?.['max-height'] ?? NaN)).toBeLessThan(
      apexTolerance(3.71),
    );
  });
});

describe('projectile measurements', () => {
  it('samples t, x, y, vx, vy and speed consistently from launch to landing', () => {
    const run = fly({ velocity: 10, angle: 60, height: 0.5 });
    const n = run.sampleCount;
    const series = (id: string) =>
      run.sampleValues[definition.measurements.findIndex((m) => m.id === id)];
    const [x, y, vx, vy, speed] = ['x', 'y', 'vx', 'vy', 'speed'].map(series);
    const v0x = 10 * Math.cos(60 * DEG);
    const v0y = 10 * Math.sin(60 * DEG);
    expect(run.sampleTimes[0]).toBe(0);
    expect(y?.[0]).toBe(0.5);
    expect(x?.[0]).toBe(0);
    for (let i = 0; i < n; i++) {
      const t = run.sampleTimes[i] ?? NaN;
      expect(vx?.[i]).toBeCloseTo(v0x, 12); // no horizontal force
      expect(vy?.[i]).toBeCloseTo(v0y - 9.81 * t, 9);
      expect(x?.[i]).toBeCloseTo(v0x * t, 9);
      expect(y?.[i]).toBeCloseTo(0.5 + v0y * t - 0.5 * 9.81 * t * t, 9);
      expect(speed?.[i]).toBeCloseTo(Math.hypot(vx?.[i] ?? NaN, vy?.[i] ?? NaN), 12);
    }
    expect(run.sampleTimes[1]).toBeCloseTo(0.01, 12);
    expect(y?.[n - 1]).toBe(0); // the last sample is the landing
    expect(run.sampleTimes[n - 1]).toBeCloseTo(run.results?.['flight-time'] ?? NaN, 12);
  });

  it('is deterministic: the same inputs give bit-identical samples and results', () => {
    const a = fly({ velocity: 13.5, angle: 38, gravity: 9.81, height: 0.48 });
    const b = fly({ velocity: 13.5, angle: 38, gravity: 9.81, height: 0.48 });
    expect(b.sampleCount).toBe(a.sampleCount);
    expect(Array.from(b.sampleTimes)).toEqual(Array.from(a.sampleTimes));
    b.sampleValues.forEach((s, i) =>
      expect(Array.from(s)).toEqual(Array.from(a.sampleValues[i] ?? [])),
    );
    expect(b.results).toEqual(a.results);
  });

  it('gives the same run however real time is cut into frames', () => {
    const inputs = { velocity: 9, angle: 50, gravity: 9.81, height: 0.48 };
    const instant = fly(inputs);
    const framed = new ExperimentRuntime('f', definition, projectileModel, inputs);
    framed.start();
    const frames = [1 / 60, 1 / 30, 0.0043, 1 / 144, 0.05];
    for (let i = 0; framed.status === 'running' && i < 10_000; i++) {
      framed.advance(frames[i % frames.length] ?? 1 / 60);
    }
    expect(framed.results).toEqual(instant.results);
    expect(framed.sampleCount).toBe(instant.sampleCount);
  });
});
