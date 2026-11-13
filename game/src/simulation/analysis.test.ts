import { describe, expect, it } from 'vitest';
import { bundledContent } from '../content';
import { analysisCsv, analysisFileName } from './csv';
import { analysisColumns, analysisRows, fitLine, type LineFit, theoryValue } from './analysis';
import { type ExperimentDefinition, ExperimentDefinitionSchema } from './experiment';
import { ExperimentRuntime } from './ExperimentRuntime';
import { springModel } from './models/spring';
import { recordRun, type RunRecord } from './RunRecord';

const fitted = (fit: LineFit) => {
  if (fit.status !== 'fitted') throw new Error(`no line: ${fit.status}`);
  return fit;
};

describe('fitLine: ordinary least squares, y = a·x + b', () => {
  it('recovers an exact line, its intercept free, R² = 1 and no residual', () => {
    const fit = fitted(fitLine([0.1, 0.2, 0.3, 0.4].map((x) => ({ x, y: 20 * x + 0.5 }))));
    expect(fit.n).toBe(4);
    expect(fit.slope).toBeCloseTo(20, 10);
    expect(fit.intercept).toBeCloseTo(0.5, 10); // not forced through 0
    expect(fit.sse).toBeCloseTo(0, 20);
    expect(fit.r2).toBeCloseTo(1, 12);
    expect(fit.slopeError).toBeCloseTo(0, 8);
    expect([fit.xMin, fit.xMax]).toEqual([0.1, 0.4]);
  });

  it('matches a fit worked by hand: slope, intercept, SSE, R² and the slope’s standard error', () => {
    // x̄ = 2, ȳ = 3; Sxx = 2, Sxy = 3, Syy = 14/3 → a = 1.5, b = 0, SSE = 14/3 − 4.5 = 1/6.
    const fit = fitted(
      fitLine([
        { x: 1, y: 4 / 3 },
        { x: 2, y: 10 / 3 },
        { x: 3, y: 13 / 3 },
      ]),
    );
    expect(fit.slope).toBeCloseTo(1.5, 12);
    expect(fit.intercept).toBeCloseTo(0, 12);
    expect(fit.sse).toBeCloseTo(1 / 6, 12);
    expect(fit.r2).toBeCloseTo(1 - 1 / 6 / (14 / 3), 12);
    expect(fit.slopeError).toBeCloseTo(Math.sqrt(1 / 6 / 1 / 2), 12); // √(SSE/(n−2)/Sxx)
  });

  it('fits nothing through fewer than 2 points', () => {
    expect(fitLine([])).toEqual({ status: 'too-few', n: 0 });
    expect(fitLine([{ x: 1, y: 2 }])).toEqual({ status: 'too-few', n: 1 });
  });

  it('fits nothing when every x is the same, even up to rounding of the mean', () => {
    expect(
      fitLine([
        { x: 0.1, y: 1 },
        { x: 0.1, y: 2 },
        { x: 0.1, y: 3 },
      ]),
    ).toEqual({
      status: 'same-x',
      n: 3,
    });
    expect(
      fitLine([
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ]).status,
    ).toBe('same-x');
  });

  it('leaves out points that are not finite, and fits the rest', () => {
    const fit = fitted(
      fitLine([
        { x: 1, y: 2 },
        { x: NaN, y: 5 },
        { x: 2, y: Infinity },
        { x: 3, y: 6 },
      ]),
    );
    expect(fit.n).toBe(2);
    expect(fit.slope).toBeCloseTo(2, 12);
    expect(fit.intercept).toBeCloseTo(0, 12);
    expect(
      fitLine([
        { x: NaN, y: NaN },
        { x: 1, y: 1 },
      ]),
    ).toEqual({ status: 'too-few', n: 1 });
  });

  it('two points: a line through both, R² = 1 and no standard error — no evidence either way', () => {
    const fit = fitted(
      fitLine([
        { x: 1, y: 3 },
        { x: 3, y: 7 },
      ]),
    );
    expect(fit.slope).toBeCloseTo(2, 12);
    expect(fit.intercept).toBeCloseTo(1, 12);
    expect(fit.r2).toBeCloseTo(1, 12);
    expect(fit.slopeError).toBeNull();
  });

  it('leaves R² undefined when every y is the same, rather than inventing one', () => {
    const fit = fitted(
      fitLine([
        { x: 1, y: 5 },
        { x: 2, y: 5 },
        { x: 3, y: 5 },
      ]),
    );
    expect(fit.slope).toBeCloseTo(0, 12);
    expect(fit.r2).toBeNull();
  });

  it('stays exact far from the origin: means first, no cancellation', () => {
    const fit = fitted(fitLine([1e6, 1e6 + 1, 1e6 + 2].map((x) => ({ x, y: 3 * x - 7 }))));
    expect(fit.slope).toBeCloseTo(3, 6);
    expect(fit.intercept).toBeCloseTo(-7, 0);
    expect(fit.r2).toBeCloseTo(1, 9);
  });
});

// Hooke's law, from real runs of the shipped experiment and model.
const definition: ExperimentDefinition = ExperimentDefinitionSchema.parse(
  (bundledContent.experiments as { id: string }[]).find((e) => e.id === 'hookes-law'),
);
const G = 9.81;
let sequence = 0;
/** A run as the station makes one; held at rest (y₀ = 0) unless a start is given. */
const runOf = (
  mass: number,
  stiffness: number,
  { offset = 0, damping = 0.1, def = definition } = {},
): RunRecord => {
  const r = new ExperimentRuntime(`spring#${++sequence}`, def, springModel, {
    mass,
    stiffness,
    offset,
    damping,
    naturalLength: 0.2,
  });
  r.runToCompletion();
  return recordRun(r, 'physics-lab/spring', sequence);
};
const hooke = definition.analyses.find((a) => a.id === 'hooke')!;
const period = definition.analyses.find((a) => a.id === 'period')!;

describe('Hooke analysis: one point per completed run, F = m·g against Δl at rest', () => {
  it('maps each run from its own record: m, m·g, L₀, L, Δl and its own m·g/Δl', () => {
    const record = runOf(0.5, 20);
    const [row] = analysisRows(definition, hooke, [record]);
    expect(analysisColumns(definition, hooke).map((c) => `${c.symbol} (${c.unit})`)).toEqual([
      'm (kg)',
      'm·g (N)',
      'L₀ (m)',
      'L (m)',
      'Δl (m)',
      'm·g/Δl (N/m)',
    ]);
    const results = record.status === 'completed' ? record.results : {};
    expect(row?.cells).toEqual([
      0.5,
      results.load,
      0.2,
      results.length,
      results.extension,
      results.stiffness,
    ]);
    expect(row?.y).toBeCloseTo(0.5 * G, 12); // F = m·g, the weight
    expect(row?.x).toBe(results.extension); // Δl at rest, from the record
    expect(row?.group).toEqual([20]);
    expect(row?.invalid).toBeNull();
  });

  it('keeps springs apart: each group is fitted alone, its slope near its own k', () => {
    const records = [runOf(0.2, 20), runOf(0.5, 50), runOf(0.3, 20), runOf(1, 50), runOf(0.5, 20)];
    const rows = analysisRows(definition, hooke, records);
    for (const k of [20, 50]) {
      const group = rows.filter((r) => r.groupKey === String(k));
      const fit = fitted(fitLine(group));
      expect(fit.n).toBe(k === 20 ? 3 : 2);
      expect(Math.abs(fit.slope / k - 1)).toBeLessThan(5e-3);
      expect(theoryValue(group, hooke.slope.theory)).toBe(k);
    }
    // Both springs in one line would be wrong; their theories disagree, so there is none to show.
    expect(theoryValue(rows, hooke.slope.theory)).toBeNull();
  });

  it('tells the slope k_exp apart from each run’s m·g/Δl and from the model’s k', () => {
    const rows = analysisRows(definition, hooke, [
      runOf(0.1, 20, { offset: 0.04 }),
      runOf(0.3, 20, { offset: 0.1 }),
      runOf(0.5, 20, { offset: 0.1 }),
    ]);
    const fit = fitted(fitLine(rows));
    const perRun = rows.map((r) => r.cells[5]!);
    // Each run's ratio is its own (m·g/Δl), the slope is fitted through all three points.
    rows.forEach((r, i) => expect(perRun[i]).toBe(r.y / r.x));
    expect(perRun.every((k) => k !== fit.slope)).toBe(true);
    expect(theoryValue(rows, hooke.slope.theory)).toBe(20);
    expect(Math.abs(fit.slope - 20)).toBeLessThan(0.1);
    expect(Math.abs(fit.intercept)).toBeLessThan(0.05); // N, near 0 for an ideal spring
  });

  it('lists only completed runs; a run cut off by the time limit is listed but not fitted', () => {
    const stopped = (() => {
      const r = new ExperimentRuntime('spring#s', definition, springModel, { mass: 0.5 });
      r.start();
      r.advance(0.5);
      r.stop();
      return recordRun(r, 'physics-lab/spring', 99);
    })();
    const short = ExperimentDefinitionSchema.parse({
      ...(bundledContent.experiments as { id: string }[]).find((e) => e.id === 'hookes-law'),
      simulation: { timeStep: 0.001, maxDuration: 1, sampleInterval: 0.01 },
    });
    const cut = runOf(0.5, 20, { offset: 0.1, def: short });
    expect(cut.status === 'completed' && cut.endReason).toBe('time-limit');
    const rows = analysisRows(definition, hooke, [stopped, cut, runOf(0.5, 20)]);
    expect(rows.map((r) => r.invalid)).toEqual(['time-limit', null]);
  });

  it('handles no runs and a single run: nothing to fit', () => {
    expect(analysisRows(definition, hooke, [])).toEqual([]);
    expect(fitLine(analysisRows(definition, hooke, [runOf(0.5, 20)]))).toEqual({
      status: 'too-few',
      n: 1,
    });
  });
});

describe('T² against m: the period measured from each run, the slope 4π²/(k(1 − ζ²))', () => {
  it('fits the measured T_d² of runs on one spring and one ζ, and 4π²/a gives k(1 − ζ²)', () => {
    const rows = analysisRows(
      definition,
      period,
      [0.5, 1, 2].map((m) => runOf(m, 200, { offset: 0.02, damping: 0.05 })),
    );
    expect(rows.map((r) => r.invalid)).toEqual([null, null, null]);
    expect(rows.map((r) => r.groupKey)).toEqual(['200 0.05', '200 0.05', '200 0.05']);
    // y is the run's own period, measured from its samples, squared.
    rows.forEach((r) => {
      expect(r.y).toBeCloseTo(r.cells[2]! ** 2, 12);
      expect(Math.abs(r.cells[2]! / r.record.theory()!.periodDamped! - 1)).toBeLessThan(2e-3);
    });
    const fit = fitted(fitLine(rows));
    const k = 39.47841760435743 / fit.slope;
    expect(Math.abs(k / (200 * (1 - 0.05 ** 2)) - 1)).toBeLessThan(5e-3);
    expect(theoryValue(rows, period.derived!.theory)).toBeCloseTo(200 * (1 - 0.05 ** 2), 9);
    expect(theoryValue(rows, period.slope.theory)).toBeCloseTo(
      (4 * Math.PI ** 2) / (200 * (1 - 0.05 ** 2)),
      12,
    );
  });

  it('never fits springs or dampings together, and a run that did not swing has no point', () => {
    const rows = analysisRows(definition, period, [
      runOf(0.5, 200, { offset: 0.02, damping: 0.05 }),
      runOf(0.5, 200, { offset: 0.02, damping: 0.1 }),
      runOf(0.5, 100, { offset: 0.02, damping: 0.05 }),
      runOf(0.5, 200, { offset: 0, damping: 0.05 }), // held at rest: no swing to time
      runOf(0.5, 200, { offset: 0.02, damping: 2 }), // overdamped: no swing either
    ]);
    expect(rows.map((r) => r.groupKey)).toEqual([
      '200 0.05',
      '200 0.1',
      '100 0.05',
      '200 0.05',
      '200 2',
    ]);
    expect(rows.map((r) => r.invalid)).toEqual([null, null, null, 'not-measured', 'not-measured']);
    expect(rows[3]?.cells.slice(2).every((v) => Number.isNaN(v))).toBe(true); // never invented
  });
});

describe('analysis CSV: the runs as listed, the fit apart', () => {
  it('writes every listed run with its included flag, the fit in # lines, no NaN', () => {
    const rows = analysisRows(definition, hooke, [
      runOf(0.1, 200),
      runOf(0.3, 200),
      runOf(0.5, 200),
    ]);
    const used = rows.slice(0, 2);
    const text = analysisCsv(definition, hooke, [200], rows, used, fitLine(used));
    const lines = text.slice(0, -2).split('\r\n');
    const header = lines.find((l) => !l.startsWith('#'))!;
    expect(header).toBe(
      'run,included,mass_kg,load_N,naturalLength_m,length_m,extension_m,stiffness_N_m',
    );
    const data = lines.slice(lines.indexOf(header) + 1).map((l) => l.split(','));
    expect(data.map((r) => r[1])).toEqual(['1', '1', '0']);
    expect(data.map((r) => Number(r[2]))).toEqual([0.1, 0.3, 0.5]);
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(lines.some((l) => l.startsWith('# Fit: n = 2; a = '))).toBe(true);
    expect(text).toContain('SE(a) = not defined below 3 points');
    expect(text).toContain('# Theory: stiffness = 200 N/m');
    expect(analysisFileName(definition, hooke, [200])).toBe(
      'simlab-hookes-law-analysis-hooke-stiffness-200.csv',
    );
  });

  it("states the model's intercept when the analysis names one", () => {
    const withB = { ...hooke, slope: { ...hooke.slope, intercept: 'stiffness' } };
    const rows = analysisRows(definition, withB, [runOf(0.1, 200), runOf(0.3, 200)]);
    const text = analysisCsv(definition, withB, [200], rows, rows, fitLine(rows));
    expect(text).toContain(
      "# Theory: stiffness = 200 N/m; stiffness = 200 N (the model's intercept b)",
    );
    expect(text).not.toContain('through the origin');
  });

  it('leaves a missing value empty and says when there is no line', () => {
    const [row] = analysisRows(definition, hooke, [runOf(0.5, 20)]);
    const broken = { ...row!, cells: row!.cells.map((v, i) => (i === 0 ? NaN : v)) };
    const text = analysisCsv(definition, hooke, [20], [broken], [], fitLine([]));
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(text).toContain('# Fit: none (fewer than 2 points: 0)');
    expect(text.trimEnd().split('\r\n').at(-1)?.split(',').slice(0, 3)).toEqual([
      String(row!.record.sequence),
      '0',
      '',
    ]);
  });

  it('writes the period analysis with its derived k(1 − ζ²) and the periods it measured', () => {
    const rows = analysisRows(
      definition,
      period,
      [0.5, 1].map((m) => runOf(m, 200, { offset: 0.02, damping: 0.05 })),
    );
    const text = analysisCsv(definition, period, [200, 0.05], rows, rows, fitLine(rows));
    expect(text).toContain('# Runs: the completed runs with stiffness = 200 N/m, damping = 0.05:');
    expect(text).toMatch(/# Derived: k\(1 − ζ²\) = 39\.47841760435743 \/ a = 199\.\d+ N\/m/);
    expect(text).toContain('oscillation_period_s,oscillation_periodSquared_s2');
    expect(text).not.toMatch(/NaN|Infinity/);
  });

  it('gives no 4π²/a from a slope that is not positive: never a negative or infinite stiffness', () => {
    const rows = analysisRows(
      definition,
      period,
      [0.5, 1].map((m) => runOf(m, 200, { offset: 0.02, damping: 0.05 })),
    );
    for (const ys of [
      [0.2, 0.1], // falling
      [0.1, 0.1], // flat: a = 0
    ]) {
      const fit = fitLine(rows.map((r, i) => ({ x: r.x, y: ys[i]! })));
      const text = analysisCsv(definition, period, [200, 0.05], rows, rows, fit);
      expect(text).toContain('# Derived: k(1 − ζ²) = 39.47841760435743 / a: not defined (a <= 0)');
      expect(text).not.toMatch(/NaN|Infinity|\/ a = /);
    }
  });
});
