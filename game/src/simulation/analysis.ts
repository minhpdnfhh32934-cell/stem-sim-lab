import type { ExperimentDefinition } from './experiment';
import { type OscillationMeasure, oscillationOf } from './oscillation';
import type { RunRecord } from './RunRecord';

export { fitLine, type LineFit } from './fit';

export type Analysis = ExperimentDefinition['analyses'][number];
type CompletedRun = Extract<RunRecord, { status: 'completed' }>;

/** One completed run in an analysis table: its point, its table values, whether it can be fitted. */
export interface AnalysisRow {
  readonly record: CompletedRun;
  /** Its values of the analysis' `group` parameters: only runs with the same ones share a line. */
  readonly group: readonly number[];
  /** Those values as one key, to compare groups. */
  readonly groupKey: string;
  readonly x: number;
  readonly y: number;
  /** Why the run cannot be fitted — it ran out of time before the model finished, a value is not
   *  finite, or its oscillation was too short to measure — or null. */
  readonly invalid: 'time-limit' | 'not-finite' | 'not-measured' | null;
  /** The analysis' columns, from the run's own record (NaN where it has none). */
  readonly cells: readonly number[];
}

/**
 * A quantity a run is analysed by: a result of the run, else one of its inputs (a parameter, an
 * initial condition), else one measured from its recorded oscillation (`oscillation.period`,
 * `oscillation.periodSquared`).
 */
export interface AnalysisQuantity {
  readonly id: string;
  readonly symbol: string;
  readonly unit: string;
  readonly source: 'result' | 'input' | 'oscillation';
}

/** Quantities measured from a run's samples by `measureOscillation`. */
export const OSCILLATION_QUANTITIES: Readonly<Record<string, { symbol: string; unit: string }>> = {
  'oscillation.period': { symbol: 'T', unit: 's' },
  'oscillation.periodSquared': { symbol: 'T²', unit: 's²' },
};

export function analysisQuantity(definition: ExperimentDefinition, id: string): AnalysisQuantity {
  const result = definition.results.find((r) => r.id === id);
  if (result) return { id, symbol: result.symbol ?? id, unit: result.unit, source: 'result' };
  const measured = OSCILLATION_QUANTITIES[id];
  if (measured) return { id, ...measured, source: 'oscillation' };
  const shown = definition.parameters.find((p) => p.id === id) ?? definition.inputs[id];
  return { id, symbol: shown?.symbol ?? id, unit: shown?.unit ?? '', source: 'input' };
}

export const analysisColumns = (definition: ExperimentDefinition, analysis: Analysis) =>
  analysis.columns.map((id) => analysisQuantity(definition, id));

/** A run's value of a quantity, from its own record; NaN where it has none. */
function valueOf(q: AnalysisQuantity, record: CompletedRun, measured: () => OscillationMeasure) {
  if (q.source === 'result') return record.results[q.id] ?? NaN;
  if (q.source === 'input') return record.inputs[q.id] ?? NaN;
  const period = measured().period?.value ?? NaN;
  return q.id === 'oscillation.period' ? period : period * period;
}

/**
 * The completed runs of a station as an analysis table, oldest first, read from their records
 * only — never from the current dials. A stopped or failed run has no results and is not listed.
 */
export function analysisRows(
  definition: ExperimentDefinition,
  analysis: Analysis,
  records: readonly RunRecord[],
): AnalysisRow[] {
  const columns = analysisColumns(definition, analysis);
  const [qx, qy] = [
    analysisQuantity(definition, analysis.x),
    analysisQuantity(definition, analysis.y),
  ];
  return records.flatMap((record) => {
    if (record.status !== 'completed') return [];
    let cached: OscillationMeasure | null = null;
    const measured = () => (cached ??= oscillationOf(record));
    const x = valueOf(qx, record, measured);
    const y = valueOf(qy, record, measured);
    const group = analysis.group.map((id) => record.inputs[id] ?? NaN);
    const fromSamples = qx.source === 'oscillation' || qy.source === 'oscillation';
    return [
      {
        record,
        group,
        groupKey: group.join(' '),
        x,
        y,
        invalid:
          record.endReason !== 'model'
            ? 'time-limit'
            : Number.isFinite(x) && Number.isFinite(y)
              ? null
              : fromSamples
                ? 'not-measured'
                : 'not-finite',
        cells: columns.map((c) => valueOf(c, record, measured)),
      },
    ];
  });
}

/** A prediction of the runs' own theory, null unless they all agree (e.g. the spring's k). */
export function theoryValue(rows: readonly AnalysisRow[], prediction: string): number | null {
  const values = rows.map((r) => r.record.theory()?.[prediction] ?? NaN);
  const first = values[0];
  return first !== undefined && Number.isFinite(first) && values.every((v) => v === first)
    ? first
    : null;
}
