import { ENGLISH, type Texts } from '../../core/i18n';
import {
  type ExperimentDefinition,
  type ExperimentParameter,
  resultClass,
  shownResults,
  theoryShown,
} from '../../simulation/experiment';
import type { RunData, RunRecord } from '../../simulation/RunRecord';
import { formatQuantity } from './dom';

/** One result: what theory predicts, what the run measured, and how far apart they are. */
export interface ResultRow {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  /** Shown as a whole number (a count): `format: 'integer'`. */
  readonly integer: boolean;
  readonly theory: number | null;
  /** Null until the run has completed (a stopped flight measures no landing). */
  readonly measured: number | null;
  /** |measured − theory| / |theory| in %, or null when it cannot be stated. */
  readonly errorPercent: number | null;
  /** The result's class of each value, to show beside it (`resultClass`). */
  readonly theoryClass: string | null;
  readonly measuredClass: string | null;
}

export interface Series {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly values: Float64Array;
}

/** A graph straight from the run's sample buffers: no value is recomputed for display. */
export interface GraphData {
  readonly id: string;
  readonly title: string;
  readonly x: Series;
  readonly y: readonly Series[];
  /** Axis captions, e.g. "t (s)", "θ (rad)", "E (J)". */
  readonly xLabel: string;
  readonly yLabel: string;
  /** Valid samples in every buffer. */
  readonly count: number;
}

type Graph = ExperimentDefinition['graphs'][number];

/** A value as shown, its class (`resultClass`) beside it if any: "−4.1 % (Loses water)". */
export const withClass = (text: string, label: string | null) =>
  label ? `${text} (${label})` : text;

/**
 * A table value to three decimals, so theory and simulation line up digit for digit — more where
 * three would show fewer than two significant figures (0.0012 mol/L, not 0.001); "—" for none;
 * a whole number for a count (`integer`).
 */
export function formatResult(value: number | null, unit: string, integer = false): string {
  if (value === null) return '—';
  if (integer) return `${value.toFixed(0).replace('-', '−')} ${unit}`.trim();
  // The decimals that show two significant figures: 1 − ⌊log₁₀|v|⌋ (−∞ for ±∞; none for 0, NaN),
  // of v at two figures, so 0.009998 and 0.0100 both show as 0.010 (one power of ten).
  const two = value ? 1 - Math.floor(Math.log10(Math.abs(Number(value.toPrecision(2))))) : 0;
  return `${value.toFixed(Math.min(100, Math.max(3, two))).replace('-', '−')} ${unit}`;
}

/**
 * Theory beside measurement for a run, live or recorded: the run's own theory and results; never
 * an answer the student works out (`shownResults`).
 */
export function resultRows(
  definition: ExperimentDefinition,
  run: RunData,
  texts: Texts = ENGLISH,
): ResultRow[] {
  const theory = theoryShown(definition) ? run.theory() : null;
  const measured = run.status === 'completed' ? run.results : null;
  return shownResults(definition).map((r) => {
    const t = r.theory !== undefined ? (theory?.[r.theory] ?? null) : null;
    const m = measured?.[r.id] ?? null;
    let errorPercent: number | null = null;
    if (t !== null && m !== null) {
      if (Math.abs(t) > 1e-12) errorPercent = (Math.abs(m - t) / Math.abs(t)) * 100;
      else if (Math.abs(m) < 1e-12) errorPercent = 0;
    }
    const label = texts.of(r, 'label');
    return {
      id: r.id,
      label,
      unit: r.unit,
      integer: r.format === 'integer',
      theory: t,
      measured: m,
      errorPercent,
      theoryClass: resultClass(r, t, texts),
      measuredClass: resultClass(r, m, texts),
    };
  });
}

/** One of the definition's graphs, from the run's buffers. */
export function graphFor(
  definition: ExperimentDefinition,
  run: RunData,
  graph: Graph,
  texts: Texts = ENGLISH,
): GraphData {
  const series = (id: string): Series => {
    if (id === 'time') return { id, label: 't', unit: 's', values: run.sampleTimes };
    const index = definition.measurements.findIndex((m) => m.id === id);
    const m = definition.measurements[index];
    return {
      id,
      label: m?.symbol ?? m?.id ?? id,
      unit: m?.unit ?? '',
      values: run.sampleValues[index] ?? new Float64Array(0),
    };
  };
  const x = series(graph.x);
  const y = graph.y.map(series);
  const first = y[0];
  // One series names its axis; several share the graph's own name for it (e.g. "E").
  const yName = y.length === 1 ? (first?.label ?? '') : (graph.yLabel ?? '');
  return {
    id: graph.id,
    title: texts.of(graph, 'title'),
    x,
    y,
    xLabel: `${x.label} (${x.unit})`,
    yLabel: `${yName} (${first?.unit ?? ''})`.trim(),
    count: run.sampleCount,
  };
}

export function graphData(
  definition: ExperimentDefinition,
  run: RunData,
  texts: Texts = ENGLISH,
): GraphData[] {
  return definition.graphs.map((g) => graphFor(definition, run, g, texts));
}

/**
 * Results as short "name value" pairs: the symbol where the definition gives one, and each
 * measured quantity once (two rows may compare one measurement with two theories), its class
 * beside it; a count as a whole number; never an answer the student works out.
 */
export function resultSummary(
  definition: ExperimentDefinition,
  results: Readonly<Record<string, number>>,
  texts: Texts = ENGLISH,
): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  for (const r of shownResults(definition)) {
    const key = `${r.variable}:${r.reduce}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = results[r.id] ?? NaN;
    pairs.push([
      r.symbol ?? texts.of(r, 'label'),
      withClass(
        r.format === 'integer' ? formatResult(value, r.unit, true) : formatQuantity(value, r.unit),
        resultClass(r, value, texts),
      ),
    ]);
  }
  return pairs;
}

/** "0.00 %", "< 0.01 %" for what rounding would hide, "—" when not measured. */
export function formatError(errorPercent: number | null): string {
  if (errorPercent === null) return '—';
  if (errorPercent > 0 && errorPercent < 0.005) return '< 0.01 %';
  return `${errorPercent.toFixed(2)} %`;
}

// ---- run history ------------------------------------------------------------------------------

/** Runs compared at once: one colour and line style each. */
export const COMPARE_LIMIT = 4;

/** The picked runs after clicking one: removed if picked, else added last (up to the limit). */
export function toggleRun(picked: readonly string[], runId: string): readonly string[] {
  if (picked.includes(runId)) return picked.filter((id) => id !== runId);
  return picked.length < COMPARE_LIMIT ? [...picked, runId] : picked;
}

/** A setting's value: "1.5 m", "30 °", or a preset by its name ("Earth"). */
export function parameterValue(
  p: ExperimentParameter,
  value: number,
  texts: Texts = ENGLISH,
): string {
  const preset = p.presets.find((s) => Math.abs(s.value - value) < 1e-9);
  return preset ? texts.of(preset, 'label') : formatQuantity(value, p.unit);
}

/** A setting as shown in run lists: "L 1.5 m", "θ₀ 30 °", "g Earth". */
export function parameterText(
  p: ExperimentParameter,
  value: number,
  texts: Texts = ENGLISH,
): string {
  return `${p.symbol ?? texts.of(p, 'label')} ${parameterValue(p, value, texts)}`;
}

/** A run's settings, from its own inputs: "#3 · L 1.5 m · θ₀ 30 ° · g Earth". */
export function runSettings(run: RunData, sequence: number, texts: Texts = ENGLISH): string {
  const settings = run.definition.parameters.map((p) =>
    parameterText(p, run.inputs[p.id] ?? NaN, texts),
  );
  return [`#${sequence}`, ...settings].join(' · ');
}

/** The run's own settings where the dials now differ from them: ["d 0.1 m"]; none if all agree. */
export function changedSettings(
  run: RunData,
  dials: Readonly<Record<string, number>>,
  texts: Texts = ENGLISH,
): string[] {
  return run.definition.parameters
    .filter((p) => run.inputs[p.id] !== dials[p.id])
    .map((p) => parameterText(p, run.inputs[p.id] ?? NaN, texts));
}

/**
 * Where the desk screen's results go, in its layout units (100 across, text from 4 to 96): labels
 * at `x`, values a gap after the widest label, the column as far right as it fits (from 56) and
 * never into the settings column, which ends at `leftEnd`. Widths are measured, in units.
 */
export function resultsColumn(
  labels: readonly number[],
  values: readonly number[],
  leftEnd: number,
): { x: number; valueX: number } {
  const gap = 2;
  const label = Math.max(0, ...labels);
  const x = Math.max(leftEnd + gap, Math.min(56, 96 - (label + gap + Math.max(0, ...values))));
  return { x, valueX: x + label + gap };
}

/** How a recorded run came out: its first two measured quantities, or how it ended. */
export function runOutcome(run: RunRecord, texts: Texts = ENGLISH): string {
  if (run.status === 'stopped') {
    return texts.ui('results.stoppedAt', 'stopped at t = {t} s, incomplete', {
      t: run.time.toFixed(2),
    });
  }
  if (run.status === 'failed') {
    return texts.ui('results.failed', 'failed: {error}', { error: run.error });
  }
  return resultSummary(run.definition, run.results, texts)
    .slice(0, 2)
    .map(([name, value]) => `${name} ${value}`)
    .join(' · ');
}

/** Legend names for runs compared: the number and the settings that differ between them. */
export function runLabels(runs: readonly RunRecord[], texts: Texts = ENGLISH): string[] {
  const parameters = runs[0]?.definition.parameters ?? [];
  const differ = parameters.filter((p) => new Set(runs.map((r) => r.inputs[p.id])).size > 1);
  return runs.map((r) =>
    [`#${r.sequence}`, ...differ.map((p) => parameterText(p, r.inputs[p.id] ?? NaN, texts))].join(
      ' · ',
    ),
  );
}

/** One run's line in a comparison graph: its own sample buffers and its own theory mark. */
export interface RunLine {
  readonly runId: string;
  readonly sequence: number;
  readonly label: string;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly count: number;
  /** This run's theory value marked on the x axis (e.g. its predicted period), if any. */
  readonly mark: number | null;
}

export interface ComparisonGraph {
  readonly id: string;
  readonly title: string;
  readonly xLabel: string;
  readonly yLabel: string;
  /** What the marks are, e.g. "T" or "Range" (null without marks). */
  readonly markName: string | null;
  readonly lines: readonly RunLine[];
}

/**
 * The experiment's comparison graphs for recorded runs (its `compare` list, so only overlays
 * that mean something for it): one line per run straight from that run's stored samples, and
 * each run's theory mark from that run's own theory — never recomputed from current settings.
 */
export function comparisonGraphs(
  definition: ExperimentDefinition,
  runs: readonly RunRecord[],
  texts: Texts = ENGLISH,
): ComparisonGraph[] {
  const labels = runLabels(runs, texts);
  return definition.compare.flatMap((c) => {
    const graph = definition.graphs.find((g) => g.id === c.graph);
    if (!graph) return [];
    const seriesId = c.series ?? graph.y[0] ?? '';
    const mark = theoryShown(definition) ? graph.mark : undefined;
    const marked =
      mark === undefined ? undefined : definition.results.find((r) => r.theory === mark);
    const per = runs.map((run) => graphFor(definition, run, graph, texts));
    const title = texts.of(graph, 'title');
    const first = per[0];
    const shown = first?.y.find((s) => s.id === seriesId);
    return [
      {
        id: graph.id,
        title: graph.y.length > 1 ? `${title} (${shown?.label ?? seriesId})` : title,
        xLabel: first?.xLabel ?? '',
        yLabel: shown ? `${shown.label} (${shown.unit})`.trim() : '',
        markName:
          mark === undefined
            ? null
            : (marked?.symbol ?? (marked ? texts.of(marked, 'label') : mark)),
        lines: runs.map((run, i) => {
          const data = per[i];
          return {
            runId: run.runId,
            sequence: run.sequence,
            label: labels[i] ?? '',
            x: data?.x.values ?? new Float64Array(0),
            y: data?.y.find((s) => s.id === seriesId)?.values ?? new Float64Array(0),
            count: data?.count ?? 0,
            mark: mark === undefined ? null : (run.theory()?.[mark] ?? null),
          };
        }),
      },
    ];
  });
}
