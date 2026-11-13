import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { type ExperimentDefinition, ExperimentDefinitionSchema, READING_UNITS } from './experiment';
import { checkExperimentAgainstModel } from './ExperimentRuntime';
import { ExperimentSession } from './ExperimentSession';
import {
  decimals,
  formatUncertainty,
  quantize,
  readings,
  resolutionBound,
  resolutionUncertainty,
} from './measurement';
import { pendulumModel } from './models/pendulum';
import { projectileModel } from './models/projectile';
import type { RunData } from './RunRecord';

const parse = (id: string): ExperimentDefinition =>
  ExperimentDefinitionSchema.parse(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === id),
  );
const projectile = parse('projectile-motion');
const pendulum = parse('pendulum');

/** A station's session with one run per entry of `settings`, finished (or stopped after `stopAfter` s). */
function station(
  definition: ExperimentDefinition,
  settings: Record<string, number>[],
  apparatus: Record<string, number>,
  stopAfter?: number,
) {
  const model = definition.id === 'pendulum' ? pendulumModel : projectileModel;
  const s = new ExperimentSession('station', definition, model);
  s.setReady(true);
  for (const values of settings) {
    if (s.run) s.reset();
    for (const [id, value] of Object.entries(values)) expect(s.setParameter(id, value)).toBeNull();
    s.start(apparatus);
    if (stopAfter !== undefined) {
      s.advance(stopAfter);
      s.stop();
    }
    for (let i = 0; s.state === 'running' && i < 100_000; i++) s.advance(1 / 60);
  }
  return s;
}

describe('an instrument reading (quantize)', () => {
  it('is the nearest multiple of the resolution d', () => {
    expect(quantize(6.524377, 0.01)).toBe(6.52);
    expect(quantize(6.524377, 0.001)).toBe(6.524);
    expect(quantize(6.524377, 0.1)).toBe(6.5);
    expect(quantize(2.0409746, 0.01)).toBe(2.04);
    expect(quantize(7, 5)).toBe(5);
    expect(quantize(8, 5)).toBe(10);
    expect(quantize(0.37, 0.25)).toBe(0.25);
    expect(quantize(0.38, 0.25)).toBe(0.5);
  });

  it('reads an exact multiple as itself, the double of the decimal shown', () => {
    expect(0.3 / 0.1).toBe(2.9999999999999996); // what naive arithmetic would start from
    expect(3 * 0.1).toBe(0.30000000000000004);
    expect(quantize(0.3, 0.1)).toBe(0.3);
    for (const d of [0.001, 0.01, 0.1, 0.25, 0.5, 1, 5]) {
      for (let k = -1000; k <= 1000; k += 7) {
        const multiple = Number((k * d).toFixed(decimals(d)));
        expect(quantize(multiple, d)).toBe(multiple);
      }
    }
  });

  it('reads just below half-way down and just above it up', () => {
    expect(quantize(6.5249, 0.01)).toBe(6.52);
    expect(quantize(6.52499999, 0.01)).toBe(6.52); // a millionth of a step below
    expect(quantize(6.5251, 0.01)).toBe(6.53);
    expect(quantize(6.52500001, 0.01)).toBe(6.53);
    expect(quantize(0.0049999, 0.01)).toBe(0);
    expect(quantize(0.0050001, 0.01)).toBe(0.01);
  });

  it('reads half-way away from zero, also where binary rounding hides the tie', () => {
    expect(quantize(2.5, 1)).toBe(3); // not to even
    expect(quantize(0.5, 1)).toBe(1);
    expect(quantize(6.535, 0.01)).toBe(6.54);
    expect(1.005 / 0.01).toBe(100.49999999999999); // 1.005 is stored as 1.00499999…
    expect(quantize(1.005, 0.01)).toBe(1.01);
    expect(quantize(1.0005, 0.001)).toBe(1.001);
  });

  it('is symmetric for negative values', () => {
    expect(quantize(-6.524377, 0.01)).toBe(-6.52);
    expect(quantize(-1.005, 0.01)).toBe(-1.01);
    expect(quantize(-2.5, 1)).toBe(-3);
    for (const v of [0.0004, 0.005, 0.37, 1.005, 6.525, 123.456]) {
      expect(quantize(-v, 0.01) + quantize(v, 0.01)).toBe(0); // (0.0004 reads 0 both ways)
    }
  });

  it('reads 0, and anything within half a step of it, as 0, never −0', () => {
    expect(Object.is(quantize(0, 0.01), 0)).toBe(true);
    expect(Object.is(quantize(-0, 0.01), 0)).toBe(true);
    expect(Object.is(quantize(-0.004, 0.01), 0)).toBe(true);
    expect(quantize(0.004, 0.01)).toBe(0);
    expect(quantize(-0.005, 0.01)).toBe(-0.01);
    expect(quantize(1e-300, 0.001)).toBe(0);
  });

  it('rejects a resolution that is zero, negative or not finite', () => {
    for (const d of [0, -0, -0.01, NaN, Infinity, -Infinity]) {
      expect(() => quantize(1, d)).toThrow(RangeError);
      expect(() => resolutionUncertainty(d)).toThrow(RangeError);
      expect(() => resolutionBound(d)).toThrow(RangeError);
      expect(() => decimals(d)).toThrow(RangeError);
    }
  });

  it('rejects what it cannot read: NaN, ±Infinity, more steps than a double counts exactly', () => {
    for (const v of [NaN, Infinity, -Infinity]) expect(() => quantize(v, 0.01)).toThrow(RangeError);
    expect(() => quantize(1e17, 1)).toThrow(RangeError);
    expect(() => quantize(1e300, 1e-300)).toThrow(RangeError);
    expect(quantize(9e15, 1)).toBe(9e15); // still exact
  });

  it('counts the decimal places of a resolution as written', () => {
    expect([0.001, 0.01, 0.1, 0.25, 0.5, 1, 5, 100].map(decimals)).toEqual([
      3, 2, 1, 2, 1, 0, 0, 0,
    ]);
    expect(decimals(1e-7)).toBe(7);
    expect(decimals(1.5e-7)).toBe(8);
    expect(decimals(1e21)).toBe(0);
  });
});

describe('uncertainty from the resolution', () => {
  it('is d/√12, the spread of a rounding error equally likely anywhere in ±d/2; d/2 bounds it', () => {
    expect(resolutionUncertainty(0.01)).toBe(0.01 / Math.sqrt(12));
    expect(resolutionUncertainty(0.01)).toBeCloseTo(0.0028867513459481, 15); // √(1/12) / 100
    expect(resolutionBound(0.01)).toBe(0.005);
    // Independent reference: the actual rounding errors of values spread evenly over one step.
    for (const d of [0.001, 0.01, 0.1, 0.25]) {
      const n = 100_000;
      let squares = 0;
      let worst = 0;
      for (let k = 0; k < n; k++) {
        const value = 3 + ((k + 0.5) / n) * d;
        const error = quantize(value, d) - value;
        squares += error * error;
        worst = Math.max(worst, Math.abs(error));
      }
      expect(Math.abs(Math.sqrt(squares / n) / resolutionUncertainty(d) - 1)).toBeLessThan(1e-6);
      expect(worst).toBeLessThanOrEqual(resolutionBound(d) * (1 + 1e-9));
      expect(worst).toBeGreaterThan(resolutionBound(d) * 0.9999);
    }
  });

  it('stays positive and proportional to d down to tiny resolutions', () => {
    expect(resolutionUncertainty(1e-12) / 1e-12).toBeCloseTo(1 / Math.sqrt(12), 15);
    expect(resolutionBound(1e-12)).toBe(5e-13);
  });

  it('is reported to two significant digits', () => {
    expect(formatUncertainty(resolutionUncertainty(0.001))).toBe('0.00029');
    expect(formatUncertainty(resolutionUncertainty(0.01))).toBe('0.0029');
    expect(formatUncertainty(resolutionUncertainty(0.1))).toBe('0.029');
    expect(formatUncertainty(0.000999)).toBe('0.0010'); // rounding up a decade keeps two digits
    expect(formatUncertainty(0.0995)).toBe('0.10');
    expect(formatUncertainty(9.96)).toBe('10');
    expect(formatUncertainty(288.67)).toBe('290'); // never "2.9e+2"
    expect(formatUncertainty(2.9e-7)).toBe('0.00000029');
    for (const u of [0, -0.1, NaN, Infinity])
      expect(() => formatUncertainty(u)).toThrow(RangeError);
  });
});

describe('readings of a run', () => {
  it('reads the projectile range from the run itself; the simulated range stays unrounded', () => {
    const s = station(projectile, [{ velocity: 8 }], { height: 0.59 });
    const record = s.history[0]!;
    const range = record.results?.range ?? NaN;
    expect(range % 0.01).not.toBe(0); // a value the reading must round
    const [reading, ...others] = readings(projectile, record);
    expect(others).toEqual([]);
    expect(reading).toEqual({
      result: 'range',
      quantity: 'Range R',
      instrument: 'Tape measure',
      unit: 'm',
      resolution: 0.01,
      simulated: range,
      reading: quantize(range, 0.01),
      text: quantize(range, 0.01).toFixed(2),
      uncertainty: 0.01 / Math.sqrt(12),
      bound: 0.005,
      excludes: projectile.instruments[0]?.excludes,
    });
    expect(reading?.excludes).toContain('where the ball landed');
    expect(Math.abs((reading?.reading ?? NaN) - range)).toBeLessThanOrEqual(0.005);
    expect(record.results?.range).toBe(range); // nothing written back
    expect(readings(projectile, s.run!)).toEqual(readings(projectile, record)); // live run alike
  });

  it('reads the pendulum period once, in seconds, whichever theory it is compared with', () => {
    const s = station(pendulum, [{ angle: 30, resolution: 0.001 }], { mass: 0.5 });
    const record = s.history[0]!;
    const list = readings(pendulum, record);
    expect(list.map((r) => [r.result, r.quantity, r.unit, r.resolution])).toEqual([
      ['period', 'Period T', 's', 0.001],
    ]);
    // The simulated period equals the exact theory far below d; the small-angle one does not.
    const period = record.results?.period ?? NaN;
    expect(list[0]?.reading).toBe(quantize(record.theory()?.period ?? NaN, 0.001));
    expect(Math.abs(period - (record.theory()?.smallAnglePeriod ?? NaN))).toBeGreaterThan(0.03);
  });

  it('keeps each record’s own resolution, frozen: later dials change no reading', () => {
    const s = station(projectile, [{ resolution: 0.1 }], { height: 0.59 });
    const record = s.history[0]!;
    const before = readings(projectile, record);
    s.reset();
    expect(s.setParameter('resolution', 0.001)).toBeNull();
    expect(Object.isFrozen(record.inputs)).toBe(true);
    expect(() => {
      (record.inputs as Record<string, number>).resolution = 0.001;
    }).toThrow(TypeError);
    expect(record.inputs.resolution).toBe(0.1);
    expect(readings(projectile, record)).toEqual(before);
    expect(before[0]?.resolution).toBe(0.1);
  });

  it('compares runs at two resolutions: the same physics, each with its own reading and u', () => {
    for (const [definition, apparatus, result] of [
      [projectile, { height: 0.59 }, 'range'],
      [pendulum, { mass: 0.5 }, 'period'],
    ] as const) {
      const s = station(definition, [{ resolution: 0.1 }, { resolution: 0.001 }], apparatus);
      const [coarse, fine] = s.history;
      // The resolution reaches the run's inputs, never the model: identical motion and results.
      expect(fine?.sampleTimes).toEqual(coarse?.sampleTimes);
      expect(fine?.sampleValues).toEqual(coarse?.sampleValues);
      expect(fine?.results).toEqual(coarse?.results);
      expect(fine?.theory()).toEqual(coarse?.theory());
      expect(fine?.time).toBe(coarse?.time);
      const [a] = readings(definition, coarse!);
      const [b] = readings(definition, fine!);
      expect(a?.simulated).toBe(b?.simulated);
      expect([a?.result, b?.result]).toEqual([result, result]);
      expect([a?.resolution, b?.resolution]).toEqual([0.1, 0.001]);
      expect((a?.uncertainty ?? NaN) / (b?.uncertainty ?? NaN)).toBeCloseTo(100, 12);
      expect(a?.text).toBe(quantize(a?.simulated ?? NaN, 0.1).toFixed(1));
      expect(b?.text).toBe(quantize(b?.simulated ?? NaN, 0.001).toFixed(3));
    }
  });

  it('has none for an incomplete run: stopped, failed or still running', () => {
    const s = station(pendulum, [{}], { mass: 0.5 }, 0.5);
    expect(s.history[0]?.status).toBe('stopped');
    expect(readings(pendulum, s.history[0]!)).toEqual([]);
    s.reset();
    s.start({ mass: 0.5 });
    s.advance(0.2);
    expect(s.run?.status).toBe('running');
    expect(readings(pendulum, s.run!)).toEqual([]);
    // The rule itself, not just missing data: a run that did not complete is never read.
    const done = station(pendulum, [{}], { mass: 0.5 }).history[0]!;
    for (const status of ['stopped', 'failed', 'running'] as const) {
      expect(readings(pendulum, { ...done, status })).toEqual([]);
    }
    expect(readings(pendulum, done)).toHaveLength(1);
  });

  it('never lets the model read an instrument’s resolution', () => {
    expect(checkExperimentAgainstModel(projectile, projectileModel)).toEqual([]);
    const reading = { ...projectileModel, inputs: [...projectileModel.inputs, 'resolution'] };
    expect(checkExperimentAgainstModel(projectile, reading)).toEqual([
      'instrument resolution "resolution" is a model input: it would change the run',
    ]);
  });
});

describe('the units instruments read', () => {
  /** An experiment whose one instrument reads result `q`, in `unit`, to the resolution d. */
  const meter = (unit: string) =>
    ExperimentDefinitionSchema.safeParse({
      id: 'meter',
      name: 'Meter',
      category: 'chemistry',
      model: 'any',
      parameters: [{ id: 'd', label: 'Resolution', unit, default: 0.01, min: 0.001, max: 0.1 }],
      simulation: { timeStep: 0.01, maxDuration: 1, sampleInterval: 0.1 },
      measurements: [{ id: 'q', label: 'Q', unit, variable: 'q' }],
      results: [{ id: 'q', label: 'Q', unit, variable: 'q', reduce: 'final' }],
      instruments: [{ result: 'q', quantity: 'Q', name: 'Meter', resolution: 'd', excludes: 'x' }],
    });

  it.each(READING_UNITS)(
    'reads %s on a linear scale: the nearest multiple of d, u = d/√12',
    (unit) => {
      const parsed = meter(unit);
      expect(parsed.error?.issues).toBeUndefined();
      const run = { status: 'completed', results: { q: 7.0349 }, inputs: { d: 0.01 } };
      expect(readings(parsed.data!, run as unknown as RunData)).toMatchObject([
        { unit, reading: 7.03, text: '7.03', uncertainty: 0.01 / Math.sqrt(12), bound: 0.005 },
      ]);
    },
  );

  it('reads no other unit: no linear scale is known for it', () => {
    expect(meter('rad').error?.issues.map((i) => i.message)).toEqual([
      `cannot read "rad": instruments read ${READING_UNITS.join(', ')}`,
    ]);
  });
});
