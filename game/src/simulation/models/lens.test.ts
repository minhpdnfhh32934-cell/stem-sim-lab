import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { thinLensModel } from './lens';

const v = (name: string) => thinLensModel.variables.indexOf(name);
const SCREEN = v('screenDistance');
const BLUR = v('blur');
const SHARP = v('sharp');
const PATCH = v('screenImageHeight');

const A = 0.04;
const H = 0.03;
const S0 = 0.05;
const L = 1;
const W = 0.1;

const inputsOf = (change: Record<string, number> = {}) => ({
  focalLength: 0.1,
  objectDistance: 0.3,
  objectHeight: H,
  apertureDiameter: A,
  screenStart: S0,
  benchLength: L,
  screenSpeed: W,
  ...change,
});

/**
 * An independent reference: paraxial ray tracing with ray-transfer matrices (Hecht, §6.2) — a
 * ray of height y and slope θ crosses free space d as (y + d·θ, θ) and the thin lens as
 * (y, θ − y/f). Returns the height at the screen s of the ray from the object point at height y0
 * (u in front of the lens) through the lens at height yLens.
 */
function trace(u: number, f: number, s: number, y0: number, yLens: number): number {
  const slope = (yLens - y0) / u; // object → lens
  const bent = slope - yLens / f; // through the lens
  return yLens + s * bent; // lens → screen
}

/** Where rays from one object point through the lens's top and bottom edge meet (they are linear
 *  in s, so two screen positions fix them); the image distance, found without the lens formula. */
function meetingPoint(u: number, f: number): number {
  const gap = (s: number) => trace(u, f, s, H, A / 2) - trace(u, f, s, H, -A / 2);
  return gap(0) / (gap(0) - gap(1));
}

/** The spread of the cone of light from an object point on a screen at s: the blur diameter. */
const traceBlur = (u: number, f: number, s: number) =>
  Math.abs(trace(u, f, s, 0, A / 2) - trace(u, f, s, 0, -A / 2));

/** The model alone, stepped by `dt` until it stops; `each` sees the state after each step. */
function search(inputs: Record<string, number>, dt: number, each?: (s: Float64Array) => void) {
  const state = new Float64Array(thinLensModel.variables.length);
  thinLensModel.init(inputs, state);
  let time = 0;
  let last = dt;
  for (let i = 0; i < 1e7 && !thinLensModel.isComplete!(state, inputs); i++) {
    last = thinLensModel.step(state, dt, inputs);
    time += last;
    each?.(state);
  }
  return { state, time, last };
}

const at = (state: Float64Array, name: string) => state[v(name)]!;

describe('thin lens theory: the lens formula against hand-worked values and ray tracing', () => {
  it('gives worked textbook values: real, same-size and virtual images', () => {
    // 1/v = 1/0.10 − 1/0.30 = 20/3 m⁻¹: v = 0.15 m, k = −0.5, h′ = −1.5 cm.
    const a = thinLensModel.predict!(inputsOf());
    expect(a.imageDistance).toBeCloseTo(0.15, 12);
    expect(a.inverseImageDistance).toBeCloseTo(20 / 3, 12);
    expect(a.magnification).toBeCloseTo(-0.5, 12);
    expect(a.imageHeight).toBeCloseTo(-0.015, 12);
    // u = 2f: the image is at 2f, inverted and the same size.
    const b = thinLensModel.predict!(inputsOf({ focalLength: 0.15, objectDistance: 0.3 }));
    expect(b.imageDistance).toBeCloseTo(0.3, 12);
    expect(b.magnification).toBeCloseTo(-1, 12);
    // A 4 cm object 30 cm from an f = 20 cm lens: image 60 cm behind, inverted, 8 cm tall.
    const c = thinLensModel.predict!(
      inputsOf({ focalLength: 0.2, objectDistance: 0.3, objectHeight: 0.04 }),
    );
    expect(c.imageDistance).toBeCloseTo(0.6, 12);
    expect(c.imageHeight).toBeCloseTo(-0.08, 12);
    // Inside f, a magnifier: u = 10 cm, f = 15 cm gives v = −30 cm, upright, 3 times larger.
    const d = thinLensModel.predict!(inputsOf({ focalLength: 0.15, objectDistance: 0.1 }));
    expect(d.imageDistance).toBeCloseTo(-0.3, 12);
    expect(d.magnification).toBeCloseTo(3, 12);
    expect([d.sharp, d.screenDistance]).toEqual([0, L - 0.1]);
  });

  it('puts the image where traced rays from one object point meet, at the traced height', () => {
    for (const f of [0.05, 0.1, 0.15, 0.2]) {
      for (const u of [0.03, 0.08, 0.12, 0.25, 0.3, 0.4, 0.6]) {
        if (u === f) continue;
        const t = thinLensModel.predict!(inputsOf({ focalLength: f, objectDistance: u }));
        const meet = meetingPoint(u, f);
        expect(t.imageDistance! / meet).toBeCloseTo(1, 12);
        expect(1 / t.inverseImageDistance! / meet).toBeCloseTo(1, 12);
        // Every ray from the object's top reaches the image at h′, the chief ray among them.
        expect(trace(u, f, meet, H, 0) / t.imageHeight!).toBeCloseTo(1, 12);
        expect(trace(u, f, meet, H, A / 2) / t.imageHeight!).toBeCloseTo(1, 9);
        expect(Math.sign(t.imageDistance!)).toBe(u > f ? 1 : -1); // real beyond f, else virtual
        expect(Math.sign(t.magnification!)).toBe(u > f ? -1 : 1); // real images are inverted
      }
    }
  });

  it('satisfies 1/u + 1/v = 1/f and u·v = f·(u + v) for real and virtual images', () => {
    for (const u of [0.08, 0.25, 0.3, 0.4, 0.6]) {
      const t = thinLensModel.predict!(inputsOf({ focalLength: 0.2, objectDistance: u }));
      expect(t.inverseObjectDistance! + t.inverseImageDistance!).toBeCloseTo(t.power!, 12);
      expect(t.power).toBeCloseTo(5, 12);
      expect(t.distanceProduct! / (t.focalLength! * t.distanceSum!)).toBeCloseTo(1, 12);
    }
  });

  it('gives f back from runs as the line 1/v = −1/u + 1/f and as the slope of u·v against u + v', () => {
    for (const f of [0.1, 0.15, 0.2]) {
      const runs = [0.08, 0.25, 0.3, 0.4, 0.6].map((u) =>
        thinLensModel.predict!(inputsOf({ focalLength: f, objectDistance: u })),
      );
      const reciprocal = fitLine(
        runs.map((t) => ({ x: t.inverseObjectDistance!, y: t.inverseImageDistance! })),
      );
      const product = fitLine(runs.map((t) => ({ x: t.distanceSum!, y: t.distanceProduct! })));
      if (reciprocal.status !== 'fitted' || product.status !== 'fitted') throw new Error('no line');
      expect(reciprocal.slope).toBeCloseTo(runs[0]!.reciprocalSlope!, 9);
      expect(reciprocal.intercept).toBeCloseTo(1 / f, 9);
      expect(reciprocal.intercept).toBeCloseTo(runs[0]!.power!, 9);
      expect(product.slope).toBeCloseTo(f, 9);
      expect(product.intercept).toBeCloseTo(0, 9);
    }
  });

  it('predicts the blur from the traced cone where the screen stops', () => {
    // f = 0.20 m, u = 0.25 m: v = 1.00 m, beyond the end of the bench at L − u = 0.75 m.
    const beyond = thinLensModel.predict!(inputsOf({ focalLength: 0.2, objectDistance: 0.25 }));
    expect(beyond.imageDistance).toBeCloseTo(1, 12);
    expect([beyond.sharp, beyond.screenDistance]).toEqual([0, 0.75]);
    expect(beyond.blur).toBeCloseTo(A * (1 - 0.75 / 1), 12); // 1.0 cm
    expect(beyond.blur).toBeCloseTo(traceBlur(0.25, 0.2, 0.75), 12);
    const virtual = thinLensModel.predict!(inputsOf({ objectDistance: 0.08 }));
    expect(virtual.blur).toBeCloseTo(traceBlur(0.08, 0.1, 0.92), 12); // A·(1 + 0.92/0.40)
    expect(virtual.screenImageHeight).toBeCloseTo(trace(0.08, 0.1, 0.92, H, 0), 12);
    const sharp = thinLensModel.predict!(inputsOf());
    expect([sharp.sharp, sharp.blur]).toEqual([1, 0]);
    expect(sharp.screenDistance).toBe(sharp.imageDistance);
  });
});

describe('thin lens run: the screen slides until the image is sharp or the bench ends', () => {
  it('stops exactly at v with no blur, after (v − s₀)/w, whatever the step', () => {
    const inputs = inputsOf({ focalLength: 0.15, objectDistance: 0.4 }); // v = 0.24 m
    const theory = thinLensModel.predict!(inputs);
    for (const dt of [0.001, 0.01, 0.03, 0.7, 5]) {
      const { state, time, last } = search(inputs, dt);
      expect(at(state, 'screenDistance')).toBe(theory.imageDistance);
      expect([at(state, 'sharp'), at(state, 'blur')]).toEqual([1, 0]);
      expect(time).toBeCloseTo((0.24 - S0) / W, 9);
      expect(last).toBeLessThanOrEqual(dt);
      expect(at(state, 'screenImageHeight')).toBeCloseTo(theory.imageHeight!, 12);
      expect(at(state, 'focalLength')).toBeCloseTo(0.15, 12); // u·v/(u + v)
    }
    const { state } = search(inputs, 0.01);
    expect(thinLensModel.step(state, 0.01, inputs)).toBe(0); // nothing after the search
  });

  it('draws the traced blur and patch at every step, shrinking to 0 at a real image', () => {
    const inputs = inputsOf({ focalLength: 0.2, objectDistance: 0.3 }); // v = 0.60 m
    let previous = Infinity;
    let steps = 0;
    search(inputs, 0.01, (s) => {
      expect(s[BLUR]!).toBeCloseTo(traceBlur(0.3, 0.2, s[SCREEN]!), 12);
      expect(s[PATCH]!).toBeCloseTo(trace(0.3, 0.2, s[SCREEN]!, H, 0), 12);
      expect(s[BLUR]!).toBeLessThan(previous);
      previous = s[BLUR]!;
      steps++;
    });
    expect(previous).toBe(0);
    expect(steps).toBe(550); // 0.05 → 0.60 m at 1 mm per step
  });

  it('finds no sharp image for a virtual image or one beyond the bench, and says so', () => {
    for (const [f, u] of [
      [0.1, 0.08], // virtual
      [0.2, 0.25], // real, at 1.00 m, the bench ends at 0.75 m
    ] as const) {
      const inputs = inputsOf({ focalLength: f, objectDistance: u });
      const theory = thinLensModel.predict!(inputs);
      const { state, time } = search(inputs, 0.01);
      expect(at(state, 'screenDistance')).toBe(L - u);
      expect(at(state, 'sharp')).toBe(0);
      expect(at(state, 'blur')).toBe(theory.blur);
      expect(at(state, 'blur')).toBeGreaterThan(0.009);
      expect(time).toBeCloseTo((L - u - S0) / W, 9);
      expect(at(state, 'imageDistance')).toBe(theory.imageDistance); // the lens formula's v
    }
  });

  it('runs an object close to f, with its image far beyond the bench, to the end', () => {
    const inputs = inputsOf({ objectDistance: 0.1 * (1 + 1e-9) });
    const { state } = search(inputs, 0.05);
    expect(at(state, 'imageDistance')).toBeGreaterThan(1e7);
    expect(Array.from(state).every(Number.isFinite)).toBe(true);
    expect(at(state, 'sharp')).toBe(0);
    expect(at(state, 'blur')).toBeCloseTo(A, 6); // nearly parallel light: the aperture's width
  });

  it('holds a sharp image at the start when the screen starts at v', () => {
    const inputs = inputsOf({ screenStart: 0.15 }); // v = 0.15 m
    const state = new Float64Array(thinLensModel.variables.length);
    thinLensModel.init(inputs, state);
    expect([state[SHARP], state[BLUR]]).toEqual([1, 0]);
    expect(thinLensModel.isComplete!(state, inputs)).toBe(true);
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = search(inputsOf({ objectDistance: 0.25 }), 0.01).state;
    const b = search(inputsOf({ objectDistance: 0.25 }), 0.01).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('thin lens inputs: refused with a reason, never clamped', () => {
  const state = new Float64Array(thinLensModel.variables.length);

  it('refuses missing, non-finite and out-of-range inputs', () => {
    const missing: Record<string, number> = inputsOf();
    delete missing.focalLength;
    expect(() => thinLensModel.init(missing, state)).toThrow(/"focalLength" is missing/);
    expect(() => thinLensModel.predict!(inputsOf({ focalLength: -0.1 }))).toThrow(/converging/);
    expect(() => thinLensModel.init(inputsOf({ objectDistance: 0 }), state)).toThrow(/real object/);
    expect(() => thinLensModel.init(inputsOf({ objectDistance: NaN }), state)).toThrow(/object/);
    expect(() => thinLensModel.init(inputsOf({ screenSpeed: 0 }), state)).toThrow(/screenSpeed/);
    expect(() => thinLensModel.init(inputsOf({ objectHeight: Infinity }), state)).toThrow(
      /objectHeight/,
    );
  });

  it('refuses the object at the focal point, where the image is at infinity', () => {
    expect(() => thinLensModel.predict!(inputsOf({ objectDistance: 0.1 }))).toThrow(/infinity/);
  });

  it('refuses a lens wider than its focal length and a bench with no room for the screen', () => {
    expect(() => thinLensModel.predict!(inputsOf({ apertureDiameter: 0.11 }))).toThrow(/f\/1/);
    expect(() => thinLensModel.predict!(inputsOf({ objectDistance: 0.96 }))).toThrow(/no room/);
  });
});

describe('thin lens in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'lens-test',
    name: 'Lens',
    category: 'physics',
    model: 'optics.thin-lens',
    parameters: [
      { id: 'focalLength', label: 'f', unit: 'm', default: 0.1, min: 0.1, max: 0.2 },
      { id: 'objectDistance', label: 'u', unit: 'm', default: 0.3, min: 0.08, max: 0.6 },
    ],
    initialConditions: {
      objectHeight: H,
      apertureDiameter: A,
      screenStart: S0,
      benchLength: L,
      screenSpeed: W,
    },
    simulation: { timeStep: 0.01, maxDuration: 12, sampleInterval: 0.02 },
    measurements: [{ id: 'screen', label: 's', unit: 'm', variable: 'screenDistance' }],
    results: [
      {
        id: 'v',
        label: 'v',
        unit: 'm',
        variable: 'imageDistance',
        reduce: 'final',
        theory: 'imageDistance',
      },
      {
        id: 's',
        label: 's',
        unit: 'm',
        variable: 'screenDistance',
        reduce: 'final',
        theory: 'screenDistance',
      },
      { id: 'b', label: 'b', unit: 'm', variable: 'blur', reduce: 'final', theory: 'blur' },
    ],
  });

  it('ends by itself, inside the time limit, for every lens and object distance on the dials', () => {
    for (const focalLength of [0.1, 0.15, 0.2]) {
      for (const objectDistance of [0.08, 0.25, 0.3, 0.4, 0.6]) {
        const r = new ExperimentRuntime('t', definition, thinLensModel, {
          focalLength,
          objectDistance,
        });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        const theory = r.theory()!;
        expect(r.results!.v).toBe(theory.imageDistance);
        expect(r.results!.s).toBeCloseTo(theory.screenDistance!, 12);
        expect(r.results!.b).toBeCloseTo(theory.blur!, 12);
      }
    }
  });
});
