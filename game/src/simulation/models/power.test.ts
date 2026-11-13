import { describe, expect, it } from 'vitest';
import { ExperimentDefinitionSchema } from '../experiment';
import { ExperimentRuntime } from '../ExperimentRuntime';
import { fitLine } from '../fit';
import { CIRCUIT_PARALLEL, CIRCUIT_SERIES, CIRCUIT_SINGLE, circuitModel } from './circuit';
import { powerModel } from './power';

const slot = (id: string) => powerModel.variables.indexOf(id);
const CLOCK = slot('clock');
const SWITCH = slot('switch');
const U = slot('voltage');
const I = slot('current');
const P = slot('power');
const P1 = slot('power1');
const P2 = slot('power2');
const U2 = slot('voltageSquared');
const LARGER = slot('largerPower');

const R1 = 10;
const R2 = 20;

const inputsOf = (change: Record<string, number> = {}) => ({
  voltage: 12,
  resistance1: R1,
  resistance2: R2,
  configuration: CIRCUIT_SERIES,
  switchTime: 0.5,
  duration: 3,
  ...change,
});

/** The model alone, stepped by `dt` s until it says it is done; `each` sees the state. */
function run(inputs: Record<string, number>, dt = 0.001, each?: (s: Float64Array) => void) {
  const state = new Float64Array(powerModel.variables.length);
  powerModel.init(inputs, state);
  let runTime = 0;
  for (let n = 0; n < 1e7 && !powerModel.isComplete!(state, inputs); n++) {
    runTime += powerModel.step(state, dt, inputs);
    each?.(state);
  }
  return { state, runTime };
}

describe('power theory: P = U·I in the network the circuit model solves', () => {
  it('gives the hand-worked powers for 12 V with R1 = 10 Ω and R2 = 20 Ω', () => {
    const at = (configuration: number) => powerModel.predict!(inputsOf({ configuration }));
    // R1 alone: I = 12/10 = 1.2 A, P = 12 × 1.2 = 14.4 W, all in R1.
    const single = at(CIRCUIT_SINGLE);
    expect(single.current).toBeCloseTo(1.2, 14);
    expect(single.power1).toBeCloseTo(14.4, 13);
    expect(single.power2).toBe(0);
    // Series: I = 12/30 = 0.4 A; P1 = 0.4² × 10 = 1.6 W, P2 = 0.4² × 20 = 3.2 W, P = 4.8 W.
    const series = at(CIRCUIT_SERIES);
    expect(series.current).toBeCloseTo(0.4, 14);
    expect(series.power).toBeCloseTo(4.8, 13);
    expect(series.power1).toBeCloseTo(1.6, 13);
    expect(series.power2).toBeCloseTo(3.2, 13);
    // Parallel: P1 = 12²/10 = 14.4 W, P2 = 12²/20 = 7.2 W; I = 1.2 + 0.6 = 1.8 A, P = 21.6 W.
    const parallel = at(CIRCUIT_PARALLEL);
    expect(parallel.current).toBeCloseTo(1.8, 13);
    expect(parallel.power).toBeCloseTo(21.6, 12);
    expect(parallel.power1).toBeCloseTo(14.4, 12);
    expect(parallel.power2).toBeCloseTo(7.2, 12);
  });

  it('keeps P = U·I = I²·R_eq = U²/R_eq = P1 + P2 for every preset', () => {
    for (const voltage of [3, 6, 9, 12]) {
      for (const configuration of [CIRCUIT_SINGLE, CIRCUIT_SERIES, CIRCUIT_PARALLEL]) {
        const t = powerModel.predict!(inputsOf({ voltage, configuration }));
        const r = t.equivalentResistance!;
        expect(t.power).toBeCloseTo(voltage * t.current!, 12);
        expect(t.power).toBeCloseTo(t.current! ** 2 * r, 12);
        expect(t.power).toBeCloseTo(t.power1! + t.power2!, 12);
        expect(t.voltageSquared).toBe(voltage * voltage);
        expect(t.conductance).toBeCloseTo(1 / r, 15);
      }
    }
  });

  it('gives the larger resistance more power in series and the smaller in parallel', () => {
    const series = powerModel.predict!(inputsOf({ configuration: CIRCUIT_SERIES }));
    const parallel = powerModel.predict!(inputsOf({ configuration: CIRCUIT_PARALLEL }));
    expect(series.power2! / series.power1!).toBeCloseTo(R2 / R1, 12); // one current: P ∝ R
    expect(parallel.power1! / parallel.power2!).toBeCloseTo(R2 / R1, 12); // one voltage: P ∝ 1/R
    expect([series.largerPower, parallel.largerPower]).toEqual([-1, 1]);
    const single = powerModel.predict!(inputsOf({ configuration: CIRCUIT_SINGLE }));
    expect(single.largerPower).toBe(1);
    const same = powerModel.predict!(inputsOf({ resistance2: R1 }));
    expect(same.largerPower).toBe(0);
  });

  it('quadruples the power when the voltage doubles: P ∝ U² for one circuit', () => {
    const at = (voltage: number) => powerModel.predict!(inputsOf({ voltage })).power!;
    expect(at(12) / at(6)).toBeCloseTo(4, 12);
    expect(at(9) / at(3)).toBeCloseTo(9, 12);
  });

  it('fits the analyses’ lines: P against I at one U, P against U² for one circuit', () => {
    const fitted = (points: { x: number; y: number }[]) => {
      const fit = fitLine(points);
      if (fit.status !== 'fitted') throw new Error('no line');
      return fit;
    };
    // At one supply voltage, the three circuits: P = U·I, slope U.
    const atU = [0, 1, 2].map((configuration) =>
      powerModel.predict!(inputsOf({ voltage: 9, configuration })),
    );
    const pi = fitted(atU.map((t) => ({ x: t.current!, y: t.power! })));
    expect(pi.slope).toBeCloseTo(9, 12);
    expect(pi.intercept).toBeCloseTo(0, 12);
    // One circuit, four voltages: P = U²/R_eq, slope 1/R_eq = 1/30 S.
    const series = [3, 6, 9, 12].map((voltage) => powerModel.predict!(inputsOf({ voltage })));
    const pu = fitted(series.map((t) => ({ x: t.voltageSquared!, y: t.power! })));
    expect(pu.slope).toBeCloseTo(1 / 30, 14);
    expect(pu.slope).toBeCloseTo(series[0]!.conductance!, 14);
  });
});

describe('power run: the circuit stepped as it is, the powers derived from it', () => {
  it('advances the circuit’s own variables exactly as the circuit model does', () => {
    const inputs = inputsOf({ configuration: CIRCUIT_PARALLEL });
    const circuit = new Float64Array(circuitModel.variables.length);
    circuitModel.init(inputs, circuit);
    const n = circuitModel.variables.length;
    expect(powerModel.variables.slice(0, n)).toEqual(circuitModel.variables);
    run(inputs, 0.001, (s) => {
      circuitModel.step(circuit, 0.001, inputs);
      expect(Array.from(s.subarray(0, n))).toEqual(Array.from(circuit));
    });
  });

  it('keeps every sample at P = U·I = P1 + P2: 0 while K is open, the theory once it closes', () => {
    for (const configuration of [CIRCUIT_SINGLE, CIRCUIT_SERIES, CIRCUIT_PARALLEL]) {
      const inputs = inputsOf({ configuration });
      const theory = powerModel.predict!(inputs);
      let landed = false;
      run(inputs, 0.007, (s) => {
        expect(s[P]).toBe(s[U]! * s[I]!);
        expect(s[P]!).toBeCloseTo(s[P1]! + s[P2]!, 12);
        expect(s[U2]).toBe(s[U]! * s[U]!);
        if (s[CLOCK]! < 0.5) expect([s[P1], s[P2], s[LARGER]]).toEqual([0, 0, 0]);
        if (s[CLOCK] === 0.5) landed = s[SWITCH] === 1 && s[P1] === theory.power1;
      });
      expect(landed).toBe(true);
    }
  });

  it('ends at the duration whatever the step, with the theory’s powers', () => {
    const inputs = inputsOf({ configuration: CIRCUIT_PARALLEL });
    const theory = powerModel.predict!(inputs);
    for (const dt of [0.001, 0.01, 0.033, 0.1, 1]) {
      const { state, runTime } = run(inputs, dt);
      expect(state[CLOCK]).toBe(3);
      expect(runTime).toBeCloseTo(3, 9);
      expect(state[P]).toBeCloseTo(theory.power!, 12);
      expect(state[P1]).toBeCloseTo(theory.power1!, 12);
      expect(state[P2]).toBeCloseTo(theory.power2!, 12);
      expect(state[LARGER]).toBe(theory.largerPower);
    }
    const { state } = run(inputs);
    expect(powerModel.step(state, 0.01, inputs)).toBe(0); // nothing after the end
  });

  it('is deterministic: two runs give the same bits', () => {
    const a = run(inputsOf({ configuration: CIRCUIT_PARALLEL }), 0.013).state;
    const b = run(inputsOf({ configuration: CIRCUIT_PARALLEL }), 0.013).state;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('takes no power at 0 V, and none in R2 when R1 is alone', () => {
    const off = run(inputsOf({ voltage: 0 })).state;
    expect([off[P], off[P1], off[P2], off[LARGER]]).toEqual([0, 0, 0, 0]);
    const single = run(inputsOf({ configuration: CIRCUIT_SINGLE })).state;
    expect(single[P2]).toBe(0);
  });
});

describe('power inputs: the circuit’s, refused with its reasons, never clamped', () => {
  it('passes the circuit’s own refusals through', () => {
    const state = new Float64Array(powerModel.variables.length);
    const missing: Record<string, number> = inputsOf();
    delete missing.resistance2;
    expect(() => powerModel.init(missing, state)).toThrow(/"resistance2" is missing/);
    expect(() => powerModel.predict!(inputsOf({ voltage: -1 }))).toThrow(/Circuit input "voltage"/);
    expect(() => powerModel.predict!(inputsOf({ voltage: NaN }))).toThrow(/voltage/);
    expect(() => powerModel.predict!(inputsOf({ configuration: 3 }))).toThrow(/configuration/);
    expect(() => powerModel.predict!(inputsOf({ duration: 0.5 }))).toThrow(/duration/);
    expect(powerModel.inputs).toEqual(circuitModel.inputs); // no constant of its own
  });
});

describe('power in the experiment runtime', () => {
  const definition = ExperimentDefinitionSchema.parse({
    id: 'power-test',
    name: 'Power',
    category: 'physics',
    model: 'electric.power',
    parameters: [
      { id: 'voltage', label: 'U', unit: 'V', default: 12, min: 3, max: 12 },
      { id: 'configuration', label: 'C', unit: '', default: 1, min: 0, max: 2, step: 1 },
    ],
    initialConditions: { resistance1: R1, resistance2: R2, switchTime: 0.5, duration: 3 },
    simulation: { timeStep: 0.001, maxDuration: 5, sampleInterval: 0.01 },
    measurements: [{ id: 'power', label: 'P', unit: 'W', variable: 'power' }],
    results: [
      { id: 'power', label: 'P', unit: 'W', variable: 'power', reduce: 'final', theory: 'power' },
      {
        id: 'power2',
        label: 'P2',
        unit: 'W',
        variable: 'power2',
        reduce: 'final',
        theory: 'power2',
      },
    ],
  });

  it('ends by itself at 3 s for every preset, with the theory’s results', () => {
    for (const voltage of [3, 6, 9, 12]) {
      for (const configuration of [0, 1, 2]) {
        const r = new ExperimentRuntime('t', definition, powerModel, { voltage, configuration });
        r.runToCompletion();
        expect([r.status, r.endReason]).toEqual(['completed', 'model']);
        expect(r.time).toBeCloseTo(3, 9);
        const theory = r.theory()!;
        expect(r.results!.power).toBeCloseTo(theory.power!, 12);
        expect(r.results!.power).toBeCloseTo(voltage * theory.current!, 12);
        expect(r.results!.power2).toBeCloseTo(theory.power2!, 12);
      }
    }
  });
});
