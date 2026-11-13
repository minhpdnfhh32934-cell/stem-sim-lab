import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import {
  CIRCUIT_PARALLEL,
  CIRCUIT_SERIES,
  CIRCUIT_SINGLE,
  circuitModel,
  equivalentResistance,
} from './circuit';

const slot = (id: string) => circuitModel.variables.indexOf(id);
const T = slot('clock');
const SW = slot('switch');
const V = slot('voltage');
const I = slot('current');
const P = slot('power');
const R = slot('resistance');
const E = slot('energy');
const V1 = slot('voltage1');
const V2 = slot('voltage2');
const I1 = slot('current1');
const I2 = slot('current2');

const inputs = (voltage: number, r1: number, r2: number, configuration: number) => ({
  voltage,
  resistance1: r1,
  resistance2: r2,
  configuration,
  switchTime: 0.5,
  duration: 3,
});

/** The model alone, stepped by `dt` until it says it is done; `each` sees the state. */
function run(
  input: Record<string, number>,
  dt = 0.001,
  each?: (s: Float64Array, h: number) => void,
) {
  const state = new Float64Array(circuitModel.variables.length);
  circuitModel.init(input, state);
  for (let n = 0; n < 1e6 && !circuitModel.isComplete!(state, input); n++) {
    const h = circuitModel.step(state, dt, input);
    each?.(state, h);
  }
  return state;
}

// A minimal definition to run the model through the runtime the stations use.
const definition = ExperimentDefinitionSchema.parse({
  id: 'circuit-test',
  name: 'Circuit test',
  category: 'physics',
  model: 'electric.dc-circuit',
  parameters: [
    { id: 'voltage', label: 'V', unit: 'V', default: 6, min: 0, max: 12 },
    { id: 'resistance1', label: 'R1', unit: 'Ω', default: 100, min: 33, max: 1000 },
    { id: 'resistance2', label: 'R2', unit: 'Ω', default: 220, min: 33, max: 1000 },
    { id: 'configuration', label: 'C', unit: '', default: 1, min: 0, max: 2, step: 1 },
  ],
  initialConditions: { switchTime: 0.5, duration: 3 },
  simulation: { timeStep: 0.001, maxDuration: 5, sampleInterval: 0.01 },
  measurements: [
    { id: 'current', label: 'I', unit: 'A', variable: 'current' },
    { id: 'energy', label: 'E', unit: 'J', variable: 'energy' },
  ],
  results: [
    {
      id: 'resistance',
      label: 'V/I',
      unit: 'Ω',
      variable: 'resistance',
      reduce: 'final',
      theory: 'equivalentResistance',
    },
    { id: 'energy', label: 'E', unit: 'J', variable: 'energy', reduce: 'final', theory: 'energy' },
    {
      id: 'peakCurrent',
      label: 'I max',
      unit: 'A',
      variable: 'current',
      reduce: 'max',
      theory: 'current',
    },
  ],
});

describe('circuit theory: Ohm’s law and the series and parallel rules', () => {
  it('gives R_eq for R1 alone, in series and in parallel (hand-computed values)', () => {
    expect(equivalentResistance(inputs(12, 100, 220, CIRCUIT_SINGLE))).toBe(100);
    expect(equivalentResistance(inputs(12, 100, 220, CIRCUIT_SERIES))).toBe(320);
    // 1/R = 1/100 + 1/220 = 0.01454545… → 68.75 Ω
    expect(equivalentResistance(inputs(12, 100, 220, CIRCUIT_PARALLEL))).toBeCloseTo(68.75, 12);
    // Two equal resistors: double in series, half in parallel.
    expect(equivalentResistance(inputs(12, 470, 470, CIRCUIT_SERIES))).toBe(940);
    expect(equivalentResistance(inputs(12, 470, 470, CIRCUIT_PARALLEL))).toBeCloseTo(235, 12);
  });

  it('predicts I = V/R_eq, P = V²/R_eq and E = P·(duration − t_s)', () => {
    const series = circuitModel.predict!(inputs(12, 100, 220, CIRCUIT_SERIES));
    expect(series.current).toBeCloseTo(0.0375, 15); // 12 V / 320 Ω
    expect(series.power).toBeCloseTo(0.45, 14); // 12 V · 0.0375 A
    expect(series.energy).toBeCloseTo(0.45 * 2.5, 14); // closed from 0.5 s to 3 s
    expect(series.voltage1).toBeCloseTo(3.75, 14); // 0.0375 A · 100 Ω
    expect(series.voltage2).toBeCloseTo(8.25, 14); // 0.0375 A · 220 Ω
    expect(series.current1).toBe(series.current2);

    const parallel = circuitModel.predict!(inputs(12, 100, 220, CIRCUIT_PARALLEL));
    expect(parallel.current1).toBeCloseTo(0.12, 15); // 12 V / 100 Ω
    expect(parallel.current2).toBeCloseTo(12 / 220, 15);
    expect(parallel.current).toBeCloseTo(12 / 68.75, 14);
    expect(parallel.power).toBeCloseTo((12 * 12) / 68.75, 13);
    expect([parallel.voltage1, parallel.voltage2]).toEqual([12, 12]);

    const single = circuitModel.predict!(inputs(6, 33, 1000, CIRCUIT_SINGLE));
    expect(single.current).toBeCloseTo(6 / 33, 15);
    expect([single.voltage2, single.current2]).toEqual([0, 0]); // R2 not connected
  });

  it('obeys Kirchhoff’s laws and conserves power in every configuration', () => {
    for (const c of [CIRCUIT_SINGLE, CIRCUIT_SERIES, CIRCUIT_PARALLEL]) {
      for (const [v, r1, r2] of [
        [12, 33, 33],
        [0.5, 1000, 33],
        [7.5, 220, 470],
      ] as const) {
        const p = circuitModel.predict!(inputs(v, r1, r2, c));
        // Each resistor obeys Ohm's law on its own.
        expect(p.voltage1).toBeCloseTo(p.current1! * r1, 12);
        if (c !== CIRCUIT_SINGLE) expect(p.voltage2).toBeCloseTo(p.current2! * r2, 12);
        if (c === CIRCUIT_SERIES) expect(p.voltage1! + p.voltage2!).toBeCloseTo(v, 12); // loop law
        if (c === CIRCUIT_PARALLEL) expect(p.current1! + p.current2!).toBeCloseTo(p.current!, 12); // junction law
        // The supply's V·I is what the resistors dissipate.
        expect(p.voltage1! * p.current1! + p.voltage2! * p.current2!).toBeCloseTo(p.power!, 12);
      }
    }
  });

  it('refuses inputs it cannot run, with the reason', () => {
    expect(() => circuitModel.predict!(inputs(12, 0, 100, 1))).toThrow(/resistance1/);
    expect(() => circuitModel.predict!(inputs(-1, 100, 100, 1))).toThrow(/voltage/);
    expect(() => circuitModel.predict!(inputs(12, 100, 100, 1.5))).toThrow(/configuration/);
    expect(() => circuitModel.predict!(inputs(12, 100, Number.NaN, 1))).toThrow(/resistance2/);
    expect(() => circuitModel.predict!({ ...inputs(12, 100, 100, 1), switchTime: 3 })).toThrow(
      /duration/,
    );
    const state = new Float64Array(circuitModel.variables.length);
    expect(() => circuitModel.init({ voltage: 12 }, state)).toThrow(/missing/);
  });
});

describe('circuit run: open, then the switch closes and the steady current flows', () => {
  it('reads 0 while open and the steady values from the instant the switch closes', () => {
    const input = inputs(12, 100, 220, CIRCUIT_PARALLEL);
    const theory = circuitModel.predict!(input);
    let closedAt = NaN;
    run(input, 0.001, (s) => {
      if (s[T]! < 0.5) {
        expect([s[SW], s[V], s[I], s[P], s[R], s[E]]).toEqual([0, 0, 0, 0, 0, 0]);
      } else {
        if (Number.isNaN(closedAt)) closedAt = s[T]!;
        expect(s[SW]).toBe(1);
        expect(s[I]).toBeCloseTo(theory.current!, 14);
        expect(s[R]).toBeCloseTo(68.75, 12); // V/I as the meters give it
        expect(s[E]).toBeCloseTo(theory.power! * (s[T]! - 0.5), 12); // E = P·(t − t_s)
        expect(s[I1]! + s[I2]!).toBeCloseTo(s[I]!, 14);
        expect([s[V1], s[V2]]).toEqual([12, 12]);
        expect(s[I1]).toBeCloseTo(0.12, 15); // 12 V / 100 Ω
        expect(s[I2]).toBeCloseTo(12 / 220, 15);
      }
    });
    expect(closedAt).toBe(0.5); // the step was shortened to land on t_s exactly
  });

  it('gives each resistor its own reading in series and with R1 alone (hand-computed)', () => {
    const series = run(inputs(12, 100, 220, CIRCUIT_SERIES));
    expect(series[I]).toBeCloseTo(0.0375, 15); // 12 V / 320 Ω
    expect(series[V1]).toBeCloseTo(3.75, 14); // 0.0375 A · 100 Ω
    expect(series[V2]).toBeCloseTo(8.25, 14); // 0.0375 A · 220 Ω
    expect([series[I1], series[I2]]).toEqual([series[I], series[I]]); // one current
    const single = run(inputs(6, 220, 470, CIRCUIT_SINGLE));
    expect(single[I]).toBeCloseTo(6 / 220, 15);
    expect([single[V1], single[I1]]).toEqual([6, single[I]]);
    expect([single[V2], single[I2]]).toEqual([0, 0]); // R2 not connected
    // Before the switch closes no resistor carries anything.
    const open = new Float64Array(circuitModel.variables.length);
    circuitModel.init(inputs(12, 100, 220, CIRCUIT_SERIES), open);
    expect([open[V1], open[V2], open[I1], open[I2]]).toEqual([0, 0, 0, 0]);
  });

  it('stops exactly at the switch and at the end, whatever the step, with the same result', () => {
    const input = inputs(9, 470, 220, CIRCUIT_SERIES);
    const reference = run(input, 0.001);
    expect(reference[T]).toBe(3);
    for (const dt of [0.0007, 0.013, 0.3, 2]) {
      const times: number[] = [];
      let previous = 0;
      const final = run(input, dt, (s, h) => {
        expect(h).toBeGreaterThan(0);
        // h is the time the clock moved; a snap onto t_s or the end adds at most 1e-12 s.
        expect(h).toBeLessThanOrEqual(dt + 1e-12);
        expect(s[T]).toBeCloseTo(previous + h, 14); // to the rounding of t + (next − t)
        previous = s[T]!;
        times.push(s[T]!);
      });
      expect(times).toContain(0.5);
      expect(final[T]).toBe(3);
      expect(Math.abs(final[E]! - reference[E]!)).toBeLessThan(1e-12);
      expect([...final].slice(SW, E)).toEqual([...reference].slice(SW, E));
      expect([...final].slice(V1)).toEqual([...reference].slice(V1));
    }
  });

  it('returns the time the clock really moved when a step snaps onto t_s', () => {
    const input = inputs(9, 470, 220, CIRCUIT_SERIES);
    const state = new Float64Array(circuitModel.variables.length);
    circuitModel.init(input, state);
    const before = 0.499 - 5e-13; // one 1 ms step ends 5e-13 s short of t_s = 0.5: it snaps
    state[T] = before;
    const h = circuitModel.step(state, 0.001, input);
    expect(state[T]).toBe(0.5);
    expect(h).toBe(0.5 - before);
  });

  it('is deterministic: the same inputs give the same states bit for bit', () => {
    const input = inputs(4.5, 330, 680, CIRCUIT_PARALLEL);
    expect([...run(input, 0.004)]).toEqual([...run(input, 0.004)]);
  });

  it('runs closed from the start when t_s = 0, and at 0 V reads 0 Ω, never 0/0', () => {
    const now = { ...inputs(6, 100, 100, CIRCUIT_SERIES), switchTime: 0 };
    const state = new Float64Array(circuitModel.variables.length);
    circuitModel.init(now, state);
    expect(state[SW]).toBe(1);
    expect(state[I]).toBeCloseTo(0.03, 15);
    const off = run(inputs(0, 100, 100, CIRCUIT_SERIES));
    expect([...off].every(Number.isFinite)).toBe(true);
    expect([off[I], off[R], off[E]]).toEqual([0, 0, 0]);
  });

  it('through the runtime: ends by itself, its results equal the theory', () => {
    for (const c of [CIRCUIT_SINGLE, CIRCUIT_SERIES, CIRCUIT_PARALLEL]) {
      const r = new ExperimentRuntime('test', definition, circuitModel, { configuration: c });
      r.runToCompletion();
      const theory = r.theory()!;
      expect(r.endReason).toBe('model');
      expect(r.time).toBeCloseTo(3, 9);
      expect(r.results!.resistance).toBeCloseTo(theory.equivalentResistance!, 9);
      expect(r.results!.energy).toBeCloseTo(theory.energy!, 9);
      expect(r.results!.peakCurrent).toBeCloseTo(theory.current!, 12);
      const current = r.sampleValues[0]!;
      expect(current[0]).toBe(0); // the switch is open when the run starts
      expect(current[r.sampleCount - 1]).toBeCloseTo(theory.current!, 12);
    }
  });

  it('across runs, V against I is a line through the origin whose slope is R_eq', () => {
    for (const c of [CIRCUIT_SINGLE, CIRCUIT_SERIES, CIRCUIT_PARALLEL]) {
      const points = [1.5, 3, 4.5, 6, 9, 12].map((volts) => {
        const r = new ExperimentRuntime('test', definition, circuitModel, {
          voltage: volts,
          configuration: c,
        });
        r.runToCompletion();
        return [r.results!.peakCurrent!, volts] as const;
      });
      // Least squares y = a·x + b, written out here.
      const n = points.length;
      const sx = points.reduce((s, [x]) => s + x, 0);
      const sy = points.reduce((s, [, y]) => s + y, 0);
      const sxx = points.reduce((s, [x]) => s + x * x, 0);
      const sxy = points.reduce((s, [x, y]) => s + x * y, 0);
      const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const b = (sy - a * sx) / n;
      const expected = [100, 320, 68.75][c]!;
      expect(a).toBeCloseTo(expected, 8);
      expect(Math.abs(b)).toBeLessThan(1e-9);
    }
  });
});
