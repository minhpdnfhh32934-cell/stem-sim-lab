import { describe, expect, it } from 'vitest';
import type { SimulationModel } from '../SimulationModel';
import { boyleModel, charlesModel } from './gasLaws';

// Gas laws: p·V constant along the whole squeeze, L ∝ T in kelvin, the line's zero at −273.15 °C,
// the refusals.

function end(model: SimulationModel, inputs: Record<string, number>) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const seen: Record<string, number>[] = [];
  for (let i = 0; i < 100000 && !model.isComplete?.(state, inputs); i++) {
    model.step(state, 0.05, inputs);
    seen.push(Object.fromEntries(model.variables.map((v, k) => [v, state[k] ?? NaN])));
  }
  return seen;
}

const SYRINGE = { startVolume: 60e-6, endVolume: 30e-6, atmosphericPressure: 101325, duration: 10 };

describe("Boyle's law", () => {
  it('halving the volume doubles the pressure: 60 mL to 30 mL from 101 325 Pa reads 202 650 Pa', () => {
    const run = end(boyleModel, SYRINGE);
    const last = run.at(-1)!;
    expect(last.volume).toBeCloseTo(30e-6, 15);
    expect(last.pressure).toBeCloseTo(202650, 6);
    for (const s of run) expect(s.pressureVolume).toBeCloseTo(101325 * 60e-6, 9);
    expect(boyleModel.predict?.(SYRINGE).pressureVolume).toBeCloseTo(6.0795, 9);
  });

  it('p against 1/V is a line through the origin of slope p0·V0', () => {
    for (const V of [50e-6, 40e-6, 25e-6]) {
      const last = end(boyleModel, { ...SYRINGE, endVolume: V }).at(-1)!;
      expect(last.pressure! / last.inverseVolume!).toBeCloseTo(101325 * 60e-6, 9);
    }
  });

  it('refuses a squeeze past the gauge', () => {
    const state = new Float64Array(boyleModel.variables.length);
    expect(() => boyleModel.init({ ...SYRINGE, endVolume: 15e-6 }, state)).toThrow(/300 kPa/);
  });
});

const BATH = {
  bathTemperature: 80,
  startTemperature: 20,
  startLength: 0.1,
  heatingRate: 0.05,
  timeLapse: 100,
};

describe("Charles's law", () => {
  it('heated from 20 °C to 80 °C, a 10 cm column grows to 10·353.15/293.15 = 12.047 cm', () => {
    const last = end(charlesModel, BATH).at(-1)!;
    expect(last.temperature).toBeCloseTo(80, 12);
    expect(last.length).toBeCloseTo((0.1 * 353.15) / 293.15, 12);
    expect(last.labTime).toBeCloseTo(1200, 9); // 60 K at 0.05 K/s
  });

  it('L against t is one line reaching zero at −273.15 °C, cooling too', () => {
    const p = charlesModel.predict?.(BATH) ?? {};
    for (const t of [0, 40, 95]) {
      const last = end(charlesModel, { ...BATH, bathTemperature: t }).at(-1)!;
      expect(last.length).toBeCloseTo(
        (p.lengthAtZeroCelsius ?? NaN) + (p.lengthPerKelvin ?? NaN) * t,
        12,
      );
    }
    expect(-(p.lengthAtZeroCelsius ?? NaN) / (p.lengthPerKelvin ?? NaN)).toBeCloseTo(-273.15, 9);
  });

  it('refuses a bath water cannot be', () => {
    const state = new Float64Array(charlesModel.variables.length);
    expect(() => charlesModel.init({ ...BATH, bathTemperature: 120 }, state)).toThrow(/water bath/);
  });
});
