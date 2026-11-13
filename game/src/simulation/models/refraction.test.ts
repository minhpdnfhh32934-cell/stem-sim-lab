import { describe, expect, it } from 'vitest';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { fresnelReflectance, refractionModel } from './refraction';

const DEG = Math.PI / 180;
const ENTER = 0;
const LEAVE = 1;
const slot = (id: string) => refractionModel.variables.indexOf(id);

/** A minimal definition on the model's own variables: the shipped one is still a draft. */
const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse({
  id: 'refraction-test',
  name: 'Refraction (test)',
  category: 'physics',
  model: 'optics.refraction',
  parameters: [
    { id: 'index', label: 'n', unit: '', default: 1.5, min: 1.3, max: 1.7 },
    { id: 'direction', label: 'direction', unit: '', default: 0, min: 0, max: 1 },
    { id: 'angle', label: 'i', unit: '°', default: 30, min: 0, max: 85 },
  ],
  initialConditions: { sweepRate: 10 },
  simulation: { timeStep: 0.01, maxDuration: 12, sampleInterval: 0.05 },
  measurements: ['incidenceDeg', 'refractionDeg', 'reflectance', 'tir'].map((v) => ({
    id: v,
    label: v,
    unit: '',
    variable: v,
  })),
  results: [
    ['incidenceDeg', 'final'],
    ['reflectionDeg', 'final'],
    ['lastIncidenceDeg', 'final'],
    ['refractionDeg', 'final'],
    ['sinBlock', 'final'],
    ['sinAir', 'final'],
    ['tir', 'final'],
    ['reflectance', 'final'],
    ['refractionMax', 'max', 'refractionDeg'],
  ].map(([id, reduce, variable]) => ({
    id,
    label: id,
    unit: '',
    variable: variable ?? id,
    reduce,
    ...(variable === undefined ? { theory: id } : {}),
  })),
});

const run = (index: number, direction: number, angle: number, timeStep = 0.01) => {
  const r = new ExperimentRuntime(
    'test',
    { ...definition, simulation: { ...definition.simulation, timeStep } },
    refractionModel,
    { index, direction, angle },
  );
  r.runToCompletion();
  return r;
};

/** Snell's law written out on its own: n₁ sin i = n₂ sin r, in degrees. */
const snell = (n1: number, n2: number, iDeg: number) =>
  Math.asin((n1 * Math.sin(iDeg * DEG)) / n2) / DEG;

/** The Fresnel reflectance in its sine/tangent form (Hecht §4.6), independent of the cosines. */
const fresnelSinTan = (i: number, t: number) =>
  i === 0
    ? NaN
    : ((Math.sin(i - t) / Math.sin(i + t)) ** 2 + (Math.tan(i - t) / Math.tan(i + t)) ** 2) / 2;

const inputs = (index: number, direction: number, angle: number) => ({
  index,
  direction,
  angle,
  sweepRate: 10,
});

describe('refraction theory', () => {
  it('bends a ray entering glass n = 1.5 at 30° to 19.47° and reflects it at 30°', () => {
    const theory = refractionModel.predict!(inputs(1.5, ENTER, 30));
    expect(theory.refractionDeg).toBeCloseTo(19.4712206, 6); // asin(sin 30° / 1.5) = asin(1/3)
    expect(theory.refraction).toBeCloseTo(Math.asin(1 / 3), 12);
    expect(theory.reflectionDeg).toBeCloseTo(30, 12);
    expect(theory.tir).toBe(0);
    expect(theory.criticalAngleDeg).toBeUndefined(); // entering a denser block: none
  });

  it('gives the tabulated critical angles of water, acrylic and crown glass leaving into air', () => {
    for (const [n, critical] of [
      [1.33, 48.7535],
      [1.49, 42.1552],
      [1.52, 41.1395],
    ] as const) {
      const theory = refractionModel.predict!(inputs(n, LEAVE, 30));
      expect(theory.criticalAngleDeg).toBeCloseTo(critical, 3);
      expect(Math.sin(theory.criticalAngle!)).toBeCloseTo(1 / n, 12); // sin C = 1/n
    }
  });

  it('beyond the critical angle: total internal reflection, R = 1, last refracted ray grazing', () => {
    const theory = refractionModel.predict!(inputs(1.5, LEAVE, 60));
    expect(theory.tir).toBe(1);
    expect(theory.reflectance).toBe(1);
    expect(theory.lastIncidenceDeg).toBeCloseTo(Math.asin(1 / 1.5) / DEG, 12);
    expect(theory.refractionDeg).toBeCloseTo(90, 6);
    expect(theory.sinAir).toBeCloseTo(1, 12);
    expect(theory.sinBlock).toBeCloseTo(1 / 1.5, 12);
    // Just below it, the ray still leaves.
    expect(refractionModel.predict!(inputs(1.5, LEAVE, 41.8)).tir).toBe(0);
  });

  it('the grazing ray at C is at exactly 90° for every n on the dial, n = 1.44 included', () => {
    // n·sin(asin(1/n)) rounds below 1 for n = 1.44, 1.46, 1.58, 1.64, 1.68: sin r = 1 must not.
    for (let k = 130; k <= 170; k++) {
      const n = k / 100;
      const theory = refractionModel.predict!(inputs(n, LEAVE, 60));
      expect(theory.refractionDeg).toBe(90);
      expect(theory.sinAir).toBe(1);
    }
    const r = run(1.44, LEAVE, 60);
    expect(r.results!.refractionDeg).toBe(90);
    expect(r.results!.sinAir).toBe(1);
    expect(r.results!.lastIncidenceDeg).toBeCloseTo(Math.asin(1 / 1.44) / DEG, 10);
  });

  it('is reversible: a ray leaving at r comes out at the angle it would enter at', () => {
    for (const n of [1.33, 1.49, 1.52]) {
      for (const i of [10, 30, 60, 85]) {
        const enter = refractionModel.predict!(inputs(n, ENTER, i));
        const back = refractionModel.predict!(inputs(n, LEAVE, enter.refractionDeg!));
        expect(back.refractionDeg).toBeCloseTo(i, 9);
        // Stokes reciprocity: the same reflectance both ways along one ray.
        expect(back.reflectance).toBeCloseTo(enter.reflectance!, 12);
        // sin(air angle) = n·sin(block angle) whichever way the light goes.
        expect(enter.sinAir! / enter.sinBlock!).toBeCloseTo(n, 12);
        expect(back.sinAir! / back.sinBlock!).toBeCloseTo(n, 12);
      }
    }
  });
});

describe('refraction: Fresnel reflectance of unpolarised light', () => {
  it('reflects ((n − 1)/(n + 1))² at normal incidence: 4 % for glass n = 1.5', () => {
    expect(fresnelReflectance(1, 1.5, 0, 0)).toBeCloseTo(0.04, 15);
    expect(fresnelReflectance(1.33, 1, 0, 0)).toBeCloseTo((0.33 / 2.33) ** 2, 15);
  });

  it('agrees with the sine/tangent form and the textbook 5.02 % at 45° on glass', () => {
    for (const n of [1.33, 1.5, 1.7]) {
      for (const iDeg of [5, 20, 45, 70, 85]) {
        const i = iDeg * DEG;
        const t = snell(1, n, iDeg) * DEG;
        expect(fresnelReflectance(1, n, i, t)).toBeCloseTo(fresnelSinTan(i, t), 12);
      }
    }
    const t45 = snell(1, 1.5, 45) * DEG;
    expect(fresnelReflectance(1, 1.5, 45 * DEG, t45)).toBeCloseTo(0.0502, 4);
  });

  it('reflects no p-light at Brewster’s angle tan θB = n, so R = Rs/2 there', () => {
    const b = Math.atan(1.5);
    const t = Math.asin(Math.sin(b) / 1.5);
    expect(b + t).toBeCloseTo(Math.PI / 2, 12); // reflected and refracted rays at right angles
    const rs = (Math.sin(b - t) / Math.sin(b + t)) ** 2;
    expect(fresnelReflectance(1, 1.5, b, t)).toBeCloseTo(rs / 2, 12);
  });

  it('rises to 1 at the critical angle, continuous with total internal reflection', () => {
    const c = Math.asin(1 / 1.5);
    expect(fresnelReflectance(1.5, 1, c, Math.PI / 2)).toBeCloseTo(1, 12);
  });
});

describe('refraction runs: the ray box turned from 0° to the set angle', () => {
  it('ends by itself at the set angle after angle / rate seconds, on the theory', () => {
    for (const [n, dir, angle] of [
      [1.33, ENTER, 40],
      [1.49, ENTER, 85],
      [1.52, LEAVE, 30],
      [1.33, LEAVE, 48],
    ] as const) {
      const r = run(n, dir, angle);
      expect(r.endReason).toBe('model');
      expect(r.time).toBeCloseTo(angle / 10, 9);
      const theory = r.theory()!;
      for (const id of ['incidenceDeg', 'reflectionDeg', 'refractionDeg', 'sinBlock', 'sinAir']) {
        expect(r.results![id]).toBeCloseTo(theory[id]!, 10);
      }
      expect(r.results!.reflectance).toBeCloseTo(theory.reflectance!, 12);
      expect(r.results!.tir).toBe(0);
      const [n1, n2] = dir === ENTER ? [1, n] : [n, 1];
      expect(r.results!.refractionDeg).toBeCloseTo(snell(n1, n2, angle), 9);
    }
  });

  it('leaving past the critical angle: stops the refracted ray exactly at grazing, then TIR', () => {
    const r = run(1.49, LEAVE, 60);
    const c = Math.asin(1 / 1.49) / DEG;
    expect(r.endReason).toBe('model');
    expect(r.results!.incidenceDeg).toBeCloseTo(60, 10);
    expect(r.results!.tir).toBe(1);
    expect(r.results!.reflectance).toBe(1);
    expect(r.results!.lastIncidenceDeg).toBeCloseTo(c, 10); // the step landed on C itself
    expect(r.results!.refractionDeg).toBeCloseTo(90, 6);
    expect(r.results!.refractionMax).toBeCloseTo(90, 6);
    expect(r.results!.sinAir).toBeCloseTo(1, 12);
    // Every sample past C is totally reflected and every one before it is not.
    const inc = r.sampleValues[0]!;
    const tir = r.sampleValues[3]!;
    for (let k = 0; k < r.sampleCount; k++) expect(tir[k]).toBe(inc[k]! > c ? 1 : 0);
  });

  it('entering never reflects totally, however steep', () => {
    const r = run(1.7, ENTER, 85);
    const tir = r.sampleValues[3]!;
    for (let k = 0; k < r.sampleCount; k++) expect(tir[k]).toBe(0);
    expect(r.results!.refractionDeg).toBeLessThan(Math.asin(1 / 1.7) / DEG);
  });

  it('gives results independent of the step: the state is a function of the angle reached', () => {
    for (const [dir, angle] of [
      [ENTER, 37],
      [LEAVE, 70],
    ] as const) {
      const coarse = run(1.52, dir, angle, 0.1).results!;
      const fine = run(1.52, dir, angle, 0.001).results!;
      for (const id of Object.keys(fine)) expect(coarse[id]).toBeCloseTo(fine[id]!, 10);
    }
  });

  it('is deterministic: two runs give bit-identical samples', () => {
    const a = run(1.33, LEAVE, 70);
    const b = run(1.33, LEAVE, 70);
    expect(a.sampleCount).toBe(b.sampleCount);
    for (let m = 0; m < a.sampleValues.length; m++) {
      expect(Array.from(a.sampleValues[m]!.subarray(0, a.sampleCount))).toEqual(
        Array.from(b.sampleValues[m]!.subarray(0, b.sampleCount)),
      );
    }
  });

  it('at 0° ends at once, with the ray straight through and R = ((n − 1)/(n + 1))²', () => {
    const r = run(1.5, ENTER, 0);
    expect(r.endReason).toBe('model');
    expect(r.time).toBe(0);
    expect(r.results!.refractionDeg).toBe(0);
    expect(r.results!.reflectance).toBeCloseTo(0.04, 15);
  });

  it('adds nothing once the set angle is reached, however often it is asked', () => {
    const state = new Float64Array(refractionModel.variables.length);
    const input = inputs(1.5, LEAVE, 20);
    refractionModel.init(input, state);
    let t = 0;
    while (!refractionModel.isComplete!(state, input)) t += refractionModel.step(state, 0.3, input);
    expect(t).toBeCloseTo(2, 12);
    const before = Array.from(state);
    expect(refractionModel.step(state, 0.3, input)).toBe(0);
    expect(Array.from(state)).toEqual(before);
    expect(state[slot('incidenceDeg')]).toBeCloseTo(20, 12);
  });

  it('across runs, sin(air angle) against sin(block angle) is a line of slope n, both ways', () => {
    for (const n of [1.33, 1.49, 1.52]) {
      const points = (
        [
          [ENTER, 15],
          [ENTER, 45],
          [ENTER, 80],
          [LEAVE, 20],
          [LEAVE, 35],
          [LEAVE, 75], // totally reflected: its last refracted ray, the grazing one, is on the line
        ] as const
      ).map(([dir, angle]) => {
        const res = run(n, dir, angle).results!;
        return { x: res.sinBlock!, y: res.sinAir! };
      });
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error(fit.status);
      expect(fit.slope).toBeCloseTo(n, 9);
      expect(fit.intercept).toBeCloseTo(0, 9);
    }
  });
});

describe('refraction inputs', () => {
  it('refuses inputs it cannot run, by name, and accepts the limits', () => {
    const state = new Float64Array(refractionModel.variables.length);
    for (const [input, subject] of [
      [{ index: 0 }, /"index"/],
      [{ index: NaN }, /"index"/],
      [{ direction: NaN }, /"direction"/],
      [{ direction: -3 }, /"direction"/],
      [{ direction: 1.5 }, /"direction"/],
      [{ angle: -1 }, /"angle"/],
      [{ angle: 90 }, /"angle"/],
      [{ sweepRate: 0 }, /"sweepRate"/],
      [{ sweepRate: Infinity }, /"sweepRate"/],
    ] as const) {
      const bad = { ...inputs(1.5, ENTER, 30), ...input };
      expect(() => refractionModel.init(bad, state)).toThrow(subject);
      expect(() => refractionModel.predict!(bad)).toThrow(subject);
    }
    const noDirection = { index: 1.5, angle: 30, sweepRate: 10 };
    expect(() => refractionModel.init(noDirection, state)).toThrow(/"direction"/);
    expect(() => refractionModel.predict!(noDirection)).toThrow(/"direction"/);
    for (const n of [1.3, 1.7])
      for (const dir of [0, 0.5, 1])
        for (const angle of [0, 85]) {
          expect(() => refractionModel.predict!(inputs(n, dir, angle))).not.toThrow();
          expect(
            Object.values(refractionModel.predict!(inputs(n, dir, angle))).every(Number.isFinite),
          ).toBe(true);
        }
  });
});
