import { describe, expect, it } from 'vitest';
import { bundledContent } from '../../content';
import { createTexts } from '../../core/i18n';
import { benchFixture, ohmModel } from '../../game/benchFixture';
import {
  type ExperimentDefinition,
  ExperimentDefinitionSchema,
  resultClass,
} from '../../simulation/experiment';
import { runCsv } from '../../simulation/csv';
import { ExperimentRuntime } from '../../simulation/ExperimentRuntime';
import { ExperimentSession } from '../../simulation/ExperimentSession';
import { ellipticK, pendulumModel } from '../../simulation/models/pendulum';
import { projectileModel } from '../../simulation/models/projectile';
import type { RunRecord } from '../../simulation/RunRecord';
import {
  changedSettings,
  COMPARE_LIMIT,
  comparisonGraphs,
  formatError,
  formatResult,
  graphData,
  graphFor,
  resultRows,
  resultsColumn,
  resultSummary,
  runLabels,
  runOutcome,
  runSettings,
  toggleRun,
  withClass,
} from './results';

const parse = (id: string): ExperimentDefinition =>
  ExperimentDefinitionSchema.parse(
    (bundledContent.experiments as { id: string }[]).find((e) => e.id === id),
  );
const definition = parse('projectile-motion');
const inputs = { velocity: 12, angle: 45, gravity: 9.81, height: 0 };
const pendulum = parse('pendulum');
const swingInputs = { length: 1, angle: 20, gravity: 9.81, mass: 0.5, omega0: 0 };

describe('results presentation data', () => {
  it('puts theory, measurement and error side by side for a completed run', () => {
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.runToCompletion();
    const rows = resultRows(definition, run);
    expect(rows.map((r) => r.id)).toEqual(['flight-time', 'range', 'max-height', 'impact-speed']);
    const range = rows[1]!;
    expect(range.theory).toBeCloseTo(144 / 9.81, 12);
    expect(range.measured).toBe(run.results?.range);
    expect(range.errorPercent).toBeLessThan(1e-9);
    expect(rows[2]!.errorPercent).toBeLessThan(0.01); // apex between steps, ≤ g·dt²/8
    expect(formatError(rows[1]!.errorPercent)).toMatch(/^(0\.00 %|< 0\.01 %)$/);
  });

  it('claims no measurement for a stopped run', () => {
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.start();
    run.advance(0.5);
    run.stop();
    const rows = resultRows(definition, run);
    expect(rows.every((r) => r.measured === null && r.errorPercent === null)).toBe(true);
    expect(rows[0]!.theory).toBeCloseTo((2 * 12 * Math.SQRT1_2) / 9.81, 12);
    expect(formatError(null)).toBe('—');
  });

  it('builds graphs from the run buffers themselves', () => {
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.runToCompletion();
    const [heightTime, trajectory, velocity] = graphData(definition, run);
    expect(heightTime?.x.values).toBe(run.sampleTimes); // the same buffer, not a copy
    expect(heightTime?.y[0]?.values).toBe(run.sampleValues[1]);
    expect(trajectory?.x.id).toBe('x');
    expect(trajectory?.x.unit).toBe('m');
    expect(velocity?.y.map((s) => s.id)).toEqual(['vx', 'vy', 'speed']);
    expect(heightTime?.count).toBe(run.sampleCount);
  });

  it('names each axis by symbol and unit; a shared one by the graph’s own name', () => {
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.runToCompletion();
    expect(graphData(definition, run).map((g) => `${g.yLabel} vs ${g.xLabel}`)).toEqual([
      'y (m) vs t (s)',
      'y (m) vs x (m)',
      'v (m/s) vs t (s)',
    ]);
    const swing = new ExperimentRuntime('p', pendulum, pendulumModel, swingInputs);
    swing.runToCompletion();
    const graphs = graphData(pendulum, swing);
    expect(graphs.map((g) => `${g.yLabel} vs ${g.xLabel}`)).toEqual([
      'θ (rad) vs t (s)',
      'ω (rad/s) vs t (s)',
      'ω (rad/s) vs θ (rad)',
      'E (J) vs t (s)',
    ]);
    expect(graphs[3]?.y.map((s) => s.label)).toEqual(['Eₖ', 'Eₚ', 'E']);
  });

  it('shows the small-angle period as an approximation: 0.77 % short at 20°, the exact one not', () => {
    const swing = new ExperimentRuntime('p', pendulum, pendulumModel, swingInputs);
    swing.runToCompletion();
    const [smallAngle, exact] = resultRows(pendulum, swing);
    expect(smallAngle?.measured).toBe(exact?.measured); // one measured period, two theories
    // T/T₀ = 1 + θ₀²/16 + 11θ₀⁴/3072 + 173θ₀⁶/737280 + … = 1.0076690 at θ₀ = 20°.
    expect(smallAngle?.errorPercent).toBeCloseTo(0.7669, 3);
    expect(exact?.errorPercent).toBeLessThan(1e-5);
  });
});

describe('results summary (completion notice and screens)', () => {
  it('names each measured quantity once, by its symbol where it has one', () => {
    const swing = new ExperimentRuntime('p', pendulum, pendulumModel, swingInputs);
    swing.runToCompletion();
    // Two rows compare the one measured period with two theories: it is listed once.
    expect(resultSummary(pendulum, swing.results!).map(([name]) => name)).toEqual([
      'T',
      'θmax',
      'vmax',
      'E',
    ]);
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.runToCompletion();
    expect(resultSummary(definition, run.results!)).toEqual([
      ['Flight time', `${Number(run.results!['flight-time']!.toPrecision(4))} s`],
      ['Range', `${Number(run.results!.range!.toPrecision(4))} m`],
      ['Max height', `${Number(run.results!['max-height']!.toPrecision(4))} m`],
      ['Impact speed', `${Number(run.results!['impact-speed']!.toPrecision(4))} m/s`],
    ]);
  });
});

describe('desk screen layout', () => {
  /** A generous width in layout units: real glyphs measured ≈ 0.45–0.48 em, not 0.6. */
  const width = (text: string, size: number) => text.length * 0.6 * size;

  it('puts result values after the widest label, inside the screen, clear of the settings', () => {
    const run = new ExperimentRuntime('r', definition, projectileModel, inputs);
    run.runToCompletion();
    const lines = resultSummary(definition, run.results!);
    expect(lines.map(([label]) => label)).toContain('Impact speed'); // the longest label
    const labels = lines.map(([label]) => width(label, 4));
    const values = lines.map(([, value]) => width(value, 4));
    const leftEnd = 14 + width('24.79 m/s²', 4.2); // the widest dial value
    const { x, valueX } = resultsColumn(labels, values, leftEnd);
    expect(x).toBeGreaterThanOrEqual(leftEnd + 2);
    for (const label of labels) expect(x + label).toBeLessThan(valueX);
    for (const value of values) expect(valueX + value).toBeLessThanOrEqual(96);
  });

  it('keeps its old place when the results are short or absent, and never covers the settings', () => {
    expect(resultsColumn([], [], 30)).toEqual({ x: 56, valueX: 58 }); // a stopped run: t only
    expect(resultsColumn([5, 9], [10, 12], 30)).toEqual({ x: 56, valueX: 67 });
    expect(resultsColumn([40], [40], 30).x).toBe(32); // too wide to fit: still clear of the left
  });

  it("names the run's own settings where the dials have moved on since, for the footer", () => {
    const s = station(pendulum, [{ angle: 30 }], { mass: 0.5 });
    const run = s.run!;
    expect(changedSettings(run, s.parameters)).toEqual([]);
    s.setParameter('gravity', 1.62);
    s.setParameter('resolution', 0.001);
    // What the run used, not the dials: the screen keeps showing that run's results.
    expect(changedSettings(run, s.parameters)).toEqual(['g Earth', 'd 0.01 s']);
    expect(changedSettings(s.history[0]!, s.parameters)).toEqual(['g Earth', 'd 0.01 s']);
  });
});

/** A station's session after one run per entry of `settings` (RESET between runs). */
function station(
  experiment: ExperimentDefinition,
  settings: Record<string, number>[],
  apparatus: Record<string, number>,
) {
  const model = experiment.id === 'pendulum' ? pendulumModel : projectileModel;
  const s = new ExperimentSession('station', experiment, model);
  s.setReady(true);
  for (const values of settings) {
    if (s.run) s.reset();
    for (const [id, value] of Object.entries(values)) s.setParameter(id, value);
    s.start(apparatus);
    for (let i = 0; s.state === 'running' && i < 100_000; i++) s.advance(1 / 60);
  }
  return s;
}

/** The exact period of the ideal pendulum, written out here (released from rest). */
const period = (length: number, angleDeg: number, g: number) =>
  4 * Math.sqrt(length / g) * ellipticK(Math.sin((angleDeg * Math.PI) / 360));

/** Everything a record holds, copied out. */
const contents = (r: RunRecord) =>
  JSON.stringify([
    r.inputs,
    r.results,
    r.theory(),
    Array.from(r.sampleTimes),
    r.sampleValues.map((v) => Array.from(v)),
  ]);

describe('run history views', () => {
  it('picks runs: one, none, another, two to compare, at most four', () => {
    expect(COMPARE_LIMIT).toBe(4);
    let picked = toggleRun([], 'a');
    expect(picked).toEqual(['a']); // select one
    picked = toggleRun(picked, 'a');
    expect(picked).toEqual([]); // deselect
    picked = toggleRun(toggleRun(picked, 'b'), 'c');
    expect(picked).toEqual(['b', 'c']); // another, then two: in the order picked
    picked = toggleRun(toggleRun(picked, 'd'), 'e');
    expect(picked).toEqual(['b', 'c', 'd', 'e']);
    expect(toggleRun(picked, 'f')).toBe(picked); // full: a fifth is not added
    expect(toggleRun(picked, 'c')).toEqual(['b', 'd', 'e']);
  });

  it('overlays only what fits each experiment: trajectories, or angle, ω, phase and energy', () => {
    const shots = station(definition, [{ angle: 45 }, { angle: 30 }], { height: 0.59 }).history;
    const shotGraphs = comparisonGraphs(definition, shots);
    expect(shotGraphs.map((g) => `${g.yLabel} vs ${g.xLabel}`)).toEqual([
      'y (m) vs x (m)',
      'y (m) vs t (s)',
    ]);
    const swings = station(pendulum, [{ angle: 30 }, { length: 1.5 }], { mass: 0.5 }).history;
    const swingGraphs = comparisonGraphs(pendulum, swings);
    expect(swingGraphs.map((g) => g.id)).toEqual([
      'angle-time',
      'angular-velocity-time',
      'phase',
      'energy-time',
    ]);
    expect(swingGraphs[3]).toMatchObject({ title: 'Energy against time (E)', yLabel: 'E (J)' });
    // One line per run, straight from that run's stored buffers (no copy, nothing recomputed).
    for (const g of [...shotGraphs, ...swingGraphs]) expect(g.lines).toHaveLength(2);
    const [first] = swings;
    const angle = swingGraphs[0]!.lines[0]!;
    expect(angle.x).toBe(first!.sampleTimes);
    expect(angle.y).toBe(first!.sampleValues[0]);
    expect(angle.count).toBe(first!.sampleCount);
    expect(swingGraphs[3]!.lines[0]!.y).toBe(first!.sampleValues[7]); // total energy only
    const trajectory = shotGraphs[0]!.lines[1]!;
    expect(trajectory.x).toBe(shots[1]!.sampleValues[0]); // x against y, recorded
    expect(trajectory.y).toBe(shots[1]!.sampleValues[1]);
  });

  it("marks each run's own theory, whatever the dials say now", () => {
    const s = station(pendulum, [{ angle: 30 }, { length: 1.5 }], { mass: 0.5 });
    // The dials move on: 3 m on the Moon, not run.
    s.reset();
    s.setParameter('length', 3);
    s.setParameter('gravity', 1.62);
    const [angleTime, , phase] = comparisonGraphs(pendulum, s.history);
    expect(angleTime?.markName).toBe('T');
    const marks = angleTime?.lines.map((l) => l.mark ?? NaN) ?? [];
    expect(marks[0]).toBeCloseTo(period(1, 30, 9.81), 12);
    expect(marks[1]).toBeCloseTo(period(1.5, 30, 9.81), 12);
    expect(marks).not.toContainEqual(s.predict({ mass: 0.5 })?.period);
    expect(phase?.lines.every((l) => l.mark === null)).toBe(true); // nothing to mark there
    const shots = station(definition, [{ velocity: 8 }, { velocity: 6 }], { height: 0.59 }).history;
    const trajectory = comparisonGraphs(definition, shots)[0];
    expect(trajectory?.markName).toBe('Range');
    expect(trajectory?.lines.map((l) => l.mark)).toEqual(shots.map((r) => r.theory()?.range));
  });

  it('names runs by their own settings and outcome, and what differs between them', () => {
    const s = station(pendulum, [{ angle: 30 }, { length: 1.5 }], { mass: 0.5 });
    const [one, two] = s.history;
    expect(runSettings(one!, 1)).toBe('#1 · L 1 m · θ₀ 30 ° · g Earth · d 0.01 s');
    expect(runOutcome(one!)).toBe(
      `T ${Number(period(1, 30, 9.81).toPrecision(4))} s · θmax 0.5236 rad`,
    );
    expect(runLabels([one!, two!])).toEqual(['#1 · L 1 m', '#2 · L 1.5 m']);
    s.reset();
    s.setParameter('gravity', 1.62);
    s.start({ mass: 0.5 });
    s.advance(0.3);
    s.stop();
    const stopped = s.history[2]!;
    expect(runOutcome(stopped)).toBe(`stopped at t = ${stopped.time.toFixed(2)} s, incomplete`);
    expect(runLabels([one!, stopped])).toEqual(['#1 · L 1 m · g Earth', '#3 · L 1.5 m · g Moon']);
  });

  it('reads a recorded run exactly like the live one it came from', () => {
    const s = station(definition, [{ velocity: 10 }], { height: 0.59 });
    const run = s.run!;
    const record = s.history[0]!;
    expect(resultRows(definition, record)).toEqual(resultRows(definition, run));
    const live = graphData(definition, run);
    graphData(definition, record).forEach((g, i) => {
      expect(g.count).toBe(live[i]?.count);
      expect(Array.from(g.x.values)).toEqual(
        Array.from(live[i]?.x.values.subarray(0, g.count) ?? []),
      );
    });
  });

  it('never writes to a recorded run: graphs, tables and exports only read it', () => {
    const s = station(pendulum, [{ angle: 30 }, { angle: 45 }], { mass: 0.5 });
    const before = s.history.map(contents);
    for (const r of s.history) {
      resultRows(pendulum, r);
      graphData(pendulum, r);
      pendulum.graphs.forEach((g) => graphFor(pendulum, r, g));
      runCsv(r);
    }
    comparisonGraphs(pendulum, s.history);
    runLabels(s.history);
    expect(s.history.map(contents)).toEqual(before);
  });
});

describe('result classes and table values', () => {
  // The bench fixture's current names its classes: weak up to 0.15 A, strong above.
  const ohm = ExperimentDefinitionSchema.parse(
    (benchFixture().experiments as { id: string }[]).find((e) => e.id === 'fixture-ohm'),
  );
  const vi = createTexts({}, () => 'vi');
  const ohmRun = (voltage: number) => {
    const s = new ExperimentSession('board', ohm, ohmModel);
    s.setReady(true);
    s.setParameter('voltage', voltage);
    s.start();
    for (let i = 0; s.state === 'running' && i < 10_000; i++) s.advance(1 / 60);
    return s.history[0]!;
  };

  it('shows the class beside the number in the rows, the summary and the run list, in each language', () => {
    const weak = ohmRun(1); // 0.1 A
    const [, current] = resultRows(ohm, weak);
    expect(current).toMatchObject({ theoryClass: 'Weak', measuredClass: 'Weak' });
    expect(current?.measured).toBeCloseTo(0.1, 12); // the value itself stays a number
    expect(resultSummary(ohm, weak.results!)).toEqual([
      ['t', '0.5 s'],
      ['I', '0.1 A (Weak)'],
    ]);
    expect(resultSummary(ohm, weak.results!, vi)[1]).toEqual(['I', '0.1 A (Yếu)']);
    expect(runOutcome(weak)).toBe('t 0.5 s · I 0.1 A (Weak)');
    expect(resultRows(ohm, ohmRun(2), vi)[1]).toMatchObject({ measuredClass: 'Mạnh' }); // 0.2 A
    // A result without classes, as every shipped one: nothing beside it.
    expect(resultRows(ohm, weak)[0]).toMatchObject({ theoryClass: null, measuredClass: null });
  });

  it('puts a boundary in the class below it, all above the last max in the open one; no value, no class', () => {
    const current = ohm.results[1]!;
    expect(resultClass(current, 0.15)).toBe('Weak');
    expect(resultClass(current, 0.1500001)).toBe('Strong');
    expect(resultClass(current, -1)).toBe('Weak');
    expect(resultClass(current, 1e9)).toBe('Strong');
    expect(resultClass(current, null)).toBeNull();
    expect(resultClass(current, NaN)).toBeNull();
    expect(resultClass({ ...current, classes: [{ max: 1, label: 'Low' }] }, 2)).toBeNull();
    expect(withClass('0.3 A', 'Strong')).toBe('0.3 A (Strong)');
    expect(withClass('0.3 A', null)).toBe('0.3 A');
  });

  it('writes table values to three decimals, keeping two significant figures of a small one', () => {
    // As before: what the shipped experiments show (and the e2e tests read) is unchanged.
    expect(formatResult(19.62, 'N')).toBe('19.620 N');
    expect(formatResult(200, 'N/m')).toBe('200.000 N/m');
    expect(formatResult(0.0981, 'm')).toBe('0.098 m');
    expect(formatResult(-2.5, 'm/s')).toBe('−2.500 m/s');
    expect(formatResult(0, 'm')).toBe('0.000 m');
    // Small values keep their figures instead of 0.000 or 0.001.
    expect(formatResult(0.0012, 'mol/L')).toBe('0.0012 mol/L');
    expect(formatResult(0.0004, 'mol/L')).toBe('0.00040 mol/L');
    expect(formatResult(-0.00034, 'mol/L')).toBe('−0.00034 mol/L');
    expect(formatResult(1e-7, 'mol/L')).toBe('0.00000010 mol/L');
    expect(formatResult(null, 'm')).toBe('—');
    // A value that rounds up to the next power of ten shows the digits of that power's values.
    expect(formatResult(0.009998, 'm')).toBe('0.010 m');
    expect(formatResult(0.01, 'm')).toBe('0.010 m');
    expect(formatResult(0.00099, 'm')).toBe('0.00099 m');
  });
});
