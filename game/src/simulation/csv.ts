import {
  type Analysis,
  type AnalysisRow,
  analysisColumns,
  analysisQuantity,
  type LineFit,
  theoryValue,
} from './analysis';
import { type ExperimentDefinition, theoryShown } from './experiment';
import { readings } from './measurement';
import { oscillationOf } from './oscillation';
import type { RunRecord } from './RunRecord';

const NEWLINE = '\r\n'; // RFC 4180
const DEGREES = 180 / Math.PI;

/** ASCII only, so every tool reads it: "rad/s²" → "rad_s2", "°" → "deg". */
const slug = (text: string) =>
  text
    .replace(/°/g, 'deg')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** A column name from a measurement id and its unit: "theta" in "rad/s²" → "theta_rad_s2". */
export function csvColumn(id: string, unit: string): string {
  const u = slug(unit);
  return u ? `${slug(id)}_${u}` : slug(id);
}

interface Column {
  readonly name: string;
  readonly description: string;
  readonly values: Float64Array;
  readonly factor: number;
}

/** Time, every measurement, and a degrees copy of each measurement in radians. */
function columns(run: RunRecord): Column[] {
  const definition = run.definition;
  const list: Column[] = [
    { name: 'time_s', description: 'simulated time (s)', values: run.sampleTimes, factor: 1 },
  ];
  definition.measurements.forEach((m, i) => {
    const values = run.sampleValues[i] ?? new Float64Array(run.sampleCount);
    list.push({
      name: csvColumn(m.id, m.unit),
      description: `${m.label} (${m.unit})`,
      values,
      factor: 1,
    });
    if (m.unit === 'rad') {
      list.push({
        name: `${slug(m.id)}_deg`,
        description: `${m.label} in degrees, converted on export (× 180/π)`,
        values,
        factor: DEGREES,
      });
    }
  });
  return list;
}

/** The unit theory values carry: that of a result compared with them. */
const theoryUnit = (definition: ExperimentDefinition, prediction: string) => {
  const unit = definition.results.find((r) => r.theory === prediction)?.unit;
  return unit ? ` ${unit}` : '';
};

/** Each instrument's reading of the run, what it accounts for and what it leaves out. */
function measurements(run: RunRecord): string[] {
  if (run.definition.instruments.length === 0) return [];
  const list = readings(run.definition, run);
  if (list.length === 0) return ['# Measurements: none (the run did not complete)'];
  return [
    ...list.flatMap((r) => [
      `# Measurement ${r.result} (${r.quantity}) by ${r.instrument}: ` +
        `reading = ${r.text} ${r.unit} at resolution d = ${String(r.resolution)} ${r.unit}`,
      `# Measurement ${r.result}: standard uncertainty u = d/√12 = ${String(r.uncertainty)} ` +
        `${r.unit}; bound d/2 = ${String(r.bound)} ${r.unit}`,
      `# Measurement ${r.result}: not included: ${r.excludes}`,
    ]),
    '# Measurement model: a reading is its result above (kept unrounded there) rounded to the ' +
      'nearest multiple of d, half-way values away from zero; u is the standard uncertainty of ' +
      'that rounding alone, uniform over ±d/2; not the total uncertainty of a real measurement, ' +
      "and the simulation's own step error is not included either",
  ];
}

/** What a run's samples show of its swing (`measureOscillation`), if its experiment has one. */
function oscillationLines(run: RunRecord): string[] {
  const config = run.definition.oscillation;
  if (!config) return [];
  const m = oscillationOf(run);
  return [
    `# Oscillation: measured from the samples of ${config.measurement}; ` +
      `swings below ${String(m.floor)} left out`,
    m.period
      ? `# Oscillation: period T = ${String(m.period.value)} s over ${m.period.cycles} whole ` +
        'swings (crossings of rest from negative to positive values)'
      : '# Oscillation: period not measured (fewer than 2 whole swings)',
    `# Oscillation: ${m.peaks.length} peaks read`,
    m.decay
      ? `# Oscillation: decay rate = ${String(m.decay.rate)} 1/s (ln A against t); ` +
        `logarithmic decrement = ${m.decay.decrement ?? 'not defined'}; ` +
        `damping ratio = ${m.decay.zeta ?? 'not defined'}`
      : '# Oscillation: decay not measured (fewer than 3 peaks)',
  ];
}

function status(run: RunRecord): string {
  switch (run.status) {
    case 'completed':
      return `completed (${run.endReason}) after ${String(run.time)} s`;
    case 'stopped':
      return `stopped at ${String(run.time)} s: incomplete; no measured results`;
    case 'failed':
      return `failed at ${String(run.time)} s: ${run.error}`;
  }
}

/**
 * A recorded run as CSV, from its own stored data only: `#` lines of metadata (experiment, run,
 * status, the inputs that produced it, its theory and simulated results, the instruments'
 * readings with their resolution and uncertainty, the sampling), then one
 * row per recorded sample — simulated time and every measurement, exactly as stored (JavaScript's
 * shortest round-trip form, nothing rounded away; a degrees column is the one conversion). No
 * export time or other varying data: the same run always gives the same file.
 */
export function runCsv(run: RunRecord): string {
  const d = run.definition;
  const isParameter = (id: string) => d.parameters.some((p) => p.id === id);
  const cols = columns(run);
  const theory = (theoryShown(d) && run.theory()) || {};
  // Answers the student works out and hidden inputs stay out of the export, theory too.
  const answers = d.results.filter((r) => r.answer);
  const withheld = new Set(answers.flatMap((r) => r.theory ?? []));
  const lines = [
    '# SimLab 3D recorded run',
    `# Experiment: ${d.name} (${d.id}; model ${d.model})`,
    `# Run: ${run.sequence} at ${run.sessionId} (${run.runId})`,
    `# Status: ${status(run)}`,
    ...d.parameters.map(
      (p) => `# Parameter ${p.id} (${p.symbol ?? p.label}) = ${String(run.inputs[p.id])} ${p.unit}`,
    ),
    ...Object.entries(run.inputs)
      .filter(([id]) => !isParameter(id) && !d.inputs[id]?.hidden)
      .map(([id, value]) => {
        const shown = d.inputs[id];
        return `# Input ${id}${shown ? ` (${shown.symbol})` : ''} = ${String(value)}${shown?.unit ? ` ${shown.unit}` : ''}`;
      }),
    ...Object.entries(theory)
      .filter(([id]) => !withheld.has(id))
      .map(([id, value]) => `# Theory ${id} = ${String(value)}${theoryUnit(d, id)}`),
    ...(run.status === 'completed'
      ? d.results.map((r) =>
          r.answer
            ? `# Result ${r.id} (${r.label}): not exported, the student works it out`
            : `# Result ${r.id} (${r.label}) = ${String(run.results[r.id])} ${r.unit}` +
              (r.theory && theoryShown(d) ? `; theory ${r.theory}` : ''),
        )
      : ['# Results: none (the run did not complete)']),
    ...measurements(run),
    ...oscillationLines(run),
    // A driven run (`workspace.drive`) is fed by the player, never stepped.
    d.workspace?.drive
      ? `# Samples: ${run.sampleCount} rows; computed from the volume poured, each time it changed, ` +
        `at least ${d.simulation.sampleInterval} s of lab time apart; ` +
        `a completed run also has a row at its end`
      : `# Samples: ${run.sampleCount} rows; every ${d.simulation.sampleInterval} s of simulated time ` +
        `in ${d.simulation.timeStep} s model steps; a completed run also has a row at its end`,
    ...cols.map((c) => `# Column ${c.name}: ${c.description}`),
    cols.map((c) => c.name).join(','),
  ];
  for (let k = 0; k < run.sampleCount; k++) {
    lines.push(cols.map((c) => String((c.values[k] ?? NaN) * c.factor)).join(','));
  }
  return lines.join(NEWLINE) + NEWLINE;
}

/** "simlab-pendulum-run-003.csv": letters, digits and hyphens, safe on every file system. */
export function csvFileName(run: RunRecord): string {
  const id = run.definition.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `simlab-${id}-run-${String(run.sequence).padStart(3, '0')}.csv`;
}

/** A value as the analysis CSV holds it: shortest round-trip form; empty where there is none. */
const cell = (value: number) => (Number.isFinite(value) ? String(value) : '');

/**
 * An analysis table as CSV, from the runs' records only: `#` lines saying which runs, how the line
 * was fitted and what came of it (the raw observations and the fit kept apart), then one row per
 * listed run — its number, `included` (1 when its point is in the fit) and the analysis' columns,
 * as recorded or measured from its samples. Empty cells where a value is missing, never NaN.
 */
export function analysisCsv(
  definition: ExperimentDefinition,
  a: Analysis,
  group: readonly number[],
  rows: readonly AnalysisRow[],
  used: readonly AnalysisRow[],
  fit: LineFit,
): string {
  const columns = analysisColumns(definition, a);
  const [qx, qy] = [analysisQuantity(definition, a.x), analysisQuantity(definition, a.y)];
  const [x, y] = [`${a.x} (${qx.unit})`, `${a.y} (${qy.unit})`];
  const theory = theoryValue(rows, a.slope.theory);
  const theoryB = a.slope.intercept === undefined ? 0 : theoryValue(rows, a.slope.intercept);
  const groupText = a.group
    .map((id, i) => {
      const unit = definition.parameters.find((p) => p.id === id)?.unit ?? '';
      return `${id} = ${cell(group[i] ?? NaN)}${unit ? ` ${unit}` : ''}`;
    })
    .join(', ');
  const derived = a.derived;
  const derivedTheory = derived ? theoryValue(rows, derived.theory) : null;
  const lines = [
    '# SimLab 3D data analysis',
    `# Experiment: ${definition.name} (${definition.id}; model ${definition.model})`,
    `# Analysis: ${a.title} (${a.id})`,
    `# Runs: the completed runs with ${groupText}: ${rows.length} listed, ${used.length} in the fit`,
    `# Fit: ${y} = a * ${x} + b by ordinary least squares, the intercept b free`,
    ...(fit.status === 'fitted'
      ? [
          `# Fit: n = ${fit.n}; a = ${cell(fit.slope)} ${a.slope.unit}; ` +
            `b = ${cell(fit.intercept)} ${qy.unit}; SSE = ${cell(fit.sse)}; ` +
            `R2 = ${fit.r2 === null ? 'not defined (every y the same)' : cell(fit.r2)}; ` +
            `SE(a) = ${fit.slopeError === null ? 'not defined below 3 points' : `${cell(fit.slopeError)} ${a.slope.unit}`}`,
          `# Fit: over the measured range ${a.x} = ${cell(fit.xMin)} to ${cell(fit.xMax)} ${qx.unit}`,
          ...(derived && !(fit.slope > 0)
            ? [
                `# Derived: ${derived.symbol} = ${cell(derived.numerator)} / a: not defined (a <= 0)`,
              ]
            : []),
          ...(derived && fit.slope > 0
            ? [
                `# Derived: ${derived.symbol} = ${cell(derived.numerator)} / a = ` +
                  `${cell(derived.numerator / fit.slope)} ${derived.unit}; theory ${derived.theory} = ` +
                  (derivedTheory === null
                    ? 'not defined'
                    : `${cell(derivedTheory)} ${derived.unit}`),
              ]
            : []),
        ]
      : [
          `# Fit: none (${fit.status === 'too-few' ? `fewer than 2 points: ${fit.n}` : `every ${a.x} the same`})`,
        ]),
    `# Theory: ${a.slope.theory} = ` +
      (theory === null ? 'not defined' : `${cell(theory)} ${a.slope.unit}`) +
      (a.slope.intercept === undefined
        ? ' (the model, a line through the origin)'
        : `; ${a.slope.intercept} = ${theoryB === null ? 'not defined' : `${cell(theoryB)} ${qy.unit}`} (the model's intercept b)`),
    '# Column run: the run number at its station',
    "# Column included: 1 if the run's point is in the fit, 0 if left out or not usable",
    ...columns.map(
      (c) =>
        `# Column ${csvColumn(c.id, c.unit)}: ${c.symbol} (${c.unit}), ` +
        (c.source === 'oscillation' ? 'measured from the run’s samples' : `the run's ${c.source}`),
    ),
    ['run', 'included', ...columns.map((c) => csvColumn(c.id, c.unit))].join(','),
    ...rows.map((r) =>
      [String(r.record.sequence), used.includes(r) ? '1' : '0', ...r.cells.map(cell)].join(','),
    ),
  ];
  return lines.join(NEWLINE) + NEWLINE;
}

/** "simlab-hookes-law-analysis-hooke-stiffness-20.csv". */
export function analysisFileName(
  definition: ExperimentDefinition,
  a: Analysis,
  group: readonly number[],
): string {
  const safe = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const values = a.group.map((id, i) => `${safe(id)}-${safe(String(group[i] ?? ''))}`).join('-');
  return `simlab-${safe(definition.id)}-analysis-${safe(a.id)}-${values}.csv`;
}
