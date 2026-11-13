import { describe, expect, it } from 'vitest';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { SURFACES, inclineModel } from './incline';

const G = 9.81;
const WOOD = 3; // μs 0.35, μk 0.2
const STEEL = 4; // μs 0.74, μk 0.57
const index = (name: string) => inclineModel.variables.indexOf(name);
const [S, V, A] = ['distance', 'speed', 'acceleration'].map(index) as [number, number, number];

const inputs = (angle: number, surface = WOOD, mass = 0.5, length = 1) => ({
  angle,
  surface,
  mass,
  length,
  gravity: G,
});

/** A minimal definition, so runs go through the runtime as a station makes them. */
const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse({
  id: 'incline-test',
  name: 'Incline test',
  category: 'physics',
  model: 'mechanics.incline',
  parameters: [
    { id: 'angle', label: 'θ', unit: '°', default: 30, min: 0, max: 60 },
    { id: 'surface', label: 'surface', unit: '', default: WOOD, min: 1, max: 4 },
    { id: 'mass', label: 'm', unit: 'kg', default: 0.5, min: 0.1, max: 2 },
    { id: 'length', label: 'L', unit: 'm', default: 1, min: 0.3, max: 1.5 },
  ],
  initialConditions: { gravity: G },
  simulation: { timeStep: 0.001, maxDuration: 60, sampleInterval: 0.01 },
  measurements: [{ id: 'distance', label: 's', unit: 'm', variable: 'distance' }],
  results: [
    'distance',
    'speed',
    'acceleration',
    'kineticEnergy',
    'frictionWork',
    'netForceRatio',
    'staticFriction',
    'kineticFriction',
  ].map((id) => ({
    id,
    label: id,
    unit: '',
    variable: id,
    reduce: 'final',
    theory: id === 'speed' ? 'finalSpeed' : id,
  })),
});

const run = (overrides: Record<string, number>) => {
  const r = new ExperimentRuntime('test', definition, inclineModel, overrides);
  r.runToCompletion();
  return r;
};

/** The model alone, let go and stepped by `dt` until it stops; `each` sees the state and time. */
function release(
  input: Record<string, number>,
  dt = 0.001,
  each?: (s: Float64Array, t: number) => void,
) {
  const state = new Float64Array(inclineModel.variables.length);
  inclineModel.init(input, state);
  let t = 0;
  for (let i = 0; i < 1e6 && !inclineModel.isComplete!(state, input); i++) {
    t += inclineModel.step(state, dt, input);
    each?.(state, t);
  }
  return { state, t };
}

describe('incline theory', () => {
  it('has, for every surface, kinetic friction no larger than static friction', () => {
    for (const s of SURFACES) expect(s.kineticFriction).toBeLessThanOrEqual(s.staticFriction);
  });

  it('wood at 30°: a = g(sin30° − μk·cos30°) = g(1/2 − 0.2·√3/2), and the energy balance', () => {
    const t = inclineModel.predict!(inputs(30));
    const a = G * (0.5 - (0.2 * Math.sqrt(3)) / 2); // 3.2058581… m/s²
    expect(t.slides).toBe(1); // tan30° = 0.577 > 0.35
    expect(t.acceleration).toBeCloseTo(a, 12);
    expect(t.travelTime).toBeCloseTo(Math.sqrt(2 / a), 12); // L = ½a·t²
    expect(t.finalSpeed).toBeCloseTo(Math.sqrt(2 * a), 12); // v² = 2aL
    expect(t.normalForce).toBeCloseTo((0.5 * G * Math.sqrt(3)) / 2, 12);
    expect(t.potentialEnergyLost).toBeCloseTo(0.5 * G * 0.5, 12); // m·g·h, h = L·sin30° = 0.5 m
    expect(t.frictionWork).toBeCloseTo((0.2 * 0.5 * G * Math.sqrt(3)) / 2, 12); // μk·N·L
    // Work–energy theorem: what the weight gives = kinetic energy + heat.
    expect(t.kineticEnergy! + t.frictionWork!).toBeCloseTo(t.potentialEnergyLost!, 12);
    expect(t.kineticEnergy).toBeCloseTo(0.5 * 0.5 * t.finalSpeed! ** 2, 12);
    expect(t.netForceRatio! * G).toBeCloseTo(a, 12);
    // Net force = weight's pull − kinetic friction; kinetic friction = μk·m·g·cos30°.
    expect(t.kineticFrictionForce).toBeCloseTo((0.2 * 0.5 * G * Math.sqrt(3)) / 2, 12);
    expect(t.netForce).toBeCloseTo(0.5 * G * 0.5 - (0.2 * 0.5 * G * Math.sqrt(3)) / 2, 12);
    expect(t.speedSquaredSlope).toBeCloseTo(2 * a, 12);
  });

  it('steel at 45°: a = g·(√2/2)(1 − μk)', () => {
    const t = inclineModel.predict!(inputs(45, STEEL));
    expect(t.slides).toBe(1); // tan45° = 1 > 0.74
    expect(t.acceleration).toBeCloseTo(G * Math.SQRT1_2 * (1 - 0.57), 12);
  });

  it('slides exactly above arctan μs: the whole degrees either side of each critical angle', () => {
    // tan2° = 0.035 < 0.04 < tan3° = 0.052; tan8° = 0.141 < 0.15 < tan9° = 0.158;
    // tan19° = 0.344 < 0.35 < tan20° = 0.364; tan36° = 0.727 < 0.74 < tan37° = 0.754.
    for (const [surface, held, slid] of [
      [1, 2, 3],
      [2, 8, 9],
      [3, 19, 20],
      [4, 36, 37],
    ] as const) {
      const below = inclineModel.predict!(inputs(held, surface));
      expect(below.slides).toBe(0);
      expect(below.criticalAngle).toBeGreaterThan(held);
      expect(below.criticalAngle).toBeLessThan(slid);
      expect(inclineModel.predict!(inputs(slid, surface)).slides).toBe(1);
    }
    expect(inclineModel.predict!(inputs(0, 1)).slides).toBe(0); // flat: nothing pulls it
  });

  it('held: static friction m·g·sinθ, no more than μs·N; nothing moves, no heat, no travel time', () => {
    const t = inclineModel.predict!(inputs(15)); // wood: tan15° = 0.268 ≤ 0.35
    expect(t.frictionForce).toBeCloseTo(0.5 * G * Math.sin((15 * Math.PI) / 180), 12);
    expect(t.frictionForce).toBeLessThanOrEqual(t.staticFrictionLimit!);
    expect([t.acceleration, t.finalSpeed, t.frictionWork, t.distance]).toEqual([0, 0, 0, 0]);
    expect(t.travelTime).toBeUndefined();
    expect(t.kineticFrictionForce).toBeUndefined(); // static friction acts, not kinetic
    expect(t.netForce).toBe(0);
    expect(t.mechanicalEnergy).toBeCloseTo(t.startEnergy!, 12); // still all potential, at the top
  });

  it('does not depend on the mass for the motion; the energies scale with it', () => {
    const light = inclineModel.predict!(inputs(40, WOOD, 0.1));
    const heavy = inclineModel.predict!(inputs(40, WOOD, 2));
    for (const k of ['acceleration', 'travelTime', 'finalSpeed'] as const) {
      expect(heavy[k]).toBeCloseTo(light[k]!, 12);
    }
    expect(heavy.kineticEnergy! / light.kineticEnergy!).toBeCloseTo(20, 10);
    expect(heavy.frictionWork! / light.frictionWork!).toBeCloseTo(20, 10);
  });

  it('refuses inputs it cannot run, with the reason, never clamping them', () => {
    expect(() => inclineModel.predict!(inputs(30, 2.5))).toThrow(/surface/);
    expect(() => inclineModel.predict!(inputs(30, 5))).toThrow(/surface/);
    expect(() => inclineModel.predict!(inputs(91))).toThrow(/angle/);
    expect(() => inclineModel.predict!(inputs(30, WOOD, 0))).toThrow(/mass/);
    expect(() => inclineModel.predict!(inputs(30, WOOD, 1, NaN))).toThrow(/length/);
    expect(() => inclineModel.init({ angle: 30 }, new Float64Array(13))).toThrow(/missing/);
  });
});

describe('incline run', () => {
  it('follows s = ½a·t², v = a·t at every step and stops exactly at the foot at √(2L/a)', () => {
    for (const dt of [0.001, 0.0137, 0.25]) {
      const input = inputs(30);
      const a = G * (0.5 - (0.2 * Math.sqrt(3)) / 2);
      const { state, t } = release(input, dt, (st, time) => {
        expect(st[S]).toBeCloseTo(0.5 * a * time * time, 12);
        expect(st[V]).toBeCloseTo(a * time, 12);
        expect(st[A]).toBe(inclineModel.predict!(input).acceleration);
      });
      expect(state[S]).toBe(1);
      expect(t).toBeCloseTo(Math.sqrt(2 / a), 12);
      expect(state[V]).toBeCloseTo(Math.sqrt(2 * a), 12);
    }
  });

  it('keeps mechanical energy + heat = m·g·L·sinθ, and kinetic = lost potential − heat, each step', () => {
    const input = inputs(50, STEEL, 1.5, 1.2);
    const start = 1.5 * G * 1.2 * Math.sin((50 * Math.PI) / 180);
    const at = (st: Float64Array, name: string) => st[index(name)]!;
    release(input, 0.001, (st) => {
      expect(at(st, 'mechanicalEnergy') + at(st, 'frictionWork')).toBeCloseTo(start, 10);
      expect(at(st, 'kineticEnergy')).toBeCloseTo(
        at(st, 'potentialEnergyLost') - at(st, 'frictionWork'),
        10,
      );
      expect(at(st, 'height')).toBeCloseTo((1.2 - st[S]!) * Math.sin((50 * Math.PI) / 180), 12);
    });
  });

  it('agrees with the work–energy theorem at the foot: v² = 2g(h − μk·cosθ·L)', () => {
    const r = run({ angle: 25, surface: WOOD, length: 1.5 });
    const h = 1.5 * Math.sin((25 * Math.PI) / 180);
    const v2 = 2 * G * (h - 0.2 * Math.cos((25 * Math.PI) / 180) * 1.5);
    expect(r.endReason).toBe('model');
    expect(r.results!.speed! ** 2).toBeCloseTo(v2, 10);
    expect(r.results!.distance).toBe(1.5);
  });

  it('held by static friction: the run ends at once, at t = 0, where it started', () => {
    const r = run({ angle: 10, surface: WOOD });
    expect(r.status).toBe('completed');
    expect(r.endReason).toBe('model');
    expect(r.time).toBe(0);
    expect(r.results).toMatchObject({ distance: 0, speed: 0, acceleration: 0, frictionWork: 0 });
    expect(r.results!.netForceRatio).toBe(0);
  });

  it('is deterministic: the same inputs give the same samples, bit for bit', () => {
    const one = run({ angle: 33, surface: 2, mass: 1.3, length: 0.7 });
    const two = run({ angle: 33, surface: 2, mass: 1.3, length: 0.7 });
    expect(Array.from(two.sampleValues[0]!.subarray(0, two.sampleCount))).toEqual(
      Array.from(one.sampleValues[0]!.subarray(0, one.sampleCount)),
    );
    expect(two.time).toBe(one.time);
  });

  it('ends by itself within 60 s, finite, for every whole degree, surface and the ramp lengths', () => {
    for (let angle = 0; angle <= 60; angle++) {
      for (let surface = 1; surface <= SURFACES.length; surface++) {
        for (const length of [0.3, 1.5]) {
          const r = run({ angle, surface, length, mass: 2 });
          expect(r.endReason).toBe('model');
          const theory = r.theory()!;
          expect(Object.values(theory).every(Number.isFinite)).toBe(true);
          expect(r.results!.distance).toBe(theory.distance);
        }
      }
    }
  });

  it('reports the chosen surface pair’s coefficients (Serway & Jewett Table 5.1)', () => {
    for (const [surface, muS, muK] of [
      [1, 0.04, 0.04],
      [2, 0.15, 0.06],
      [3, 0.35, 0.2],
      [4, 0.74, 0.57],
    ] as const) {
      const r = run({ angle: 30, surface });
      expect([r.results!.staticFriction, r.results!.kineticFriction]).toEqual([muS, muK]);
    }
  });

  /** Fits the runs' final `y` against the length L, at one angle, surface and mass. */
  const fitAgainstLength = (angle: number, surface: number, y: string, mass = 0.8) =>
    fitLine(
      [0.3, 0.6, 0.9, 1.2, 1.5].map((length) => {
        const r = run({ angle, surface, mass, length });
        return { x: length, y: r.results![y]! };
      }),
    );

  it('kinetic energy at the foot against L is a line through 0 of slope F_net = m·g(sinθ − μk·cosθ)', () => {
    const rad = (40 * Math.PI) / 180;
    const fit = fitAgainstLength(40, WOOD, 'kineticEnergy'); // work–energy theorem: Eₖ = F_net·L
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(0.8 * G * (Math.sin(rad) - 0.2 * Math.cos(rad)), 9);
    expect(fit.intercept).toBeCloseTo(0, 9);
    const held = fitAgainstLength(10, WOOD, 'kineticEnergy'); // tan10° < 0.35: nothing moves
    expect(held.status === 'fitted' && held.slope).toBe(0);
  });

  it('heat against the distance slid (L, at the foot) is a line of slope μk·m·g·cosθ', () => {
    const rad = (45 * Math.PI) / 180;
    const fit = fitAgainstLength(45, STEEL, 'frictionWork');
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(0.57 * 0.8 * G * Math.cos(rad), 9);
    expect(fit.intercept).toBeCloseTo(0, 9);
  });
});
