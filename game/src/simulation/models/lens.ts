import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const SCREEN = 0;
const BLUR = 1;
const SHARP = 2;
const SCREEN_IMAGE_HEIGHT = 3;
const IMAGE = 4;
const INVERSE_OBJECT = 5;
const INVERSE_IMAGE = 6;
const MAGNIFICATION = 7;
const IMAGE_HEIGHT = 8;
const FOCAL = 9;
const SUM = 10;
const PRODUCT = 11;

const finite = (x: number) => x < Infinity;

/**
 * What the model accepts, as [input, accepts, rule]; anything else is refused with its reason,
 * never clamped (each check fails for NaN and ±∞).
 */
const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['focalLength', (f) => f > 0 && finite(f), 'above 0 m and finite: a converging lens'],
  ['objectDistance', (u) => u > 0 && finite(u), 'above 0 m and finite: a real object'],
  ['objectHeight', (h) => h > 0 && finite(h), 'above 0 m and finite'],
  ['apertureDiameter', (a) => a > 0 && finite(a), 'above 0 m and finite'],
  ['screenStart', (s) => s >= 0 && finite(s), 'at least 0 m and finite'],
  ['benchLength', (l) => l > 0 && finite(l), 'above 0 m and finite'],
  ['screenSpeed', (w) => w > 0 && finite(w), 'above 0 m/s and finite'],
];

/** Refuses inputs the model cannot run, with the reason, before anything is computed from them. */
function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Thin lens input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Thin lens input "${id}" must be ${rule}, got ${value}`);
  }
  const f = inputs.focalLength ?? NaN;
  const u = inputs.objectDistance ?? NaN;
  const a = inputs.apertureDiameter ?? NaN;
  // u − f is 0 in floating point only when u === f, so every other u gives a finite image.
  if (u === f) {
    throw new Error(
      `Thin lens: the object is at the focal point (u = f = ${f} m): the light leaves the lens ` +
        `parallel and the image is at infinity; move the object`,
    );
  }
  // The blur is paraxial geometry; a lens wider than its focal length (faster than f/1) is not.
  if (!(a <= f)) {
    throw new Error(`Thin lens: an aperture of ${a} m is wider than f = ${f} m (faster than f/1)`);
  }
  const travel = (inputs.benchLength ?? NaN) - u;
  if (!(travel > (inputs.screenStart ?? NaN))) {
    throw new Error(
      `Thin lens: with the lens ${u} m from the object, the ${inputs.benchLength} m bench leaves ` +
        `no room for the screen, which starts ${inputs.screenStart} m behind the lens`,
    );
  }
}

/** Image distance v = u·f/(u − f) (m): positive real, negative virtual (lens formula). */
const imageDistanceOf = (inputs: Inputs) => {
  const u = inputs.objectDistance ?? NaN;
  const f = inputs.focalLength ?? NaN;
  return (u * f) / (u - f);
};

/** 1/v = 1/f − 1/u (m⁻¹): finite even where v is huge. */
const inverseImageOf = (inputs: Inputs) =>
  1 / (inputs.focalLength ?? NaN) - 1 / (inputs.objectDistance ?? NaN);

/** The farthest the screen goes from the lens: the end of the bench. */
const screenEndOf = (inputs: Inputs) =>
  (inputs.benchLength ?? NaN) - (inputs.objectDistance ?? NaN);

/** Blur-disc diameter (m) on a screen at s from the lens: A·|1 − s/v|, 0 when it is sharp. */
const blurAt = (s: number, sharp: boolean, inputs: Inputs) =>
  sharp ? 0 : (inputs.apertureDiameter ?? NaN) * Math.abs(1 - s * inverseImageOf(inputs));

/** The search is over: the screen holds a sharp image or has reached the end of the bench. */
const searched = (state: Float64Array, inputs: Inputs) =>
  state[SHARP] === 1 || (state[SCREEN] ?? 0) >= screenEndOf(inputs);

/** Values that follow from the screen's position s. */
function placeScreen(state: Float64Array, s: number, sharp: boolean, inputs: Inputs): void {
  state[SCREEN] = s;
  state[SHARP] = sharp ? 1 : 0;
  state[BLUR] = blurAt(s, sharp, inputs);
  state[SCREEN_IMAGE_HEIGHT] = (-(inputs.objectHeight ?? NaN) * s) / (inputs.objectDistance ?? NaN);
}

/**
 * Image formation by a converging lens on an optical bench — a teaching model of paraxial
 * geometrical optics with an ideal thin lens, not a lab-grade one. Distances in m, measured from
 * the lens, real-is-positive: the object at u > 0 in front, the image at v behind it (v < 0:
 * virtual, on the object's side). The lens formula 1/u + 1/v = 1/f (Vietnamese textbooks:
 * 1/d + 1/d′ = 1/f), v = u·f/(u − f); magnification k = −v/u (negative: inverted), image height
 * h′ = k·h (Hecht, Optics, 5th ed., §5.2.3). u = f is refused (the image is at infinity).
 *
 * Bench: the illuminated object (height h, `objectHeight`) at the scale's 0 mark, the lens (focal
 * length f, aperture diameter A) at u, a white screen that slides from `screenStart` s₀ behind
 * the lens towards the end of the bench at `benchLength` L, so at most L − u from the lens. A run
 * is the search for the image, as a student slides the screen: it moves at a steady `screenSpeed`
 * w and stops where the image is sharp, s = v (the step is cut to land on it), or at the end of
 * the bench when no sharp image is on its way (v virtual, before s₀ or beyond the bench).
 *
 * On the screen at s each object point makes a blur disc, the cross-section of its cone of light
 * through the aperture: diameter A·|1 − s/v| (similar triangles; for v < 0 the cone diverges from
 * the virtual image), 0 at s = v; its centre is on the undeviated ray through the lens centre, at
 * height −h·s/u for the object's top. No aberrations, no diffraction (≈ 2.44·λ·v/A ≈ 10 µm here),
 * one wavelength, the lens's thickness neglected; the eye's depth of focus is not modelled: the
 * image is sharp at s = v exactly.
 *
 * Variables: `screenDistance` s (m), `blur` (m), `sharp` 1 once the screen holds a sharp image,
 * `screenImageHeight` (m, signed) — and, fixed by u and f for the run: `imageDistance` v (m),
 * `inverseObjectDistance` 1/u and `inverseImageDistance` 1/v (m⁻¹), `magnification` k,
 * `imageHeight` h′ (m), `focalLength` u·v/(u + v) (m, the lens formula applied to the run's u
 * and v), `distanceSum` u + v (m) and `distanceProduct` u·v (m²).
 */
export const thinLensModel: SimulationModel = {
  id: 'optics.thin-lens',
  inputs: [
    'focalLength',
    'objectDistance',
    'objectHeight',
    'apertureDiameter',
    'screenStart',
    'benchLength',
    'screenSpeed',
  ],
  variables: [
    'screenDistance',
    'blur',
    'sharp',
    'screenImageHeight',
    'imageDistance',
    'inverseObjectDistance',
    'inverseImageDistance',
    'magnification',
    'imageHeight',
    'focalLength',
    'distanceSum',
    'distanceProduct',
  ],
  predictions: [
    'imageDistance',
    'inverseObjectDistance',
    'inverseImageDistance',
    'magnification',
    'imageHeight',
    'focalLength',
    'power',
    'reciprocalSlope',
    'distanceSum',
    'distanceProduct',
    'sharp',
    'screenDistance',
    'blur',
    'screenImageHeight',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const u = inputs.objectDistance ?? NaN;
    const v = imageDistanceOf(inputs);
    const k = -v / u;
    state[IMAGE] = v;
    state[INVERSE_OBJECT] = 1 / u;
    state[INVERSE_IMAGE] = inverseImageOf(inputs);
    state[MAGNIFICATION] = k;
    state[IMAGE_HEIGHT] = k * (inputs.objectHeight ?? NaN);
    state[FOCAL] = (u * v) / (u + v);
    state[SUM] = u + v;
    state[PRODUCT] = u * v;
    const s0 = inputs.screenStart ?? NaN;
    placeScreen(state, s0, s0 === v, inputs);
  },

  step(state, dt, inputs) {
    if (searched(state, inputs)) return 0;
    const s = state[SCREEN] ?? 0;
    const v = state[IMAGE] ?? NaN;
    const end = screenEndOf(inputs);
    const stop = v > s && v <= end ? v : end;
    const speed = inputs.screenSpeed ?? NaN;
    const next = s + speed * dt;
    if (next < stop) {
      placeScreen(state, next, false, inputs);
      return dt;
    }
    placeScreen(state, stop, stop === v, inputs);
    return (stop - s) / speed;
  },

  isComplete: searched,

  /**
   * The theory, in closed form: v, 1/u, 1/v, k, h′, u + v and u·v from the lens formula; the
   * lens's f and power 1/f (m⁻¹); −1, the slope of 1/v against 1/u (whose intercept is 1/f);
   * where the screen stops — at v when s₀ ≤ v ≤ L − u (a sharp image), else at the end of the
   * bench, with the blur and the image's height there.
   */
  predict(inputs) {
    refuseInvalid(inputs);
    const u = inputs.objectDistance ?? NaN;
    const f = inputs.focalLength ?? NaN;
    const h = inputs.objectHeight ?? NaN;
    const v = imageDistanceOf(inputs);
    const end = screenEndOf(inputs);
    const sharp = v >= (inputs.screenStart ?? NaN) && v <= end;
    const screen = sharp ? v : end;
    return {
      imageDistance: v,
      inverseObjectDistance: 1 / u,
      inverseImageDistance: inverseImageOf(inputs),
      magnification: -v / u,
      imageHeight: (-v / u) * h,
      focalLength: f,
      power: 1 / f,
      reciprocalSlope: -1,
      distanceSum: u + v,
      distanceProduct: u * v,
      sharp: sharp ? 1 : 0,
      screenDistance: screen,
      blur: blurAt(screen, sharp, inputs),
      screenImageHeight: (-h * screen) / u,
    };
  },
};
