import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { LIMITING_FACTOR, photosynthesisModel as model, temperatureFactor } from './photosynthesis';

const ELAPSED = model.variables.indexOf('elapsed');
const VOLUME = model.variables.indexOf('volume');
const BUBBLES = model.variables.indexOf('bubbles');
const MEAN_RATE = model.variables.indexOf('meanRate');
const INVERSE_RATE = model.variables.indexOf('inverseRate');

const inputs = (distance = 0.1, carbonate = 0.05, temperature = 25, duration = 60) => ({
  distance,
  carbonate,
  temperature,
  duration,
});
const theory = (i: Record<string, number>) => model.predict!(i);
const rate = (d: number, c: number, t: number) => theory(inputs(d, c, t)).rate!;

/**
 * Worked by hand: at 0.1 m, I = 10 000 lux and αI = 2e-6 · 10 000 = 0.02 mL/s, so 1/(αI) = 50 s/mL;
 * at 0.05 mol/L and 25 °C, P_c = 0.01 · (0.05/0.055) · 2^−0.5 = 0.1/(11√2), so 1/P_c = 110√2 s/mL.
 */
const WORKED = 1 / (50 + 110 * Math.SQRT2);

/** A minimal station definition: the model's own run, sampled every 0.5 s, as a station runs it. */
const definition = ExperimentDefinitionSchema.parse({
  id: 'photosynthesis-test',
  name: 'Photosynthesis (test)',
  category: 'biology',
  model: model.id,
  parameters: [
    { id: 'distance', label: 'd', unit: 'm', default: 0.1, min: 0.05, max: 0.5 },
    { id: 'carbonate', label: 'C', unit: 'mol/L', default: 0.05, min: 0.001, max: 0.05 },
    { id: 'temperature', label: 'T', unit: '°C', default: 25, min: 5, max: 40 },
  ],
  initialConditions: { duration: 60 },
  simulation: { timeStep: 0.05, maxDuration: 120, sampleInterval: 0.5 },
  measurements: [
    { id: 'volume', label: 'V', unit: 'mL', variable: 'volume' },
    { id: 'bubbles', label: 'N', unit: '', variable: 'bubbles' },
  ],
  results: [
    { id: 'volume', label: 'V', unit: 'mL', variable: 'volume', reduce: 'final', theory: 'volume' },
    { id: 'bubbles', label: 'N', unit: '', variable: 'bubbles', reduce: 'final' },
    { id: 'rate', label: 'V/t', unit: 'mL/s', variable: 'meanRate', reduce: 'final' },
    {
      id: 'inverseRate',
      label: 't/V',
      unit: 's/mL',
      variable: 'inverseRate',
      reduce: 'final',
      theory: 'inverseRate',
    },
  ],
});

/** The model alone, stepped by `dt` until it says it is done; returns the state and the steps. */
function collect(input: Record<string, number>, dt: number) {
  const state = new Float64Array(model.variables.length);
  model.init(input, state);
  const advanced: number[] = [];
  while (!model.isComplete!(state, input)) advanced.push(model.step(state, dt, input));
  return { state, advanced };
}

describe('photosynthesis theory: light, CO₂ and temperature as limiting factors', () => {
  it('lights the plant by the inverse square law: 10 000 lux at 0.1 m, a quarter at twice that', () => {
    expect(theory(inputs(0.1)).intensity).toBeCloseTo(10_000, 9);
    expect(theory(inputs(0.2)).intensity).toBeCloseTo(2_500, 9);
    expect(theory(inputs(0.05)).intensity).toBeCloseTo(40_000, 9);
    expect(theory(inputs(1)).intensity).toBeCloseTo(100, 9);
    expect(theory(inputs(0.25)).distanceSquared).toBeCloseTo(0.0625, 15);
  });

  it('gives f(T) = 2^((T − 30)/10) up to 30 °C, then a straight fall to 0 at 45 °C', () => {
    expect(temperatureFactor(30)).toBe(1);
    expect(temperatureFactor(20)).toBeCloseTo(0.5, 12); // Q₁₀ = 2: half, 10 °C cooler
    expect(temperatureFactor(10)).toBeCloseTo(0.25, 12);
    expect(temperatureFactor(25)).toBeCloseTo(Math.SQRT1_2, 12);
    expect(temperatureFactor(40)).toBeCloseTo(1 / 3, 12); // 5 of the 15 °C to 45 °C left
    expect(temperatureFactor(45)).toBe(0);
    expect(temperatureFactor(30 + 1e-9)).toBeCloseTo(1, 8); // no jump at the optimum
  });

  it('matches rates worked by hand from 1/P = 1/(αI) + 1/P_c', () => {
    const t = theory(inputs(0.1, 0.05, 25));
    expect(t.rate).toBeCloseTo(WORKED, 15);
    expect(t.inverseRate).toBeCloseTo(50 + 110 * Math.SQRT2, 10);
    expect(t.saturatedRate).toBeCloseTo(0.1 / (11 * Math.SQRT2), 15);
    expect(t.volume).toBeCloseTo(60 * WORKED, 14); // 0.2919 mL in a minute …
    expect(t.bubbles).toBe(29); // … 29 whole bubbles of 0.01 mL
    // 0.2 m, 30 °C: αI = 2e-6 · 2 500 = 0.005 (1/αI = 200); P_c = 0.01 · 10/11 (1/P_c = 110).
    expect(rate(0.2, 0.05, 30)).toBeCloseTo(1 / 310, 15);
    // 0.5 m, 0.005 mol/L, 20 °C: αI = 8e-4 (1 250); P_c = 0.01 · 1/2 · 1/2 (400).
    expect(rate(0.5, 0.005, 20)).toBeCloseTo(1 / 1650, 15);
  });

  it('predicts the intercept of 1/P against d²: 1/P_c, worked by hand', () => {
    // At C = 0.05 mol/L and 30 °C: P_c = 0.01 · 0.05/(0.05 + 0.005) · 1 = 1/110 mL/s.
    expect(theory(inputs(0.2, 0.05, 30)).inverseRateIntercept).toBeCloseTo(110, 9);
    for (const d of [0.2, 0.4, 1])
      expect(1 / rate(d, 0.05, 30)).toBeCloseTo(5_000 * d * d + 110, 6);
  });

  it('shares one starting slope in dim light, whatever the CO₂ and temperature', () => {
    // α·I₀·d₀² = 2e-6 · 10 000 · 0.01 = 2e-4 mL·m²/s, for every C and T.
    for (const [c, t] of [
      [0.001, 5],
      [0.05, 25],
      [1, 30],
      [0.2, 44],
    ] as const) {
      expect(theory(inputs(1, c, t)).lightSlope).toBeCloseTo(2e-4, 18);
      expect(theory(inputs(1, c, t)).inverseRateSlope).toBeCloseTo(5_000, 9);
    }
    // At 10 m (1 lux, αI = 2e-6 mL/s) the rate is within 1 % below that line for CO₂ and warmth
    // across their dials: P·d² = αI·d² · P_c/(αI + P_c) with P_c ≥ 0.01 · 1/6 · 2^−2.5 ≈ 2.9e-4.
    for (const c of [0.001, 0.05])
      for (const t of [5, 30, 40]) {
        const onLine = (rate(10, c, t) * 100) / 2e-4;
        expect(onLine).toBeGreaterThan(0.99);
        expect(onLine).toBeLessThan(1);
      }
    // Light-limited at 1 m, 25 °C: 0.002 → 0.05 mol/L changes 1/P from 5 000 + 1/P_c(0.002) to
    // 5 000 + 110√2, with 1/P_c(0.002) = 1/(0.01 · 2/7 · 2^−0.5) = 350√2: a gain of only 6.6 % …
    const dimGain = (5_000 + 350 * Math.SQRT2) / (5_000 + 110 * Math.SQRT2);
    expect(rate(1, 0.05, 25) / rate(1, 0.002, 25)).toBeCloseTo(dimGain, 12);
    expect(dimGain).toBeLessThan(1.07);
    // … but near the lamp (0.05 m, 1/αI = 12.5) the same change triples it.
    const brightGain = (12.5 + 350 * Math.SQRT2) / (12.5 + 110 * Math.SQRT2);
    expect(rate(0.05, 0.05, 25) / rate(0.05, 0.002, 25)).toBeCloseTo(brightGain, 12);
    expect(brightGain).toBeGreaterThan(3);
  });

  it('levels off at a light that rises with the CO₂: half the plateau at I = P_c/α', () => {
    // 0.005 mol/L, 30 °C: P_c = 0.005, so half of it at I = 2 500 lux, i.e. at 0.2 m.
    expect(rate(0.2, 0.005, 30)).toBeCloseTo(0.0025, 15);
    // 0.05 mol/L, 30 °C: P_c = 1/110, half of it at I = 1e4/2.2 lux, i.e. at 0.1·√2.2 m.
    expect(rate(0.1 * Math.sqrt(2.2), 0.05, 30)).toBeCloseTo(1 / 220, 15);
    // The rate rises with the light and stays below its plateau.
    let previous = 0;
    for (const d of [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0.01]) {
      const t = theory(inputs(d, 0.05, 25));
      expect(t.rate).toBeGreaterThan(previous);
      expect(t.rate).toBeLessThan(t.saturatedRate!);
      previous = t.rate!;
    }
  });

  it('puts 1/P against d² on an exact line: slope 1/(α·I₀·d₀²), intercept 1/P_c', () => {
    const points = [0.05, 0.1, 0.2, 0.4].map((d) => ({ x: d * d, y: 1 / rate(d, 0.05, 25) }));
    const fit = fitLine(points);
    expect(fit.status).toBe('fitted');
    if (fit.status !== 'fitted') return;
    expect(fit.slope).toBeCloseTo(5_000, 8);
    expect(fit.intercept).toBeCloseTo(110 * Math.SQRT2, 8);
    expect(fit.sse).toBeCloseTo(0, 12);
  });

  it('names light while αI < P_c, else the smaller of the CO₂ and temperature factors', () => {
    // Far lamp: αI = 2e-4 < P_c = 0.01 · 40/41.
    expect(theory(inputs(1, 0.2, 30)).limiting).toBe(LIMITING_FACTOR.light);
    // Near lamp, little hydrogencarbonate: αI = 0.08 > P_c; f_C = 2/7 < f(30 °C) = 1.
    expect(theory(inputs(0.05, 0.002, 30)).limiting).toBe(LIMITING_FACTOR.carbon);
    // Near lamp, plenty of CO₂, cold: f(5 °C) = 2^−2.5 ≈ 0.18 < f_C = 40/41.
    expect(theory(inputs(0.05, 0.2, 5)).limiting).toBe(LIMITING_FACTOR.temperature);
    // Too hot is temperature as well, f(40 °C) = 1/3, and there cooling raises the rate:
    // 1/P = 12.5 + 1/(0.01 · 40/41 · f) at f = 1/3 (40 °C) and f = 1 (30 °C).
    expect(theory(inputs(0.05, 0.2, 40)).limiting).toBe(LIMITING_FACTOR.temperature);
    expect(rate(0.05, 0.2, 30) / rate(0.05, 0.2, 40)).toBeCloseTo(
      (12.5 + 102.5 * 3) / (12.5 + 102.5),
      12,
    );
    // 0.1 m, 25 °C: αI = 0.02 > P_c, f(T) = 0.71 < f_C = 0.91, so temperature; and warming to
    // 30 °C (1/P = 50 + 110) gains more than halving the distance (1/P = 12.5 + 110√2).
    expect(theory(inputs(0.1, 0.05, 25)).limiting).toBe(LIMITING_FACTOR.temperature);
    const warmer = rate(0.1, 0.05, 30) / WORKED;
    const closer = rate(0.05, 0.05, 25) / WORKED;
    expect(warmer).toBeCloseTo((50 + 110 * Math.SQRT2) / 160, 12);
    expect(closer).toBeCloseTo((50 + 110 * Math.SQRT2) / (12.5 + 110 * Math.SQRT2), 12);
    expect(warmer).toBeGreaterThan(closer);
  });

  it('never throws across the station dials, and refuses what it cannot run with its reason', () => {
    for (const d of [0.05, 0.1, 0.5])
      for (const c of [0.001, 0.002, 0.05])
        for (const temperature of [5, 30, 40]) {
          const t = theory(inputs(d, c, temperature));
          expect(Object.values(t).every(Number.isFinite)).toBe(true);
        }
    for (const d of [0.01, 10])
      expect(Object.values(theory(inputs(d))).every(Number.isFinite)).toBe(true);
    const state = new Float64Array(model.variables.length);
    expect(() => model.init(inputs(0.005), state)).toThrow(/distance.*0\.01 to 10 m/);
    expect(() => model.predict!(inputs(1e-160))).toThrow(/distance/); // d² would underflow
    expect(() => model.predict!(inputs(Number.NaN))).toThrow(/distance/);
    expect(() => model.predict!(inputs(0.1, 0))).toThrow(/carbonate/); // no CO₂, no O₂
    expect(() => model.predict!(inputs(0.1, 0.05, 45))).toThrow(/temperature/);
    expect(() => model.predict!(inputs(0.1, 0.05, 25, 0))).toThrow(/duration/);
    expect(() => model.predict!({ distance: 0.1, carbonate: 0.05, temperature: 25 })).toThrow(
      /missing/,
    );
  });
});

describe('photosynthesis run: gas collected at a steady rate for the collection time', () => {
  it('collects V = P·t, counts whole bubbles, and stops by itself at exactly one minute', () => {
    const r = new ExperimentRuntime('test', definition, model);
    r.runToCompletion();
    expect(r.endReason).toBe('model');
    expect(r.time).toBeCloseTo(60, 9);
    const [volume, bubbles] = [r.sampleValues[0]!, r.sampleValues[1]!];
    expect(r.sampleCount).toBeGreaterThan(100);
    for (let i = 0; i < r.sampleCount; i++) {
      const v = volume[i]!;
      expect(v).toBeCloseTo(WORKED * r.sampleTimes[i]!, 12);
      // N whole bubbles of 0.01 mL: N·0.01 ≤ V < (N + 1)·0.01, never fewer than before.
      expect(bubbles[i]! * 0.01).toBeLessThanOrEqual(v + 1e-12);
      expect((bubbles[i]! + 1) * 0.01).toBeGreaterThan(v);
      if (i > 0) expect(bubbles[i]).toBeGreaterThanOrEqual(bubbles[i - 1]!);
    }
    expect(r.results?.volume).toBeCloseTo(WORKED * 60, 12);
    expect(r.results?.bubbles).toBe(29);
    expect(r.results?.rate).toBeCloseTo(WORKED, 14);
    expect(r.results?.inverseRate).toBeCloseTo(50 + 110 * Math.SQRT2, 9);
    expect(r.results?.volume).toBeCloseTo(r.theory()!.volume!, 12);
  });

  it('does not depend on the step: any dt ends on the collection time with the same gas', () => {
    const input = inputs(0.2, 0.01, 18, 60);
    const expected = theory(input);
    for (const dt of [0.01, 0.05, 0.07, 1, 7, 100]) {
      const { state, advanced } = collect(input, dt);
      expect(state[ELAPSED]).toBe(60);
      expect(state[VOLUME]).toBeCloseTo(expected.volume!, 13);
      expect(state[BUBBLES]).toBe(expected.bubbles);
      expect(state[MEAN_RATE]).toBeCloseTo(expected.rate!, 15);
      expect(state[INVERSE_RATE]! / expected.inverseRate! - 1).toBeCloseTo(0, 12);
      const sum = advanced.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(60, 9); // the last step took only what was left
      expect(advanced.at(-1)!).toBeLessThanOrEqual(dt);
    }
  });

  it('is deterministic: the same inputs give bit-identical states', () => {
    const a = collect(inputs(0.13, 0.02, 22), 0.05).state;
    const b = collect(inputs(0.13, 0.02, 22), 0.05).state;
    expect([...a]).toEqual([...b]);
  });

  it('starts empty and finite, and adds nothing once the time is up', () => {
    const input = inputs(0.1, 0.01, 25);
    const state = new Float64Array(model.variables.length);
    model.init(input, state);
    expect([...state].every(Number.isFinite)).toBe(true);
    expect([state[VOLUME], state[BUBBLES], state[MEAN_RATE], state[INVERSE_RATE]]).toEqual([
      0, 0, 0, 0,
    ]);
    const done = collect(inputs(), 0.05).state;
    const before = [...done];
    expect(model.step(done, 0.05, inputs())).toBe(0);
    expect([...done]).toEqual(before);
  });
});
