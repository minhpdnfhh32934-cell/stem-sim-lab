import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const OFFSET = 0;
const SHARPNESS = 1;
const MAGNIFICATION = 2;
const FIELD = 3;
const DEPTH = 4;
const CONTRAST = 5;
const ACROSS = 6;
const COUNTED = 7;
const MEASURED = 8;

/**
 * The prepared slides, by their `specimen` code: the typical length L (µm) of one cell along the
 * line counted, and the image contrast under each stain, by `stain` code (none, iodine solution,
 * methylene blue). Stated teaching values, not measurements of a particular slide: onion
 * epidermis cells are typically 0.2–0.4 mm long, cheek cells 40–80 µm across, Elodea leaf cells
 * 50–100 µm long. Contrast is judged on 0 (invisible) to 1 (black on white): unstained onion and
 * cheek cells are colourless and nearly invisible in bright field; iodine is the usual stain for
 * onion (its nuclei and walls turn yellow-brown) and methylene blue also shows them; methylene
 * blue is the stain for cheek cells (their nuclei turn blue), iodine stains them only weakly;
 * Elodea needs no stain, its green chloroplasts giving the contrast, and a stain only adds to it
 * (iodine turns the starch in the chloroplasts blue-black, methylene blue shows the nuclei).
 */
export const SPECIMENS = [
  { name: 'onion epidermis', length: 250, contrast: [0.15, 0.8, 0.65] },
  { name: 'human cheek cells', length: 60, contrast: [0.1, 0.4, 0.85] },
  { name: 'Elodea leaf', length: 80, contrast: [0.75, 0.85, 0.8] },
] as const;

export const STAINS = ['none', 'iodine solution', 'methylene blue'] as const;

/** The nosepiece's objectives by magnification: their numerical aperture (DIN achromats). */
export const OBJECTIVES: Readonly<Record<number, number>> = { 4: 0.1, 10: 0.25, 40: 0.65 };

/**
 * Cells can be counted only in an image sharper and with more contrast than these: the upper
 * bounds of the "Out of focus" and "Faint" classes (the definition's must equal them).
 */
export const COUNTABLE = { sharpness: 0.1, contrast: 0.25 } as const;

/** Refuses inputs the model cannot run, by name, never clamping them. */
function refuseInvalid(inputs: Inputs): void {
  const code = (id: string, count: number) => {
    const v = inputs[id];
    if (!(v !== undefined && Number.isInteger(v) && v >= 0 && v < count)) {
      throw new Error(`Microscope input "${id}" must be a code from 0 to ${count - 1}, got ${v}`);
    }
  };
  code('specimen', SPECIMENS.length);
  code('stain', STAINS.length);
  const objective = inputs.objective;
  if (objective === undefined || OBJECTIVES[objective] === undefined) {
    throw new Error(`Microscope input "objective" must be 4, 10 or 40 (×), got ${objective}`);
  }
  for (const id of ['eyepiece', 'fieldNumber', 'wavelength', 'focusRate']) {
    const v = inputs[id];
    if (!(v !== undefined && v > 0 && v < Infinity)) {
      throw new Error(`Microscope input "${id}" must be finite and above 0, got ${v}`);
    }
  }
  for (const id of ['focus', 'focusStart']) {
    if (!Number.isFinite(inputs[id])) {
      throw new Error(`Microscope input "${id}" must be finite, got ${inputs[id]}`);
    }
  }
}

/** What the settings fix about the image, whatever the focus. */
function imageOf(inputs: Inputs) {
  refuseInvalid(inputs);
  const objective = inputs.objective ?? NaN;
  const na = OBJECTIVES[objective] ?? NaN;
  const specimen = SPECIMENS[inputs.specimen ?? 0] ?? SPECIMENS[0];
  const field = ((inputs.fieldNumber ?? NaN) * 1000) / objective; // FN is in mm
  return {
    magnification: (inputs.eyepiece ?? NaN) * objective,
    field,
    depth: (inputs.wavelength ?? NaN) / (na * na),
    contrast: specimen.contrast[inputs.stain ?? 0] ?? NaN,
    length: specimen.length,
    across: field / specimen.length,
  };
}

/** The sharpness index at `offset` from the focal plane: 1/(1 + (2Δz/d)²), ½ at Δz = ±d/2. */
export const sharpnessAt = (offset: number, depth: number) => 1 / (1 + ((2 * offset) / depth) ** 2);

/**
 * The whole cells counted end to end across the field (`across` cell lengths fit), if the image
 * shows them; else none. 1e-9: a whole number of cells that rounds just below it still counts.
 */
export const cellsCounted = (across: number, sharpness: number, contrast: number) =>
  sharpness > COUNTABLE.sharpness && contrast > COUNTABLE.contrast ? Math.floor(across + 1e-9) : 0;

/** What follows from the stage's offset: the sharpness, the count and the length it gives. */
function derive(state: Float64Array): void {
  const sharpness = sharpnessAt(state[OFFSET] ?? NaN, state[DEPTH] ?? NaN);
  const n = cellsCounted(state[ACROSS] ?? NaN, sharpness, state[CONTRAST] ?? NaN);
  state[SHARPNESS] = sharpness;
  state[COUNTED] = n;
  state[MEASURED] = n > 0 ? (state[FIELD] ?? NaN) / n : 0;
}

/**
 * Observing a prepared slide with a school compound microscope whose camera shows the eyepiece's
 * field on a monitor — a simplified teaching model of bright-field geometry, not of image
 * formation. The total magnification is eyepiece × objective (10× with 4×, 10×, 40×: 40×, 100×,
 * 400×). The field of view is the eyepiece's field number over the objective's magnification
 * (FN 18 mm: 4.5, 1.8, 0.45 mm; a finite-tube microscope, no intermediate optics). The depth of
 * field is the wave-optical term λ·n/NA² (λ = 0.55 µm, air n = 1; NA 0.10, 0.25, 0.65: 55, 8.8,
 * 1.3 µm); the geometric term that depends on the detector (eye or camera pixels), which dominates
 * at low power, is left out. Sharpness is an index, 1/(1 + (2Δz/d)²) at the stage's offset Δz from
 * the specimen's focal plane: 1 in focus, ½ at the edge of the depth of field, falling smoothly —
 * an illustrative curve, not a computed image. Contrast comes from the specimen and stain table
 * (`SPECIMENS`). Each cell has the specimen's typical length L; FOV/L lengths fit across the
 * field, and a student counts the whole cells that do (floor), only in an image not out of focus
 * (S > 0.1) and not faint (contrast > 0.25), else none; the cell length from the count is FOV/n
 * (0 when none is counted), never shorter than L, nearer it the more cells are counted.
 *
 * A run is the fine-focus knob turned at a steady `focusRate` (µm/s), moving the stage from
 * `focusStart` (raised, as a student starts) to the set `focus`, the image forming on the monitor
 * as it goes; the last step is shortened to land exactly there, where the run ends and the
 * image is observed. The state depends only on the offset reached, so it is exact at every step.
 *
 * Variables: `offset` Δz (µm, positive: specimen above the focal plane), `sharpness` S (0–1),
 * `magnification` (×), `fieldOfView` (diameter, µm), `depthOfField` (µm), `contrast` (0–1),
 * `cellsAcross` FOV/L, `cellsCounted` n and `measuredLength` FOV/n (µm).
 */
export const microscopeModel: SimulationModel = {
  id: 'biology.microscope',
  inputs: [
    'specimen',
    'stain',
    'objective',
    'focus',
    'eyepiece',
    'fieldNumber',
    'wavelength',
    'focusStart',
    'focusRate',
  ],
  variables: [
    'offset',
    'sharpness',
    'magnification',
    'fieldOfView',
    'depthOfField',
    'contrast',
    'cellsAcross',
    'cellsCounted',
    'measuredLength',
  ],
  predictions: [
    'magnification',
    'fieldOfView',
    'depthOfField',
    'sharpness',
    'contrast',
    'cellLength',
    'cellsAcross',
    'cellsCountable',
    'countableLength',
  ],

  init(inputs, state) {
    const image = imageOf(inputs);
    state.fill(0);
    state[OFFSET] = inputs.focusStart ?? NaN;
    state[MAGNIFICATION] = image.magnification;
    state[FIELD] = image.field;
    state[DEPTH] = image.depth;
    state[CONTRAST] = image.contrast;
    state[ACROSS] = image.across;
    derive(state);
  },

  step(state, dt, inputs) {
    const z = state[OFFSET] ?? NaN;
    const target = inputs.focus ?? NaN;
    if (z === target) return 0;
    const rate = inputs.focusRate ?? NaN;
    const left = Math.abs(target - z);
    const reached = left <= rate * dt;
    state[OFFSET] = reached ? target : z + Math.sign(target - z) * rate * dt;
    derive(state);
    return reached ? left / rate : dt;
  },

  isComplete: (state, inputs) => state[OFFSET] === inputs.focus,

  /**
   * The theory at the set focus, in closed form: M, FOV, the depth of field, the sharpness at the
   * set offset, the contrast from the table, the true cell length L and how many cell lengths
   * fit across the field, FOV/L; and what the image at the set focus lets a student count and
   * measure: the whole part of FOV/L and the true L if it shows the cells, else none (both 0, as
   * the run gives them), so a run that counts nothing reads 0 against 0, not as a 100 % error.
   */
  predict(inputs) {
    const image = imageOf(inputs);
    const sharpness = sharpnessAt(inputs.focus ?? NaN, image.depth);
    const countable = cellsCounted(image.across, sharpness, image.contrast);
    return {
      magnification: image.magnification,
      fieldOfView: image.field,
      depthOfField: image.depth,
      sharpness,
      contrast: image.contrast,
      cellLength: image.length,
      cellsAcross: image.across,
      cellsCountable: countable,
      countableLength: countable > 0 ? image.length : 0,
    };
  },
};
