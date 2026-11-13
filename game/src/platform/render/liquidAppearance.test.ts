import { describe, expect, it } from 'vitest';
import { violetDepth } from '../labVisuals/chemistry';
import { appearanceOf, type LiquidInput, tintOf } from './liquidAppearance';

const presets: Record<string, { parameter: string; value: number }> = {
  'stock-20': { parameter: 'stockConcentration', value: 2e-5 },
  'flask-50': { parameter: 'finalVolume', value: 50 },
};
const input = (
  contents: Record<string, number>,
  sample: Record<string, number> = {},
  parameters: Record<string, number> = {},
): LiquidInput => ({ contents, sample, parameters, sets: (id) => presets[id] });

const look = appearanceOf('chemistry.dilution');

describe('the dilution liquid', () => {
  it('is registered by model id only', () => {
    expect(look).toBeDefined();
    expect(appearanceOf('chemistry.titration')).toBeUndefined();
    expect(appearanceOf('toString')).toBeUndefined();
  });

  it('draws a stock from its own label value, Beer–Lambert across the vessel width', () => {
    // ε·C·w = 1e7 L/(mol·m) × 2e-5 mol/L × 0.05 m
    const a = look?.absorbance(input({ 'stock-20': 5000 }), 0.05);
    expect(a).toBeCloseTo(1e7 * 2e-5 * 0.05, 12);
    // the run's own absorptivity wins over the default
    const b = look?.absorbance(input({ 'stock-20': 5000 }, {}, { absorptivity: 5e6 }), 0.05);
    expect(b).toBeCloseTo(5e6 * 2e-5 * 0.05, 12);
  });

  it('draws anything added to a stock from the model, never from the contents', () => {
    const contents = { 'stock-20': 5000, water: 21000 };
    // the contents would say 2e-5 × 5/26; the model's sample is what is drawn
    expect(look?.absorbance(input(contents, { concentration: 1e-6 }), 0.05)).toBeCloseTo(
      1e7 * 1e-6 * 0.05,
      12,
    );
    // without a run the model has nothing to say: no reading, never a guess
    expect(look?.absorbance(input(contents, { concentration: NaN }), 0.05)).toBeNaN();
    expect(look?.absorbance(input(contents), 0.05)).toBeNaN();
  });

  it('draws water, and a glassware choice with nothing in it, clear', () => {
    expect(look?.absorbance(input({ water: 40000 }, { concentration: 1e-3 }), 0.05)).toBe(0);
    expect(look?.absorbance(input({}), 0.05)).toBe(0);
  });

  it('turns an absorbance into the filter colour by the 2D bench depth, a square root a face', () => {
    const out: [number, number, number] = [0, 0, 0];
    tintOf(look, 0, out);
    expect(out).toEqual([1, 1, 1]);
    tintOf(look, NaN, out);
    expect(out).toEqual([1, 1, 1]);
    tintOf(look, 1, out);
    const depth = violetDepth(1);
    const dye = look?.dye ?? [1, 1, 1];
    dye.forEach((d, i) => expect(out[i]).toBeCloseTo(Math.sqrt(1 + depth * (d - 1)), 12));
    // darker as the dye gets denser, in every channel
    const dense: [number, number, number] = [0, 0, 0];
    tintOf(look, 2, dense);
    dense.forEach((v, i) => expect(v).toBeLessThanOrEqual(out[i] ?? 1));
    // an unregistered model: clear whatever the absorbance
    tintOf(undefined, 3, out);
    expect(out).toEqual([1, 1, 1]);
  });
});
