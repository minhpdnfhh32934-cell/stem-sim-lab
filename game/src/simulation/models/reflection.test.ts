import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { reflectionModel } from './reflection';

const DEG = Math.PI / 180;
const slot = (id: string) => reflectionModel.variables.indexOf(id);
const RAY_BOX = slot('rayBox');
const I = slot('incidenceDeg');
const I_PRIME = slot('reflectionDeg');
const PHI = slot('reflectedDeg');
const PHI_RAD = slot('reflected');
const BETWEEN = slot('betweenDeg');

const RAY_ANGLES = [15, 30, 45, 60];
const MIRROR_TURNS = [0, 5, 10, 15];

const inputsOf = (rayAngle: number, mirrorTurn = 0, sweepRate = 10) => ({
  rayAngle,
  mirrorTurn,
  sweepRate,
});

/** The model alone, stepped by `dt` until it stops; `each` sees the state. */
function sweep(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(reflectionModel.variables.length);
  reflectionModel.init(inputs, state);
  let time = 0;
  for (let k = 0; k < 1e7 && !reflectionModel.isComplete!(state, inputs); k++) {
    time += reflectionModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, time };
}

/**
 * The image construction, independent of the model's vector law: the reflected ray seems to come
 * from the ray box's image, as far behind the mirror's face as the box is in front, on the same
 * perpendicular. Board axes as the model's: x on the disc's 0° line, y towards the ray box.
 * Returns the reflected ray's disc angle φ (°) on the side away from the ray box.
 */
function imageMethod(thetaDeg: number, alphaDeg: number): number {
  const box = { x: Math.cos(thetaDeg * DEG), y: Math.sin(thetaDeg * DEG) };
  // The mirror's face: through the centre, square to its normal (cos α, −sin α).
  const face = { x: Math.sin(alphaDeg * DEG), y: Math.cos(alphaDeg * DEG) };
  const along = box.x * face.x + box.y * face.y;
  const image = { x: 2 * along * face.x - box.x, y: 2 * along * face.y - box.y };
  // From the image through the centre (where the light meets the mirror): direction −image.
  return -Math.atan2(-image.y, -image.x) / DEG;
}

/** The minimum of a unimodal f on [a, b], by golden-section search. */
function minimise(f: (t: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let [lo, hi] = [a, b];
  for (let k = 0; k < 200; k++) {
    const c = hi - g * (hi - lo);
    const d = lo + g * (hi - lo);
    if (f(c) < f(d)) hi = d;
    else lo = c;
  }
  return (lo + hi) / 2;
}

/**
 * Fermat's principle: of all the paths from the slit A to the point B by way of the mirror's
 * face, light takes the shortest. Returns where along the face (m from the centre) that path
 * touches it, B being 0.12 m out along the disc angle φ (°) on the side away from the box.
 */
function fermatTouch(thetaDeg: number, alphaDeg: number, phiDeg: number): number {
  const a = { x: 0.085 * Math.cos(thetaDeg * DEG), y: 0.085 * Math.sin(thetaDeg * DEG) };
  const b = { x: 0.12 * Math.cos(phiDeg * DEG), y: -0.12 * Math.sin(phiDeg * DEG) };
  const face = { x: Math.sin(alphaDeg * DEG), y: Math.cos(alphaDeg * DEG) };
  const path = (t: number) =>
    Math.hypot(a.x - t * face.x, a.y - t * face.y) + Math.hypot(t * face.x - b.x, t * face.y - b.y);
  return minimise(path, -0.05, 0.05);
}

describe('reflection theory: the law of reflection and the turned mirror', () => {
  it('reflects a ray at 30° on a square mirror at 30°, 60° from the incident ray', () => {
    const t = reflectionModel.predict!(inputsOf(30));
    expect([t.incidenceDeg, t.reflectionDeg, t.betweenDeg, t.reflectedDeg]).toEqual([
      30, 30, 60, 30,
    ]);
  });

  it('turns a ray at 45° through a right angle (the periscope mirror)', () => {
    const { state } = sweep(inputsOf(45), 0.01);
    expect(state[BETWEEN]).toBeCloseTo(90, 12);
    // Reflected direction (cos 45°, −sin 45°): the incident ray (−cos 45°, −sin 45°) turned 90°.
    expect(Math.cos(state[PHI_RAD]!)).toBeCloseTo(Math.SQRT1_2, 14);
    expect(Math.sin(state[PHI_RAD]!)).toBeCloseTo(Math.SQRT1_2, 14);
  });

  it('by hand: θ 30°, mirror turned 10° → i = i′ = 40°, rays 80° apart, φ = 50°', () => {
    const { state } = sweep(inputsOf(30, 10), 0.01);
    expect(state[I]).toBeCloseTo(40, 12);
    expect(state[I_PRIME]).toBeCloseTo(40, 12);
    expect(state[BETWEEN]).toBeCloseTo(80, 12);
    expect(state[PHI]).toBeCloseTo(50, 12);
  });

  it('sends the ray where the image construction does, for every dial setting', () => {
    for (const theta of RAY_ANGLES)
      for (const alpha of MIRROR_TURNS) {
        const { state } = sweep(inputsOf(theta, alpha), 0.01);
        expect(state[PHI]).toBeCloseTo(imageMethod(theta, alpha), 12);
      }
  });

  it('takes the shortest path from the slit by way of the mirror (Fermat)', () => {
    for (const theta of RAY_ANGLES)
      for (const alpha of MIRROR_TURNS) {
        const { state } = sweep(inputsOf(theta, alpha), 0.01);
        // The shortest path touches the face at the centre, where the ray was aimed …
        expect(Math.abs(fermatTouch(theta, alpha, state[PHI]!))).toBeLessThan(1e-7);
        // … and the check can fail: 1° off the model's ray, it touches millimetres away.
        expect(Math.abs(fermatTouch(theta, alpha, state[PHI]! + 1))).toBeGreaterThan(5e-4);
      }
  });

  it('puts the reflected ray on the other side of the normal at the same angle', () => {
    for (const theta of RAY_ANGLES)
      for (const alpha of MIRROR_TURNS) {
        const { state } = sweep(inputsOf(theta, alpha), 0.01);
        // Normal at α on the reflected side: box θ + α one way, reflected φ − α the other.
        expect(state[I]).toBeCloseTo(theta + alpha, 12);
        expect(state[PHI]! - alpha).toBeCloseTo(state[I_PRIME]!, 12);
        expect(state[I_PRIME]).toBeCloseTo(state[I]!, 12);
        expect(state[BETWEEN]).toBeCloseTo(state[I]! + state[I_PRIME]!, 12);
      }
  });

  it('turns the reflected ray by twice the mirror’s turn: the optical lever', () => {
    for (const theta of RAY_ANGLES) {
      const square = sweep(inputsOf(theta, 0), 0.01).state[PHI]!;
      expect(square).toBeCloseTo(theta, 12);
      for (const alpha of MIRROR_TURNS) {
        expect(sweep(inputsOf(theta, alpha), 0.01).state[PHI]! - square).toBeCloseTo(2 * alpha, 12);
      }
    }
  });

  it('returns a ray at normal incidence on itself: i = i′ = 0, φ = 0 (not −0)', () => {
    const { state, time } = sweep(inputsOf(0), 0.01);
    expect(time).toBe(0);
    expect([state[I], state[I_PRIME], state[BETWEEN]]).toEqual([0, 0, 0]);
    expect(Object.is(state[PHI], 0)).toBe(true);
  });
});

describe('reflection runs: the ray box turned from 0° to θ', () => {
  it('follows the law at every step of the sweep, not only at the end', () => {
    for (const alpha of [0, 15]) {
      let steps = 0;
      sweep(inputsOf(60, alpha), 0.01, (s) => {
        const box = s[RAY_BOX]! / DEG;
        expect(s[I]).toBeCloseTo(box + alpha, 10);
        expect(s[I_PRIME]).toBeCloseTo(box + alpha, 10);
        expect(s[PHI]).toBeCloseTo(box + 2 * alpha, 10);
        steps++;
      });
      // 60° at 10 °/s in 0.01 s steps, and at most one sliver more where they add up short of θ.
      expect([600, 601]).toContain(steps);
    }
  });

  it('ends exactly at θ after θ/ω seconds, with a bit-identical state for any step', () => {
    const finals = [0.001, 0.01, 0.07, 0.37, 7].map((dt) => {
      const { state, time } = sweep(inputsOf(45, 10), dt);
      expect(state[RAY_BOX]).toBe(45 * DEG);
      expect(time).toBeCloseTo(4.5, 9);
      return Array.from(state);
    });
    for (const f of finals) expect(f).toEqual(finals[0]);
  });

  it('adds nothing once θ is reached', () => {
    const inputs = inputsOf(30, 5);
    const { state } = sweep(inputs, 0.02);
    const before = Array.from(state);
    expect(reflectionModel.step(state, 0.02, inputs)).toBe(0);
    expect(Array.from(state)).toEqual(before);
  });

  it('is deterministic: two runs give the same bits at every step', () => {
    const collect = () => {
      const out: number[] = [];
      sweep(inputsOf(60, 15), 0.013, (s) => out.push(...s));
      return out;
    };
    expect(collect()).toEqual(collect());
  });

  it('gives the law over runs: i′ against i is a line of slope 1 through the origin', () => {
    for (const alpha of MIRROR_TURNS) {
      const points = RAY_ANGLES.map((theta) => {
        const { state } = sweep(inputsOf(theta, alpha), 0.01);
        return { x: state[I]!, y: state[I_PRIME]! };
      });
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      expect(fit.slope).toBeCloseTo(reflectionModel.predict!(inputsOf(30, alpha)).lawSlope!, 10);
      expect(fit.intercept).toBeCloseTo(0, 9);
    }
  });

  it('gives the lever over runs: φ against α is a line of slope 2 and intercept θ', () => {
    for (const theta of RAY_ANGLES) {
      const points = MIRROR_TURNS.map((alpha) => ({
        x: alpha,
        y: sweep(inputsOf(theta, alpha), 0.01).state[PHI]!,
      }));
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      const t = reflectionModel.predict!(inputsOf(theta, 5));
      expect(fit.slope).toBeCloseTo(t.leverSlope!, 10);
      expect(fit.intercept).toBeCloseTo(t.leverIntercept!, 9);
      expect(t.leverIntercept).toBe(theta);
    }
  });
});

describe('reflection inputs: refused with a reason, never clamped', () => {
  const state = new Float64Array(reflectionModel.variables.length);

  it('refuses missing, out-of-range and non-finite inputs, by name', () => {
    const missing: Record<string, number> = inputsOf(30);
    delete missing.mirrorTurn;
    expect(() => reflectionModel.init(missing, state)).toThrow(/"mirrorTurn" is missing/);
    expect(() => reflectionModel.init(inputsOf(-1), state)).toThrow(/"rayAngle"/);
    expect(() => reflectionModel.init(inputsOf(90), state)).toThrow(/"rayAngle"/);
    expect(() => reflectionModel.init(inputsOf(NaN), state)).toThrow(/"rayAngle"/);
    expect(() => reflectionModel.predict!(inputsOf(30, -5))).toThrow(/"mirrorTurn"/);
    expect(() => reflectionModel.init(inputsOf(30, 0, 0), state)).toThrow(/"sweepRate"/);
    expect(() => reflectionModel.init(inputsOf(30, 0, Infinity), state)).toThrow(/"sweepRate"/);
  });

  it('refuses a ray that would graze the mirror or strike its back, accepts one just in front', () => {
    expect(() => reflectionModel.predict!(inputsOf(60, 30))).toThrow(/90° from its normal.*θ \+ α/);
    expect(() => reflectionModel.init(inputsOf(70, 45), state)).toThrow(/grazing it or striking/);
    const { state: s } = sweep(inputsOf(59.9, 30), 0.01);
    expect(s[I]).toBeCloseTo(89.9, 10);
    expect(s[PHI]).toBeCloseTo(119.9, 10);
  });
});

describe('reflection in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'reflection-test',
    name: 'Reflection',
    category: 'physics',
    model: 'optics.reflection',
    parameters: [
      { id: 'rayAngle', label: 'θ', unit: '°', default: 30, min: 0, max: 60 },
      { id: 'mirrorTurn', label: 'α', unit: '°', default: 0, min: 0, max: 15 },
    ],
    initialConditions: { sweepRate: 10 },
    simulation: { timeStep: 0.01, maxDuration: 10, sampleInterval: 0.05 },
    measurements: [{ id: 'i', label: 'i', unit: '°', variable: 'incidenceDeg' }],
    results: ['incidenceDeg', 'reflectionDeg', 'reflectedDeg', 'betweenDeg'].map((id) => ({
      id,
      label: id,
      unit: '°',
      variable: id,
      reduce: 'final',
      theory: id,
    })),
  });

  it('ends by itself at θ/ω for every preset, the results on the theory', () => {
    for (const rayAngle of RAY_ANGLES)
      for (const mirrorTurn of MIRROR_TURNS) {
        const r = new ExperimentRuntime('t', definition, reflectionModel, { rayAngle, mirrorTurn });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(rayAngle / 10, 9);
        const theory = r.theory()!;
        for (const id of Object.keys(r.results!)) {
          expect(r.results![id]).toBeCloseTo(theory[id]!, 9);
        }
      }
  });
});
