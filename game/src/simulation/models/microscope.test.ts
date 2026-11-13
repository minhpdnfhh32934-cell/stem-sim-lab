import { describe, expect, it } from 'vitest';
import microscopeJson from '../../content/experiments/microscope.json';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import {
  cellsCounted,
  COUNTABLE,
  microscopeModel,
  OBJECTIVES,
  sharpnessAt,
  SPECIMENS,
  STAINS,
} from './microscope';

const ONION = 0;
const CHEEK = 1;
const ELODEA = 2;
const NONE = 0;
const IODINE = 1;
const METHYLENE = 2;
const slot = (id: string) => microscopeModel.variables.indexOf(id);

const inputs = (change: Record<string, number> = {}) => ({
  specimen: ONION,
  stain: IODINE,
  objective: 10,
  focus: 0,
  eyepiece: 10,
  fieldNumber: 18,
  wavelength: 0.55,
  focusStart: 100,
  focusRate: 20,
  ...change,
});
const theory = (change: Record<string, number> = {}) => microscopeModel.predict!(inputs(change));

/** The shipped definition (experiments/microscope.json). */
const MICROSCOPE: ExperimentDefinition = ExperimentDefinitionSchema.parse(microscopeJson);

const run = (change: Record<string, number> = {}) => {
  const r = new ExperimentRuntime('test', MICROSCOPE, microscopeModel, {
    specimen: ONION,
    stain: IODINE,
    objective: 10,
    focus: 0,
    ...change,
  });
  r.runToCompletion();
  return r;
};
const series = (r: ExperimentRuntime, id: string) =>
  Array.from(
    r.sampleValues[MICROSCOPE.measurements.findIndex((m) => m.id === id)]!.subarray(
      0,
      r.sampleCount,
    ),
  );

describe('microscope optics', () => {
  it('magnifies eyepiece × objective: 40×, 100×, 400× with the 10× eyepiece', () => {
    expect([4, 10, 40].map((objective) => theory({ objective }).magnification)).toEqual([
      40, 100, 400,
    ]);
  });

  it('sees a field FN / M_obj across: 4.5, 1.8, 0.45 mm with FN 18 mm', () => {
    expect([4, 10, 40].map((objective) => theory({ objective }).fieldOfView)).toEqual([
      4500, 1800, 450,
    ]);
    expect(theory({ objective: 10, fieldNumber: 20 }).fieldOfView).toBe(2000);
  });

  it('keeps a depth of field λ/NA²: 55, 8.8, 1.30 µm at 0.55 µm for NA 0.10, 0.25, 0.65', () => {
    expect(theory({ objective: 4 }).depthOfField).toBeCloseTo(55, 9);
    expect(theory({ objective: 10 }).depthOfField).toBeCloseTo(8.8, 9);
    expect(theory({ objective: 40 }).depthOfField).toBeCloseTo(0.55 / 0.4225, 12);
    expect(OBJECTIVES).toEqual({ 4: 0.1, 10: 0.25, 40: 0.65 });
  });

  it('is sharpest in focus, ½ at the depth of field’s edge, falling smoothly either side', () => {
    for (const objective of [4, 10, 40]) {
      const d = theory({ objective }).depthOfField!;
      expect(sharpnessAt(0, d)).toBe(1);
      expect(sharpnessAt(d / 2, d)).toBeCloseTo(0.5, 12);
      expect(sharpnessAt(-d / 2, d)).toBeCloseTo(0.5, 12);
      expect(sharpnessAt(1.5 * d, d)).toBeCloseTo(0.1, 12);
      // Monotonic in |Δz| and symmetric about the focal plane, on a fine grid.
      let last = 1;
      for (let k = 1; k <= 400; k++) {
        const z = (k / 400) * 4 * d;
        const s = sharpnessAt(z, d);
        expect(s).toBeLessThan(last);
        expect(sharpnessAt(-z, d)).toBe(s);
        last = s;
      }
    }
  });

  it('narrows the range of sharp focus as the magnification rises (focus classes on the dial)', () => {
    // Sharp > 0.5 ≥ slightly blurred > 0.1 ≥ out of focus: the definition's classes.
    const label = (s: number) => (s > 0.5 ? 'sharp' : s > 0.1 ? 'blurred' : 'out');
    const at = (objective: number, focus: number) => label(theory({ objective, focus }).sharpness!);
    expect([0, 20, 50, 100].map((z) => at(4, z))).toEqual(['sharp', 'sharp', 'blurred', 'out']);
    expect([0, 2, 5, 10, 20].map((z) => at(10, z))).toEqual([
      'sharp',
      'sharp',
      'blurred',
      'blurred',
      'out',
    ]);
    expect([0, 1, 2, -1, -2].map((z) => at(40, z))).toEqual([
      'sharp',
      'blurred',
      'out',
      'blurred',
      'out',
    ]);
  });
});

describe('microscope specimens and stains', () => {
  it('names its specimens and stains in dial order', () => {
    expect(SPECIMENS.map((s) => s.name)).toEqual([
      'onion epidermis',
      'human cheek cells',
      'Elodea leaf',
    ]);
    expect(STAINS).toEqual(['none', 'iodine solution', 'methylene blue']);
  });

  it('is faint unstained, clear with the stain that suits it, weak with one that does not', () => {
    // Faint ≤ 0.25 < weak ≤ 0.55 < clear: the definition's contrast classes.
    const label = (c: number) => (c > 0.55 ? 'clear' : c > 0.25 ? 'weak' : 'faint');
    const of = (specimen: number) =>
      [NONE, IODINE, METHYLENE].map((stain) => label(theory({ specimen, stain }).contrast!));
    expect(of(ONION)).toEqual(['faint', 'clear', 'clear']);
    expect(of(CHEEK)).toEqual(['faint', 'weak', 'clear']);
    expect(of(ELODEA)).toEqual(['clear', 'clear', 'clear']); // no stain needed; one only adds to it
  });
});

describe('microscope cell counts', () => {
  it('counts the whole cells across the field: FOV/L, floored', () => {
    const counts = (specimen: number, stain: number) =>
      [4, 10, 40].map((objective) => {
        const t = theory({ specimen, stain, objective });
        expect(t.cellsAcross).toBe(t.fieldOfView! / t.cellLength!);
        return cellsCounted(t.cellsAcross!, 1, t.contrast!);
      });
    expect(counts(ONION, IODINE)).toEqual([18, 7, 1]); // 4500, 1800, 450 µm over 250 µm
    expect(counts(CHEEK, METHYLENE)).toEqual([75, 30, 7]); // over 60 µm
    expect(counts(ELODEA, NONE)).toEqual([56, 22, 5]); // over 80 µm
  });

  it('measures L = FOV/n from the count: never short, nearer L the more cells are counted', () => {
    for (const [specimen, stain] of [
      [ONION, IODINE],
      [CHEEK, METHYLENE],
      [ELODEA, NONE],
    ] as const) {
      const errors = [4, 10, 40].map((objective) => {
        const r = run({ specimen, stain, objective });
        const { cellsCounted: n, measuredLength, fieldOfView } = r.results!;
        expect(measuredLength).toBe(fieldOfView! / n!);
        return measuredLength! / SPECIMENS[specimen].length - 1;
      });
      for (const e of errors) expect(e).toBeGreaterThanOrEqual(0);
      expect(errors[0]).toBeLessThanOrEqual(errors[1]!);
      expect(errors[1]).toBeLessThanOrEqual(errors[2]!);
    }
    // Onion at 400×: one whole cell of 250 µm fits in 450 µm, so the count gives 450 µm.
    expect(run({ objective: 40 }).results!.measuredLength).toBe(450);
    expect(run({ objective: 10 }).results!.measuredLength).toBeCloseTo(1800 / 7, 12);
  });

  it('counts nothing where the image does not show the cells: out of focus, or faint', () => {
    expect(cellsCounted(7.2, COUNTABLE.sharpness, 0.8)).toBe(0); // the bound itself: out of focus
    expect(cellsCounted(7.2, 0.11, COUNTABLE.contrast)).toBe(0); // the bound itself: faint
    expect(cellsCounted(7.2, 0.11, 0.26)).toBe(7);
    const blurred = run({ objective: 40, focus: 2 }).results!; // S = 0.096
    expect(blurred.cellsCounted).toBe(0);
    expect(blurred.measuredLength).toBe(0);
    const faint = run({ stain: NONE }).results!; // unstained onion
    expect(faint.cellsCounted).toBe(0);
    expect(faint.measuredLength).toBe(0);
    // The theory says so too: nothing countable, no length — 0 against 0, never a 100 % error.
    for (const change of [{ objective: 40, focus: 2 }, { stain: NONE }]) {
      expect(theory(change).cellsCountable).toBe(0);
      expect(theory(change).countableLength).toBe(0);
    }
    // Where the image shows the cells, the count is FOV/L floored and the length the true L.
    expect(theory({ objective: 10 }).cellsCountable).toBe(7);
    expect(theory({ objective: 10 }).countableLength).toBe(250);
  });

  // The shipped definition's class bounds are the model's.
  it('counts only above the definition’s “Out of focus” and “Faint” bounds', () => {
    const max = (id: string) => MICROSCOPE.results.find((r) => r.id === id)?.classes?.[0]?.max;
    expect(max('sharpness')).toBe(COUNTABLE.sharpness);
    expect(max('contrast')).toBe(COUNTABLE.contrast);
  });
});

describe('microscope run: the fine focus lowers the stage to the set offset', () => {
  it('moves at 20 µm/s from +100 µm and ends exactly at the set focus', () => {
    for (const focus of [100, 50, 0, -1, -100]) {
      const r = run({ objective: 40, focus });
      expect(r.status).toBe('completed');
      expect(r.endReason).toBe('model');
      expect(r.value('offset')).toBe(focus);
      expect(r.time).toBeCloseTo((100 - focus) / 20, 9);
      const offsets = series(r, 'offset');
      for (let i = 1; i < offsets.length; i++) {
        expect(offsets[i]).toBeLessThanOrEqual(offsets[i - 1]!); // only ever down
      }
    }
  });

  it('gives the theory at the set focus, bit for bit, in every result', () => {
    for (const [specimen, stain, objective, focus] of [
      [ONION, IODINE, 4, 20],
      [CHEEK, METHYLENE, 40, 0],
      [ELODEA, NONE, 10, -5],
      [CHEEK, IODINE, 10, 100],
    ] as const) {
      const r = run({ specimen, stain, objective, focus });
      const t = r.theory()!;
      for (const result of MICROSCOPE.results) {
        if (result.id === 'measuredLength') continue; // FOV/n against the true L
        expect(r.results![result.id], result.id).toBe(t[result.theory!]);
      }
    }
  });

  it('sharpens as the stage nears the focal plane and blurs past it (the focus curve)', () => {
    const r = run({ objective: 10, focus: -100 });
    const z = series(r, 'offset');
    const s = series(r, 'sharpness');
    const peak = s.indexOf(Math.max(...s));
    expect(z[peak]).toBeCloseTo(0, 9);
    expect(s[peak]).toBeCloseTo(1, 9);
    // Past the peak the last, shortened step may move the stage by a hair: not strictly less.
    for (let i = 1; i < s.length; i++) {
      if (i <= peak) expect(s[i]).toBeGreaterThan(s[i - 1]!);
      else expect(s[i]).toBeLessThanOrEqual(s[i - 1]!);
    }
    // Each sample is the curve at its offset: the state depends only on where the stage is.
    const d = r.value('depthOfField');
    for (let i = 0; i < s.length; i++) expect(s[i]).toBe(sharpnessAt(z[i]!, d));
  });

  it('is deterministic: the same settings give the same samples, step for step', () => {
    const a = run({ specimen: ELODEA, stain: NONE, objective: 40, focus: -20 });
    const b = run({ specimen: ELODEA, stain: NONE, objective: 40, focus: -20 });
    expect(b.sampleCount).toBe(a.sampleCount);
    expect(series(b, 'offset')).toEqual(series(a, 'offset'));
    expect(series(b, 'sharpness')).toEqual(series(a, 'sharpness'));
    expect(b.results).toEqual(a.results);
  });

  it('refuses settings it does not cover, by name, as a plain Error', () => {
    for (const [change, name] of [
      [{ specimen: 3 }, 'specimen'],
      [{ stain: 0.5 }, 'stain'],
      [{ objective: 20 }, 'objective'],
      [{ focus: NaN }, 'focus'],
      [{ focusRate: 0 }, 'focusRate'],
      [{ wavelength: -1 }, 'wavelength'],
    ] as const) {
      expect(() => microscopeModel.predict!(inputs(change))).toThrow(name);
      const state = new Float64Array(microscopeModel.variables.length);
      expect(() => microscopeModel.init(inputs(change), state)).toThrow(name);
    }
  });

  it('starts at the start: the sharpness at +100 µm, the optics already set', () => {
    const state = new Float64Array(microscopeModel.variables.length);
    microscopeModel.init(inputs({ objective: 4 }), state);
    expect(state[slot('offset')]).toBe(100);
    expect(state[slot('sharpness')]).toBeCloseTo(1 / (1 + (200 / 55) ** 2), 12);
    expect(state[slot('magnification')]).toBe(40);
    expect(state[slot('cellsAcross')]).toBe(18);
    expect(state[slot('cellsCounted')]).toBe(0); // S = 0.07: out of focus
  });
});
