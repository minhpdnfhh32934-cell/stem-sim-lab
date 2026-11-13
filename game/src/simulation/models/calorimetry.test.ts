import { describe, expect, it } from 'vitest';
import type { SimulationModel } from '../SimulationModel';
import { CALORIMETRY, latentHeatModel, specificHeatModel } from './calorimetry';

// Calorimetry: the heating curve against Newton's cooling solved by hand and by small steps, c and
// λ recovered as the practicals work them, the refusals.

function at(model: SimulationModel, inputs: Record<string, number>, t: number) {
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  const lapse = inputs.timeLapse ?? 1;
  let left = t / lapse;
  while (left > 1e-12) {
    const took = model.step(state, Math.min(left, 0.05), inputs);
    if (took === 0) break;
    left -= took;
  }
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
}

const HEAT = {
  power: 40,
  waterMass: 0.2,
  heatingTime: 300,
  roomTemperature: 20,
  calorimeterCapacity: 45,
  lossCoefficient: 0.1,
  timeLapse: 30,
};

describe('specific heat with a joulemeter', () => {
  it('without loss, ΔT = P·t/(m·c + C): 12 000 J into 881.2 J/K is 13.62 K, and c comes back exactly', () => {
    const end = at(specificHeatModel, { ...HEAT, lossCoefficient: 0 }, 300);
    expect(end.energy).toBeCloseTo(12000, 9);
    expect(end.temperatureRise).toBeCloseTo(12000 / (0.2 * 4181 + 45), 9);
    expect(end.specificHeatSeen).toBeCloseTo(CALORIMETRY.waterSpecificHeat, 6);
  });

  it('with loss, T follows (m·c + C)·dT/dt = P − k·(T − T0), and c worked without it comes out high', () => {
    // The ODE by small Euler steps against the closed form.
    let T = 20;
    const cap = 0.2 * 4181 + 45;
    for (let i = 0; i < 300000; i++) T += ((40 - 0.1 * (T - 20)) / cap) * 0.001;
    const end = at(specificHeatModel, HEAT, 300);
    expect(end.temperature).toBeCloseTo(T, 4);
    expect(end.temperatureRise).toBeLessThan(12000 / cap);
    expect(end.specificHeatSeen).toBeGreaterThan(4181);
    expect(end.specificHeatSeen).toBeLessThan(4181 * 1.03); // a few per cent high, not more
    const p = specificHeatModel.predict?.(HEAT) ?? {};
    expect(p.temperatureRise).toBeCloseTo(end.temperatureRise ?? NaN, 9);
    expect(p.specificHeat).toBe(4181);
  });

  it('stops on the heating time, in lab time', () => {
    const end = at(specificHeatModel, HEAT, 1000);
    expect(end.labTime).toBe(300);
    const state = new Float64Array(specificHeatModel.variables.length);
    specificHeatModel.init(HEAT, state);
    expect(specificHeatModel.step(state, 100, HEAT)).toBeCloseTo(10, 12); // 300 s at 30× = 10 s
  });

  it('refuses a run that would boil the water, and inputs it cannot take', () => {
    const state = new Float64Array(specificHeatModel.variables.length);
    expect(() =>
      specificHeatModel.init({ ...HEAT, power: 200, waterMass: 0.05, heatingTime: 3000 }, state),
    ).toThrow(/boil/);
    expect(() => specificHeatModel.init({ ...HEAT, waterMass: 0 }, state)).toThrow(/waterMass/);
  });
});

const MELT = { power: 36, heatingTime: 240, roomHeatGain: 1.5, iceMass: 0.3, timeLapse: 24 };

describe('latent heat of fusion with a control funnel', () => {
  it('melts (P + P_room)·t/λ and P_room·t/λ: 26.98 g and 1.08 g, and λ comes back from the difference', () => {
    const end = at(latentHeatModel, MELT, 240);
    expect(end.meltHeated).toBeCloseTo((37.5 * 240) / 333600, 12);
    expect(end.meltControl).toBeCloseTo((1.5 * 240) / 333600, 12);
    expect(end.latentHeatSeen).toBeCloseTo(333600, 6);
    expect(end.latentHeatUncorrected).toBeCloseTo((36 / 37.5) * 333600, 6); // 4 % low
  });

  it('agrees with its theory, and with no room heat the control stays dry', () => {
    const p = latentHeatModel.predict?.(MELT) ?? {};
    expect(p.meltHeated).toBeCloseTo(at(latentHeatModel, MELT, 240).meltHeated ?? NaN, 12);
    expect(p.latentHeat).toBe(333600);
    expect(at(latentHeatModel, { ...MELT, roomHeatGain: 0 }, 240).meltControl).toBe(0);
  });

  it('refuses melting more ice than the funnel holds', () => {
    const state = new Float64Array(latentHeatModel.variables.length);
    expect(() => latentHeatModel.init({ ...MELT, power: 200, heatingTime: 3600 }, state)).toThrow(
      /more than/,
    );
  });
});
