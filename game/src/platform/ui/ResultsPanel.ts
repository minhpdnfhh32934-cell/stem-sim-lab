import type { Texts } from '../../core/i18n';
import type { StationView } from '../../gameplay/experiment/StationSystem';
import {
  type AnalysisRow,
  analysisColumns,
  analysisQuantity,
  analysisRows,
  fitLine,
  theoryValue,
} from '../../simulation/analysis';
import { oscillationOf, PEAK_FLOOR } from '../../simulation/oscillation';
import { analysisCsv, analysisFileName, csvFileName, runCsv } from '../../simulation/csv';
import { type ExperimentDefinition, shownResults } from '../../simulation/experiment';
import { type ExperimentSession, RUN_HISTORY_LIMIT } from '../../simulation/ExperimentSession';
import {
  type AnswerCheck,
  checkAnswer,
  formatUncertainty,
  type Reading,
  readings,
} from '../../simulation/measurement';
import type { RunData, RunRecord } from '../../simulation/RunRecord';
import { type Attrs, el, formatQuantity, svg } from './dom';
import { extent, niceAxis, scale, tickLabel } from './plot';
import {
  COMPARE_LIMIT,
  type ComparisonGraph,
  comparisonGraphs,
  formatError,
  formatResult,
  type GraphData,
  graphData,
  parameterText,
  parameterValue,
  resultRows,
  runLabels,
  runOutcome,
  runSettings,
  toggleRun,
  withClass,
} from './results';

/** Series colours; series are also named in a legend, never told apart by colour alone. */
const COLORS = ['#4fb3d9', '#f0a35a', '#7bd88f'];
/** Compared runs: a colour and a line style each, named in the legend and the run list. */
const RUN_STYLES = [
  { color: '#4fb3d9', dash: '' },
  { color: '#f0a35a', dash: '8 4' },
  { color: '#7bd88f', dash: '2 3' },
  { color: '#d98ee8', dash: '10 3 2 3' },
] as const;
const W = 360;
const H = 220;
const PAD = { left: 48, right: 12, top: 26, bottom: 36 };

const runStyle = (i: number) => RUN_STYLES[i % RUN_STYLES.length] ?? RUN_STYLES[0];
const dashed = (dash: string): Attrs => (dash ? { 'stroke-dasharray': dash } : {});

interface Line {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly count: number;
  readonly color: string;
  readonly dash: string;
  readonly attrs: Attrs;
  /** Drawn as separate points (measurements), not joined. */
  readonly dots?: boolean;
}

interface Mark {
  readonly value: number;
  readonly color: string;
  readonly attrs: Attrs;
}

/** What the student wrote for a run's answer and what checking it said. */
interface AnswerState {
  readonly text: string;
  readonly check: AnswerCheck | null;
}

/** Nice axes with their quantity and unit, a polyline per line, theory marks across the plot. */
function plot(
  attrs: Attrs,
  title: string,
  axes: { x: string; y: string },
  lines: readonly Line[],
  marks: readonly Mark[] = [],
): SVGSVGElement {
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', ...attrs });
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const line of lines) {
    if (line.count === 0) continue;
    const [xa, xb] = extent(line.x, line.count);
    const [ya, yb] = extent(line.y, line.count);
    x0 = Math.min(x0, xa);
    x1 = Math.max(x1, xb);
    y0 = Math.min(y0, ya);
    y1 = Math.max(y1, yb);
  }
  for (const mark of marks) {
    x0 = Math.min(x0, mark.value);
    x1 = Math.max(x1, mark.value);
  }
  const data = Number.isFinite(x0) && Number.isFinite(y0);
  const ax = niceAxis(data ? x0 : 0, data ? x1 : 1);
  const ay = niceAxis(data ? Math.min(0, y0) : 0, data ? y1 : 1);
  const sx = scale(ax.min, ax.max, PAD.left, W - PAD.right);
  const sy = scale(ay.min, ay.max, H - PAD.bottom, PAD.top);

  root.append(svg('text', { x: PAD.left, y: 14, class: 'graph-title' }, title));
  for (const t of ax.ticks) {
    root.append(
      svg('line', { x1: sx(t), x2: sx(t), y1: PAD.top, y2: H - PAD.bottom, class: 'grid' }),
      svg('text', { x: sx(t), y: H - PAD.bottom + 14, class: 'tick x' }, tickLabel(t, ax.step)),
    );
  }
  for (const t of ay.ticks) {
    root.append(
      svg('line', { x1: PAD.left, x2: W - PAD.right, y1: sy(t), y2: sy(t), class: 'grid' }),
      svg('text', { x: PAD.left - 6, y: sy(t) + 4, class: 'tick y' }, tickLabel(t, ay.step)),
    );
  }
  root.append(
    svg('line', { x1: PAD.left, x2: W - PAD.right, y1: sy(0), y2: sy(0), class: 'axis' }),
    svg('text', { x: W - PAD.right, y: H - 6, class: 'axis-label x' }, axes.x),
    svg('text', { x: 12, y: (PAD.top + H - PAD.bottom) / 2, class: 'axis-label y' }, axes.y),
  );
  for (const line of lines) {
    if (line.dots) {
      for (let k = 0; k < line.count; k++) {
        const at = { cx: sx(line.x[k] ?? 0), cy: sy(line.y[k] ?? 0) };
        root.append(
          svg('circle', { ...at, r: 3.5, class: 'dot', fill: line.color, ...line.attrs }),
        );
      }
      continue;
    }
    const points: string[] = [];
    for (let k = 0; k < line.count; k++) {
      points.push(`${sx(line.x[k] ?? 0).toFixed(1)},${sy(line.y[k] ?? 0).toFixed(1)}`);
    }
    root.append(
      svg('polyline', {
        points: points.join(' '),
        class: 'series',
        stroke: line.color,
        ...dashed(line.dash),
        ...line.attrs,
      }),
    );
  }
  for (const mark of marks) {
    const x = sx(mark.value);
    root.append(
      svg('line', {
        x1: x,
        x2: x,
        y1: PAD.top,
        y2: H - PAD.bottom,
        class: 'mark',
        stroke: mark.color,
        ...mark.attrs,
      }),
    );
  }
  return root;
}

/** One run's graph: a polyline per series (named in a legend when there are several). */
function drawGraph(g: GraphData, t: Texts): SVGSVGElement {
  const color = (i: number) => COLORS[i % COLORS.length] ?? '#ffffff';
  const root = plot(
    {
      'aria-label': t.ui('results.graphLabel', '{title}: {series} against {x}', {
        title: g.title,
        series: g.y.map((s) => s.label).join(', '),
        x: g.x.label,
      }),
      'data-graph': g.id,
      'data-samples': g.count,
    },
    g.title,
    { x: g.xLabel, y: g.yLabel },
    g.y.map((s, i) => ({
      x: g.x.values,
      y: s.values,
      count: g.count,
      color: color(i),
      dash: '',
      attrs: { 'data-series': s.id },
    })),
  );
  if (g.y.length > 1) {
    g.y.forEach((s, i) => {
      const x = PAD.left + 10 + i * 64;
      root.append(
        svg('line', { x1: x, x2: x + 14, y1: PAD.top + 8, y2: PAD.top + 8, stroke: color(i) }),
        svg('text', { x: x + 18, y: PAD.top + 12, class: 'legend' }, s.label),
      );
    });
  }
  return root;
}

/** Runs overlaid, each in its own style, with each run's own theory mark. */
function drawComparison(g: ComparisonGraph): SVGSVGElement {
  return plot(
    { 'aria-label': `${g.title}: ${g.lines.map((l) => l.label).join(', ')}`, 'data-compare': g.id },
    g.title,
    { x: g.xLabel, y: g.yLabel },
    g.lines.map((l, i) => ({
      x: l.x,
      y: l.y,
      count: l.count,
      ...runStyle(i),
      attrs: { 'data-run': l.sequence, 'data-samples': l.count },
    })),
    g.lines.flatMap((l, i) =>
      l.mark === null || !Number.isFinite(l.mark)
        ? []
        : [
            {
              value: l.mark,
              color: runStyle(i).color,
              attrs: { 'data-run': l.sequence, 'data-value': l.mark },
            },
          ],
    ),
  );
}

/** A short sample of a compared run's line style, for the run list, legend and table. */
function swatch(i: number): SVGSVGElement {
  const style = runStyle(i);
  const root = svg('svg', { viewBox: '0 0 28 10', class: 'results-swatch', 'aria-hidden': 'true' });
  root.append(
    svg('line', { x1: 1, x2: 27, y1: 5, y2: 5, stroke: style.color, ...dashed(style.dash) }),
  );
  return root;
}

const GREEN = '#7bd88f';
const BLUE = '#4fb3d9';
const AMBER = '#f0a35a';

/** A legend entry: a short sample of the line (or a dot, with no dash given for points). */
function keyed(color: string, dash: string, text: string): HTMLLIElement {
  const sample = svg('svg', {
    viewBox: '0 0 28 10',
    class: 'results-swatch',
    'aria-hidden': 'true',
  });
  sample.append(
    color === GREEN
      ? svg('circle', { cx: 14, cy: 5, r: 3.5, fill: color })
      : svg('line', { x1: 1, x2: 27, y1: 5, y2: 5, stroke: color, ...dashed(dash) }),
  );
  const item = el('li');
  item.append(sample, ` ${text}`);
  return item;
}

/** A fitted or recorded value to `digits` significant figures; "—" where there is none. */
const sig = (value: number | null, digits = 5) =>
  value === null || !Number.isFinite(value)
    ? '—'
    : String(Number(value.toPrecision(digits))).replace('-', '−');

/** A signed percentage with two decimals: "+0.06", "−1.20". */
const signed = (percent: number) => `${percent < 0 ? '−' : '+'}${Math.abs(percent).toFixed(2)}`;

/** Hands the file to the browser's own download (nothing leaves the machine). */
function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = el('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** A table value (`formatResult`), its class beside it where the result names one. */
const show = (value: number | null, unit: string, label: string | null, integer = false) =>
  withClass(formatResult(value, unit, integer), label);

const noteFor = (definition: ExperimentDefinition, t: Texts) =>
  el(
    'p',
    'results-note',
    [
      t.of(definition, 'note'),
      // A driven run (`workspace.drive`) is fed by the player, never stepped.
      definition.workspace?.drive
        ? t.ui(
            'results.driven',
            'Computed from the volume you poured, each time it changed; samples at least {interval} ms of lab time apart.',
            { interval: definition.simulation.sampleInterval * 1000 },
          )
        : t.ui(
            'results.simulated',
            'Simulated: the run in {step} ms steps, sampled every {interval} ms.',
            {
              step: definition.simulation.timeStep * 1000,
              interval: definition.simulation.sampleInterval * 1000,
            },
          ),
    ]
      .filter(Boolean)
      .join(' '),
  );

/** A reading as its instrument shows it: "6.52 m". */
const shown = (r: Reading) => `${r.text.replace('-', '−')} ${r.unit}`;

/**
 * Each instrument's reading of a completed run, then what the reading and its uncertainty mean
 * and leave out. Nothing for an incomplete run: it measured nothing.
 */
function readingTables(definition: ExperimentDefinition, run: RunData, t: Texts): HTMLElement[] {
  const list = readings(definition, run);
  if (list.length === 0) return [];
  // Readings come in the order of the definition's instruments, whose texts are translated.
  const instruments = definition.instruments;
  const tables = list.flatMap((r, k) => {
    const instrument = instruments[k];
    const table = el('table', 'results-table results-reading');
    table.dataset.reading = r.result;
    const rows: [string, string, string][] = [
      [t.ui('results.reading', 'Reading'), 'reading', shown(r)],
      [
        t.ui('results.resolution', 'Resolution d'),
        'resolution',
        formatQuantity(r.resolution, r.unit),
      ],
      [
        t.ui('results.uncertainty', 'Standard uncertainty u = d/√12'),
        'uncertainty',
        `${formatUncertainty(r.uncertainty)} ${r.unit}`,
      ],
      [
        t.ui('results.bound', 'Largest rounding error d/2'),
        'bound',
        formatQuantity(r.bound, r.unit),
      ],
    ];
    for (const [label, name, value] of rows) {
      const tr = el('tr');
      tr.append(el('th', undefined, label), el('td', name, value));
      table.append(tr);
    }
    const heading = t.ui('results.readWith', '{quantity}, read with: {instrument}', {
      quantity: instrument ? t.of(instrument, 'quantity') : r.quantity,
      instrument: instrument ? t.of(instrument, 'name') : r.instrument,
    });
    return [el('h3', undefined, heading), table];
  });
  const excluded = list
    .map((r, k) => {
      const instrument = instruments[k];
      return instrument ? t.of(instrument, 'excludes') : r.excludes;
    })
    .join('; ');
  return [
    ...tables,
    el(
      'p',
      'results-note',
      t.ui(
        'results.readingNote',
        "The reading is the simulated value rounded to the nearest multiple of d (half-way values away from zero); the simulated value itself is kept unrounded (in full in the CSV). u is the standard uncertainty from the resolution alone, taking the rounding error as equally likely anywhere within ±d/2; d/2 is the most that error can be. It is not the total uncertainty of a real measurement, which would add {excluded}; nor does it include the simulation's own step error.",
        { excluded },
      ),
    ),
  ];
}

/**
 * A station's results, as read on its results monitor. Beside them, its run history: every run
 * that has ended, newest first. Ticking one completed run shows it instead of the current run;
 * ticking two to four compares them — overlays from their own samples, each with its own theory.
 * Any recorded run exports as CSV. Everything is drawn from the runs themselves, live or
 * recorded; nothing is recomputed from the current dials.
 */
export class ResultsPanel {
  readonly root = el('section', 'results-panel hidden');
  private readonly runs = el('section', 'results-runs');
  private readonly main = el('div', 'results-main');
  /** Runs picked at each station, in the order picked; dropped with the session. */
  private readonly picks = new WeakMap<ExperimentSession, readonly string[]>();
  /** Runs left out of the analysis' fit at each station (all others are used). */
  private readonly excluded = new WeakMap<ExperimentSession, ReadonlySet<string>>();
  /** The group (e.g. one spring) chosen in each analysis at each station, by group key. */
  private readonly groups = new WeakMap<ExperimentSession, ReadonlyMap<string, string>>();
  /** The analysis chosen at each station, by id. */
  private readonly chosen = new WeakMap<ExperimentSession, string>();
  private station: StationView | null = null;
  /** Showing the data analysis of the station's runs instead of one run or a comparison. */
  private analysing = false;
  /** What the run list shows, so it is rebuilt only when that changes (focus and clicks stay). */
  private listed: { session: ExperimentSession; key: string } | null = null;
  /**
   * What the student wrote for each run's answer and what checking it said: view state only, per
   * session, since run ids start again at #1 in a new game when no history was kept.
   */
  private readonly answers = new WeakMap<ExperimentSession, Map<string, AnswerState>>();

  constructor(private readonly texts: Texts) {
    this.relabel();
    this.root.append(this.runs, this.main);
  }

  /** Names in the current language; the run list is rebuilt in it at the next render. */
  relabel(): void {
    const t = this.texts;
    this.root.setAttribute('aria-label', t.ui('results.panel', 'Experiment results'));
    this.runs.setAttribute('aria-label', t.ui('results.history', 'Run history'));
    this.listed = null;
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** True while it shows the current run (which a run in progress keeps changing). */
  get followsCurrentRun(): boolean {
    return (
      this.station !== null && !this.analysing && this.picked(this.station.session).length === 0
    );
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  /** Scrolls the results column (the wheel, which the captured pointer sends to the view). */
  scroll(dy: number): void {
    this.main.scrollBy(0, dy);
  }

  show(view: StationView): void {
    this.station = view;
    this.root.classList.remove('hidden');
    this.render();
  }

  /** Picked runs still kept and comparable, in the order picked. */
  private picked(session: ExperimentSession): RunRecord[] {
    return (this.picks.get(session) ?? []).flatMap(
      (id) => session.history.find((r) => r.runId === id && r.status === 'completed') ?? [],
    );
  }

  private render(): void {
    const view = this.station;
    if (!view) return;
    const picked = this.picked(view.session);
    // Runs no longer kept drop out of the picks.
    this.picks.set(
      view.session,
      picked.map((r) => r.runId),
    );
    this.analysing &&= view.definition.analyses.length > 0;
    this.renderRuns(view.session, picked);
    this.main.replaceChildren(
      ...(this.analysing
        ? this.analysis(view)
        : picked.length >= 2
          ? this.comparison(view.definition, picked)
          : this.single(view, picked[0] ?? null)),
    );
  }

  private toggle(session: ExperimentSession, record: RunRecord): void {
    this.analysing = false;
    this.picks.set(session, toggleRun(this.picks.get(session) ?? [], record.runId));
    this.render();
    // The list was rebuilt: the keyboard stays on the same run.
    this.runs.querySelector<HTMLElement>(`input[data-sequence="${record.sequence}"]`)?.focus();
  }

  private renderRuns(session: ExperimentSession, picked: readonly RunRecord[]): void {
    const current = session.run;
    const key = [current?.runId, current?.status, ...session.history.map((r) => r.runId)]
      .concat('|', ...picked.map((r) => r.runId), String(this.analysing))
      .join(',');
    if (this.listed?.session === session && this.listed.key === key) return;
    this.listed = { session, key };

    const t = this.texts;
    const comparing = picked.length >= 2;
    const list = el('ol', 'results-run-list');
    if (current?.status === 'running') {
      const row = el('li', 'results-run');
      row.dataset.status = 'running';
      row.setAttribute('aria-current', 'true');
      const sequence = Number(current.runId.split('#').pop());
      row.append(
        el('span', 'results-run-settings', runSettings(current, sequence, t)),
        this.badges(['current']),
        el('span', 'results-run-outcome', t.ui('results.runningNow', 'running…')),
      );
      list.append(row);
    }
    for (const record of [...session.history].reverse()) {
      const at = picked.indexOf(record);
      const row = el('li', 'results-run');
      row.dataset.run = String(record.sequence);
      row.dataset.status = record.status;
      if (at >= 0) row.dataset.picked = String(at + 1);
      const isCurrent = record.runId === current?.runId;
      if (isCurrent) row.setAttribute('aria-current', 'true');

      const box = el('input', 'results-run-box');
      box.type = 'checkbox';
      box.checked = at >= 0;
      box.dataset.sequence = String(record.sequence);
      box.setAttribute(
        'aria-label',
        t.ui('results.select', 'Select run {n}', { n: record.sequence }),
      );
      if (record.status !== 'completed') {
        box.disabled = true;
        box.title = t.ui(
          'results.onlyCompleted',
          'Only completed runs can be viewed and compared; export it as CSV.',
        );
      } else if (at < 0 && picked.length >= COMPARE_LIMIT) {
        box.disabled = true;
        box.title = t.ui('results.compareLimit', 'Compare at most {limit} runs.', {
          limit: COMPARE_LIMIT,
        });
      }
      box.addEventListener('change', () => {
        this.toggle(session, record);
      });

      const csv = el('button', 'results-csv', 'CSV');
      csv.type = 'button';
      csv.setAttribute(
        'aria-label',
        t.ui('results.export', 'Export run {n} as CSV', { n: record.sequence }),
      );
      csv.addEventListener('click', () => {
        download(csvFileName(record), runCsv(record));
      });

      const outcome = el('span', 'results-run-outcome');
      if (comparing && at >= 0) outcome.append(swatch(at), ' ');
      outcome.append(runOutcome(record, t));
      row.append(
        box,
        el('span', 'results-run-settings', runSettings(record, record.sequence, t)),
        this.badges([
          ...(isCurrent ? ['current'] : []),
          ...(record.status !== 'completed' ? [record.status] : []),
        ]),
        outcome,
        csv,
      );
      list.append(row);
    }
    this.runs.replaceChildren(
      el('h3', undefined, t.ui('results.runs', 'Runs')),
      el(
        'p',
        'results-runs-hint',
        list.childElementCount === 0
          ? t.ui('results.runsEmpty', 'Each run you finish or stop is kept here.')
          : t.ui(
              'results.runsHint',
              'Tick a run to view it, 2–{limit} to compare. Esc frees the mouse; Tab and Space work too.',
              { limit: COMPARE_LIMIT },
            ),
      ),
      list,
      ...this.analysisButton(session),
      el(
        'p',
        'results-runs-note',
        t.ui(
          'results.runsNote',
          'The last {limit} runs of this station are kept in this browser, apart from the saved game.',
          { limit: RUN_HISTORY_LIMIT },
        ),
      ),
    );
  }

  /** The run list's way into the data analysis, for an experiment that has one. */
  private analysisButton(session: ExperimentSession): HTMLElement[] {
    if (!this.station?.definition.analyses.length) return [];
    const t = this.texts;
    const button = el(
      'button',
      'results-csv results-analysis-button',
      this.analysing
        ? t.ui('analysis.close', 'Back to the run')
        : t.ui('analysis.open', 'Analyse the runs: table and fitted line'),
    );
    button.type = 'button';
    button.setAttribute('aria-pressed', String(this.analysing));
    button.addEventListener('click', () => {
      this.analysing = !this.analysing;
      if (this.analysing) this.picks.set(session, []);
      this.render();
      this.runs.querySelector<HTMLElement>('.results-analysis-button')?.focus();
    });
    return [button];
  }

  /**
   * The station's completed runs in one table, one point each from its own record, and a straight
   * line fitted through the points the player keeps — for one group (one spring) at a time, so
   * runs of different setups are never fitted together. Worked out when the panel is drawn (a run
   * ending, a tick), never per frame.
   */
  private analysis(view: StationView): HTMLElement[] {
    const { definition, session } = view;
    const t = this.texts;
    const analyses = definition.analyses;
    const chosenId = this.chosen.get(session);
    const analysis = analyses.find((a) => a.id === chosenId) ?? analyses[0];
    const head = el(
      'h2',
      undefined,
      t.ui('analysis.head', '{experiment} — data analysis', {
        experiment: t.of(definition, 'name'),
      }),
    );
    if (!analysis) return [head];
    const which = el('select', 'analysis-which');
    which.setAttribute('aria-label', t.ui('analysis.which', 'Analysis'));
    for (const a of analyses) {
      const option = el('option', undefined, t.of(a, 'title'));
      option.value = a.id;
      option.selected = a === analysis;
      which.append(option);
    }
    which.addEventListener('change', () => {
      this.chosen.set(session, which.value);
      this.render();
    });
    const pick = el('label', 'analysis-choose', `${t.ui('analysis.which', 'Analysis')}: `);
    pick.append(which);

    const rows = analysisRows(definition, analysis, session.history);
    const last = rows.at(-1);
    if (!last) {
      return [
        head,
        pick,
        el(
          'p',
          'analysis-message',
          t.ui(
            'analysis.empty',
            'No completed run yet: every run that comes to an end by itself adds one point here.',
          ),
        ),
      ];
    }
    // A group is the runs that share every `group` parameter (e.g. one spring, one damping).
    const groupText = (values: readonly number[]) =>
      analysis.group
        .map((id, i) => {
          const p = definition.parameters.find((q) => q.id === id);
          const v = values[i] ?? NaN;
          return p ? `${p.symbol ?? t.of(p, 'label')} ${parameterValue(p, v, t)}` : `${id} ${v}`;
        })
        .join(' · ');
    const keys = [...new Map(rows.map((r) => [r.groupKey, r.group])).entries()].sort(
      ([, a], [, b]) => a.reduce((order, v, i) => order || v - (b[i] ?? 0), 0),
    );
    const groups = this.groups.get(session) ?? new Map<string, string>();
    const chosenKey = groups.get(analysis.id);
    const groupKey = keys.find(([k]) => k === chosenKey)?.[0] ?? last.groupKey;
    const inGroup = rows.filter((r) => r.groupKey === groupKey);
    const group = inGroup[0]?.group ?? [];
    const left = this.excluded.get(session) ?? new Set<string>();
    const leftKey = (row: AnalysisRow) => `${analysis.id}:${row.record.runId}`;
    const used = inGroup.filter((r) => r.invalid === null && !left.has(leftKey(r)));
    const fit = fitLine(used);
    const theory = theoryValue(inGroup, analysis.slope.theory);
    const theoryB =
      analysis.slope.intercept === undefined ? 0 : theoryValue(inGroup, analysis.slope.intercept);
    const x = analysisQuantity(definition, analysis.x);
    const y = analysisQuantity(definition, analysis.y);
    const slope = analysis.slope;

    const select = el('select', 'analysis-group');
    select.setAttribute('aria-label', t.ui('analysis.groupLabel', 'Runs with'));
    for (const [key, values] of keys) {
      const option = el(
        'option',
        undefined,
        t.ui('analysis.groupOption', '{value} ({n} runs)', {
          value: groupText(values),
          n: rows.filter((r) => r.groupKey === key).length,
        }),
      );
      option.value = key;
      option.selected = key === groupKey;
      select.append(option);
    }
    select.addEventListener('change', () => {
      this.groups.set(session, new Map(groups).set(analysis.id, select.value));
      this.render();
    });
    const choose = el('label', 'analysis-choose', `${t.ui('analysis.groupLabel', 'Runs with')}: `);
    choose.append(select);

    const columns = analysisColumns(definition, analysis);
    const table = el('table', 'results-table analysis-table');
    const header = el('tr');
    header.append(
      el('th', undefined, t.ui('analysis.use', 'Fit')),
      el('th', undefined, t.ui('analysis.run', 'Run')),
      ...columns.map((c) => el('th', undefined, c.unit ? `${c.symbol} (${c.unit})` : c.symbol)),
    );
    table.append(header);
    for (const row of inGroup) {
      const n = row.record.sequence;
      const id = leftKey(row);
      const isUsed = used.includes(row);
      const tr = el('tr', isUsed ? undefined : 'excluded');
      tr.dataset.run = String(n);
      tr.dataset.used = String(isUsed);
      const box = el('input');
      box.type = 'checkbox';
      box.checked = isUsed;
      box.disabled = row.invalid !== null;
      box.dataset.run = String(n);
      box.setAttribute('aria-label', t.ui('analysis.include', 'Use run {n} in the fit', { n }));
      box.addEventListener('change', () => {
        const next = new Set(left);
        if (box.checked) next.delete(id);
        else next.add(id);
        this.excluded.set(session, next);
        this.render();
        this.main.querySelector<HTMLElement>(`input[data-run="${n}"]`)?.focus();
      });
      const use = el('td');
      use.append(box);
      const run = el('th', undefined, `#${n}`);
      if (row.invalid !== null) run.append(' ', el('small', 'analysis-why', this.why(row)));
      tr.append(use, run, ...row.cells.map((v) => el('td', undefined, sig(v))));
      table.append(tr);
    }
    const scroll = el('div', 'analysis-scroll');
    scroll.append(table);

    const xs = Float64Array.from(used, (r) => r.x);
    const ys = Float64Array.from(used, (r) => r.y);
    const lines: Line[] = [
      { x: xs, y: ys, count: used.length, color: GREEN, dash: '', attrs: {}, dots: true },
    ];
    if (fit.status === 'fitted') {
      const at = (v: number) => fit.slope * v + fit.intercept;
      lines.push({
        x: Float64Array.of(fit.xMin, fit.xMax),
        y: Float64Array.of(at(fit.xMin), at(fit.xMax)),
        count: 2,
        color: BLUE,
        dash: '',
        attrs: { 'data-line': 'fit' },
      });
    }
    if (theory !== null && theoryB !== null && used.length > 0) {
      const [lo, hi] = extent(xs, used.length);
      lines.push({
        x: Float64Array.of(lo, hi),
        y: Float64Array.of(theory * lo + theoryB, theory * hi + theoryB),
        count: 2,
        color: AMBER,
        dash: '6 4',
        attrs: { 'data-line': 'theory' },
      });
    }
    const title = t.ui('analysis.graph', '{y} against {x}', { y: y.symbol, x: x.symbol });
    const graphs = el('div', 'results-graphs');
    graphs.append(
      plot(
        {
          'aria-label': title,
          'data-analysis': analysis.id,
          'data-points': used.length,
        },
        title,
        { x: `${x.symbol} (${x.unit})`, y: `${y.symbol} (${y.unit})` },
        lines,
      ),
    );
    const legend = el('ul', 'results-legend');
    legend.append(
      keyed(GREEN, '', t.ui('analysis.legendPoints', 'Points used: {n}', { n: used.length })),
    );
    if (fit.status === 'fitted') {
      legend.append(
        keyed(
          BLUE,
          '',
          t.ui('analysis.legendFit', 'Fitted line, drawn over the measured range only'),
        ),
      );
    }
    if (theory !== null && theoryB !== null && used.length > 0) {
      const params = {
        y: y.symbol,
        x: x.symbol,
        symbol: slope.symbol,
        value: `${sig(theory)} ${slope.unit}`,
        b: `${sig(theoryB)} ${y.unit}`,
      };
      legend.append(
        keyed(
          AMBER,
          '6 4',
          slope.intercept === undefined
            ? t.ui(
                'analysis.legendTheory',
                'Theory: {y} = {symbol}·{x}, {symbol} = {value}',
                params,
              )
            : t.ui(
                'analysis.legendTheoryIntercept',
                'Theory: {y} = {symbol}·{x} + b, {symbol} = {value}, b = {b}',
                params,
              ),
        ),
      );
    }

    const outcome: HTMLElement[] = [];
    if (fit.status === 'fitted') {
      const symbols = { symbol: slope.symbol, label: t.of(slope, 'label') };
      const difference = theory === null ? null : fit.slope - theory;
      const rowsShown: [string, string, string][] = [
        [
          t.ui('analysis.points', 'Points used'),
          'n',
          t.ui('analysis.pointsOf', '{n} of {total}', { n: fit.n, total: inGroup.length }),
        ],
        [
          t.ui('analysis.equation', 'Fitted line'),
          'equation',
          `${y.symbol} = ${sig(fit.slope)} ${slope.unit} · ${x.symbol} ${fit.intercept < 0 ? '−' : '+'} ${sig(Math.abs(fit.intercept))} ${y.unit}`,
        ],
        [
          t.ui('analysis.slope', '{label} from the fit, {symbol}_exp', symbols),
          'slope',
          `${sig(fit.slope)}${fit.slopeError === null ? '' : ` ± ${sig(fit.slopeError, 2)}`} ${slope.unit}`,
        ],
        [t.ui('analysis.intercept', 'Intercept b'), 'intercept', `${sig(fit.intercept)} ${y.unit}`],
        [
          'R²',
          'r2',
          fit.r2 === null
            ? t.ui('analysis.noR2', 'not defined: every point has the same {y}', { y: y.symbol })
            : fit.r2.toFixed(6),
        ],
        [
          t.ui('analysis.theorySlope', '{label} in the model, {symbol}_theory', symbols),
          'theory',
          theory === null ? '—' : `${sig(theory)} ${slope.unit}`,
        ],
        [
          t.ui('analysis.difference', '{symbol}_exp − {symbol}_theory', symbols),
          'difference',
          difference === null
            ? '—'
            : `${sig(difference, 3)} ${slope.unit}` +
              (theory ? ` (${signed((100 * difference) / theory)} %)` : ''),
        ],
      ];
      // A quantity the slope gives, e.g. k = 4π²/a from T² against m, with its error carried.
      const derived = analysis.derived;
      if (derived && !(fit.slope > 0)) {
        rowsShown.push([
          t.ui('analysis.derived', '{label}, from the slope', {
            symbol: derived.symbol,
            label: t.of(derived, 'label'),
          }),
          'derived',
          t.ui('analysis.noDerived', 'not defined: the slope is not positive'),
        ]);
      } else if (derived) {
        const value = derived.numerator / fit.slope;
        const error =
          fit.slopeError === null ? null : (derived.numerator * fit.slopeError) / fit.slope ** 2;
        const expected = theoryValue(inGroup, derived.theory);
        const off = expected === null ? null : value - expected;
        const names = { symbol: derived.symbol, label: t.of(derived, 'label') };
        rowsShown.push(
          [
            t.ui('analysis.derived', '{label}, from the slope', names),
            'derived',
            `${sig(value)}${error === null ? '' : ` ± ${sig(error, 2)}`} ${derived.unit}`,
          ],
          [
            t.ui('analysis.derivedTheory', '{label}, in the model', names),
            'derived-theory',
            expected === null ? '—' : `${sig(expected)} ${derived.unit}`,
          ],
          [
            t.ui('analysis.derivedDifference', '{symbol}: from the slope − in the model', names),
            'derived-difference',
            off === null || expected === null
              ? '—'
              : `${sig(off, 3)} ${derived.unit}` +
                (expected ? ` (${signed((100 * off) / expected)} %)` : ''),
          ],
        );
      }
      const summary = el('table', 'results-table analysis-fit');
      for (const [label, name, value] of rowsShown) {
        const tr = el('tr');
        tr.dataset.fit = name;
        tr.append(el('th', undefined, label), el('td', undefined, value));
        summary.append(tr);
      }
      outcome.push(summary);
      if (fit.n === 2) {
        outcome.push(
          el(
            'p',
            'analysis-message',
            t.ui(
              'analysis.twoPoints',
              'Two points always lie on a straight line: R² = 1 here says nothing about the model. Use more runs.',
            ),
          ),
        );
      }
    } else {
      outcome.push(
        el(
          'p',
          'analysis-message',
          fit.status === 'too-few'
            ? t.ui(
                'analysis.tooFew',
                'No line: a fit needs at least 2 usable points, and {n} is ticked. Tick more runs, or run again with other settings.',
                { n: fit.n },
              )
            : t.ui(
                'analysis.sameX',
                'No line: every ticked point has the same {x}, so no slope can be found. Use runs with other settings.',
                { x: x.symbol },
              ),
        ),
      );
    }

    const csv = el(
      'button',
      'results-csv analysis-csv',
      t.ui('analysis.export', 'Export the table and the fit as CSV'),
    );
    csv.type = 'button';
    csv.addEventListener('click', () => {
      download(
        analysisFileName(definition, analysis, group),
        analysisCsv(definition, analysis, group, inGroup, used, fit),
      );
    });

    return [
      head,
      ...(analyses.length > 1 ? [pick] : []),
      choose,
      el(
        'p',
        'results-runs-hint',
        t.ui(
          'analysis.hint',
          'One point per completed run with {group}, read from its own record. Untick a run to leave it out of the fit. A stopped run never came to an end and is not listed.',
          { group: groupText(group) },
        ),
      ),
      scroll,
      graphs,
      legend,
      ...outcome,
      el(
        'p',
        'results-note',
        t.ui(
          'analysis.note',
          'Ordinary least squares: the straight line y = a·x + b with the smallest sum of squared vertical distances to the points, b left free — not forced through 0, so an offset in the data shows as b instead of tilting the slope. ± is the standard error of the slope (from 3 points). R² is the share of the spread of y the line accounts for: it says how close the points lie to a line, not that the physical model is right. A b other than 0 can come from an offset in the measurement, a systematic error or the limits of the model; the data alone cannot say which. The slope through several runs ({symbol}_exp) is not the ratio y/x of any one run, nor the value set in the model ({symbol}_theory).',
          { symbol: slope.symbol },
        ),
      ),
      ...(analysis.note ? [el('p', 'results-note', t.of(analysis, 'note'))] : []),
      csv,
    ];
  }

  /** Why a run's point cannot be fitted. */
  private why(row: AnalysisRow): string {
    const t = this.texts;
    switch (row.invalid) {
      case 'time-limit':
        // Any run the model did not end itself; the player's own end is not a time limit.
        return row.record.endReason === 'player'
          ? t.ui('analysis.endedByPlayer', 'ended by you, not by the model')
          : t.ui('analysis.timeLimit', 'ended at the time limit, not by itself');
      case 'not-measured':
        return t.ui('analysis.notMeasured', 'too few whole swings to time');
      default:
        return t.ui('analysis.notFinite', 'no finite value');
    }
  }

  /** "current", and how an incomplete run ended. */
  private badges(names: readonly string[]): HTMLElement {
    const box = el('span', 'results-run-badges');
    for (const name of names) {
      const text = this.status(name);
      box.append(el('span', name === 'current' ? 'results-badge' : 'results-badge warn', text));
    }
    return box;
  }

  /** A run's status or badge as the player reads it. */
  private status(name: string): string {
    const t = this.texts;
    switch (name) {
      case 'current':
        return t.ui('results.current', 'current');
      case 'recorded':
        return t.ui('results.recorded', 'recorded');
      case 'running':
        return t.ui('results.running', 'running');
      case 'completed':
        return t.ui('results.completed', 'completed');
      case 'failed':
        return t.ui('results.failedStatus', 'failed');
      default:
        return t.ui('results.stopped', 'stopped');
    }
  }

  /** One run, the current or a recorded one: what was run, theory against measurement, graphs. */
  private single(view: StationView, record: RunRecord | null): HTMLElement[] {
    const { definition, session } = view;
    const t = this.texts;
    const name = t.of(definition, 'name');
    const run: RunData | null = record ?? session.run;
    if (!run) {
      return [
        el('h2', undefined, name),
        el(
          'p',
          undefined,
          definition.presentation === 'physical-lab'
            ? session.history.length > 0
              ? t.ui(
                  'results.noCurrentRunPhysical',
                  'No current run: clear the bench and add the first drop by hand, or tick a recorded run.',
                )
              : t.ui(
                  'results.noRunPhysical',
                  'No run yet: it starts when you add the first drop by hand.',
                )
            : session.history.length > 0
              ? t.ui(
                  'results.noCurrentRun',
                  'No current run: set up the apparatus and press RUN, or tick a recorded run.',
                )
              : t.ui('results.noRun', 'No run yet: set up the apparatus and press RUN.'),
        ),
        ...this.scatters(view),
      ];
    }
    const sequence = record?.sequence ?? Number(run.runId.split('#').pop());
    const status =
      run.status === 'completed' ? 'completed' : run.status === 'running' ? 'running' : 'stopped';
    const isCurrent = run.runId === session.run?.runId;
    const head = el(
      'h2',
      undefined,
      t.ui('results.runHead', '{experiment} — run {n} ({status})', {
        experiment: name,
        n: sequence,
        status: this.status(status),
      }),
    );
    head.append(' ', el('span', 'results-badge', this.status(isCurrent ? 'current' : 'recorded')));

    const params = el('dl', 'results-params');
    for (const p of definition.parameters) {
      params.append(
        el('dt', undefined, p.symbol ?? t.of(p, 'label')),
        el('dd', undefined, formatQuantity(run.inputs[p.id] ?? NaN, p.unit)),
      );
    }
    for (const [id, value] of Object.entries(run.inputs)) {
      if (definition.parameters.some((p) => p.id === id)) continue;
      const shown = definition.inputs[id];
      if (shown?.hidden) continue; // the student works it out
      params.append(
        el('dt', undefined, shown?.symbol ?? id),
        el('dd', undefined, formatQuantity(value, shown?.unit ?? '')),
      );
    }

    const table = el('table', 'results-table');
    const header = el('tr');
    // "Difference", not "error": a theory may itself be an approximation (small angles).
    for (const title of [
      '',
      t.ui('results.theory', 'Theory'),
      t.ui('results.simulatedColumn', 'Simulated'),
      t.ui('results.difference', 'Difference'),
    ]) {
      header.append(el('th', undefined, title));
    }
    table.append(header);
    for (const row of resultRows(definition, run, t)) {
      const tr = el('tr');
      tr.dataset.result = row.id;
      tr.append(
        el('th', undefined, row.label),
        el('td', 'theory', show(row.theory, row.unit, row.theoryClass, row.integer)),
        el('td', 'measured', show(row.measured, row.unit, row.measuredClass, row.integer)),
        el('td', 'error', formatError(row.errorPercent)),
      );
      table.append(tr);
    }

    const graphs = el('div', 'results-graphs');
    for (const g of graphData(definition, run, t)) graphs.append(drawGraph(g, t));

    const dials = definition.parameters
      .map((p) => parameterText(p, session.parameters[p.id] ?? NaN, t))
      .join(' · ');
    const recorded = isCurrent
      ? []
      : [
          el(
            'p',
            'results-recorded',
            t.ui(
              'results.recordedRun',
              'A recorded run: its own settings, theory and samples. The dials now read {dials}.',
              { dials },
            ),
          ),
        ];
    return [
      head,
      ...recorded,
      params,
      table,
      ...readingTables(definition, run, t),
      ...this.answerChecks(definition, session, run),
      ...this.oscillation(definition, run),
      graphs,
      ...this.scatters(view),
      noteFor(definition, t),
    ];
  }

  /**
   * The swing of an ended run, measured from its own samples (`measureOscillation`): the period
   * over whole cycles against the damped and undamped theory, the peaks and their decay rate
   * against ζ·ω₀, with the envelope. Each part says why when the data cannot give it.
   */
  private oscillation(definition: ExperimentDefinition, run: RunData): HTMLElement[] {
    const config = definition.oscillation;
    if (!config || run.status === 'running') return [];
    const t = this.texts;
    const m = oscillationOf(run);
    const head = el(
      'h3',
      undefined,
      t.ui('oscillation.head', 'The swing, measured from the samples'),
    );
    // Never left rest (held at y₀ = 0): a static measurement, not a swing too small to read.
    if (m.floor === 0) {
      return [
        head,
        el(
          'p',
          'results-note',
          t.ui(
            'oscillation.atRest',
            'No swing: the mass was held at rest (y₀ = 0) and stayed there, so this run is a static measurement. Set y₀ to another value to time a swing.',
          ),
        ),
      ];
    }
    const theory = run.theory() ?? {};
    const of = (id: string | undefined) => (id === undefined ? null : (theory[id] ?? null));
    const [t0, td, rate, a0] = [
      of(config.period0),
      of(config.periodDamped),
      of(config.decayRate),
      of(config.envelope0),
    ];
    const versus = (measured: number, expected: number | null, unit: string) =>
      expected === null || expected === 0
        ? '—'
        : `${sig(measured - expected, 3)} ${unit} (${signed((100 * (measured - expected)) / expected)} %)`;
    const rows: [string, string, string][] = [
      [
        t.ui('oscillation.period', 'Period T, measured'),
        'period',
        m.period
          ? t.ui('oscillation.periodValue', '{value} s over {n} whole swings', {
              value: sig(m.period.value),
              n: m.period.cycles,
            })
          : t.ui(
              'oscillation.noPeriod',
              'not measured: fewer than 2 whole swings large enough to time; a smaller ζ or a larger |y₀| gives more',
            ),
      ],
      [
        t.ui('oscillation.damped', 'Damped period T_d = 2π/ω_d, theory'),
        'period-damped',
        td === null ? t.ui('oscillation.noSwing', '— (ζ ≥ 1: no swing)') : `${sig(td)} s`,
      ],
      [
        t.ui('oscillation.undamped', 'Undamped period T₀ = 2π√(m/k), theory'),
        'period-undamped',
        t0 === null ? '—' : `${sig(t0)} s`,
      ],
      [
        t.ui('oscillation.periodDifference', 'T measured − T_d'),
        'period-difference',
        m.period ? versus(m.period.value, td, 's') : '—',
      ],
      [t.ui('oscillation.peaks', 'Peaks read'), 'peaks', String(m.peaks.length)],
      [
        t.ui('oscillation.rate', 'Decay rate σ, fitted to ln A against t'),
        'decay',
        m.decay
          ? `${sig(m.decay.rate, 4)} 1/s`
          : t.ui(
              'oscillation.noDecay',
              'not measured: fewer than 3 peaks large enough to read; a smaller ζ or a larger |y₀| gives more',
            ),
      ],
      [
        t.ui('oscillation.rateTheory', 'Decay rate ζ·ω₀, theory'),
        'decay-theory',
        rate === null ? '—' : `${sig(rate, 4)} 1/s`,
      ],
      [
        t.ui('oscillation.zeta', 'Damping ratio ζ from the logarithmic decrement'),
        'zeta',
        m.decay?.zeta === null || m.decay?.zeta === undefined
          ? '—'
          : `${sig(m.decay.zeta, 3)} (${t.ui('oscillation.setTo', 'set to {value}', {
              value: sig(of(config.dampingRatio)),
            })})`,
      ],
    ];
    const table = el('table', 'results-table oscillation-table');
    for (const [label, name, value] of rows) {
      const tr = el('tr');
      tr.dataset.oscillation = name;
      tr.append(el('th', undefined, label), el('td', undefined, value));
      table.append(tr);
    }

    const graphs: HTMLElement[] = [];
    if (m.peaks.length > 0) {
      const ts = Float64Array.from(m.peaks, (p) => p.t);
      const as = Float64Array.from(m.peaks, (p) => p.amplitude);
      const curve = (amplitude: number, decay: number) => {
        const [lo, hi] = extent(ts, ts.length);
        const x = Float64Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
        return { x, y: x.map((v) => amplitude * Math.exp(-decay * v)) };
      };
      const lines: Line[] = [
        { x: ts, y: as, count: ts.length, color: GREEN, dash: '', attrs: {}, dots: true },
      ];
      if (m.decay) {
        const fitted = curve(m.decay.amplitude0, m.decay.rate);
        lines.push({ ...fitted, count: 41, color: BLUE, dash: '', attrs: { 'data-line': 'fit' } });
      }
      if (rate !== null && a0 !== null) {
        const envelope = curve(a0, rate);
        lines.push({
          ...envelope,
          count: 41,
          color: AMBER,
          dash: '6 4',
          attrs: { 'data-line': 'theory' },
        });
      }
      const title = t.ui('oscillation.graph', 'Amplitude of each peak against time');
      const box = el('div', 'results-graphs');
      box.append(
        plot(
          { 'aria-label': title, 'data-oscillation': 'peaks', 'data-points': m.peaks.length },
          title,
          { x: 't (s)', y: 'A (m)' },
          lines,
        ),
      );
      const legend = el('ul', 'results-legend');
      legend.append(
        keyed(
          GREEN,
          '',
          t.ui('oscillation.legendPeaks', 'Peaks: y at each maximum (the mass at its lowest)'),
        ),
      );
      if (m.decay) {
        legend.append(
          keyed(BLUE, '', t.ui('oscillation.legendFit', 'Fitted through the peaks: A₀·e^(−σt)')),
        );
      }
      if (rate !== null && a0 !== null) {
        legend.append(
          keyed(
            AMBER,
            '6 4',
            t.ui('oscillation.legendTheory', 'Theory through the peaks: |y₀|·e^(−ζω₀t)'),
          ),
        );
      }
      graphs.push(box, legend);
    }
    return [
      head,
      table,
      ...graphs,
      el(
        'p',
        'results-note',
        t.ui(
          'oscillation.note',
          'Measured from the samples recorded every {interval} ms of simulated time, not from frames. y is positive downward: the period is the time between the first and last crossing of rest from y < 0 to y > 0 (the mass moving down; each found between its two samples) divided by the whole swings between them; a peak is a maximum of y — the mass at its lowest — refined through its three samples. Swings smaller than {floor} % of the largest are too small to read and are left out. The decay rate is fitted to ln A against t; δ = σ·T is the logarithmic decrement and ζ = δ/√(4π² + δ²). Let go from rest, the peaks lie on |y₀|·e^(−ζω₀t); the envelope that touches the curve, |y₀|/√(1 − ζ²)·e^(−ζω₀t), is higher and passes beside the peaks, not through them. The damped period T_d is the one a run can show; T₀ would need no damping. Close agreement here checks the numerical model against its own equations, not a real spring.',
          {
            interval: definition.simulation.sampleInterval * 1000,
            floor: PEAK_FLOOR * 100,
          },
        ),
      ),
    ];
  }

  /**
   * For a completed run, each answer the student works out (`answer`): a number field and "Check
   * my answer" (`checkAnswer`). The feedback says only whether it is right, never the value or how
   * close it must be; the text stays when it is not.
   */
  private answerChecks(
    definition: ExperimentDefinition,
    session: ExperimentSession,
    run: RunData,
  ): HTMLElement[] {
    if (run.status !== 'completed') return [];
    const t = this.texts;
    const saved = this.answers.get(session) ?? new Map<string, AnswerState>();
    this.answers.set(session, saved);
    return definition.results.flatMap((r) => {
      if (!r.answer) return [];
      const { proportionalTo } = r.answer;
      const instrument = definition.instruments.find((m) => m.result === proportionalTo);
      const key = `${run.runId}/${r.id}`;
      const quantity = t.of(r, 'label');
      const form = el('form', 'results-answer');
      form.dataset.answer = r.id;
      const field = `results-answer-${run.runId}-${r.id}`.replace(/[^A-Za-z0-9_-]/g, '-');
      const input = el('input');
      input.id = field;
      input.setAttribute('aria-describedby', `${field}-hint ${field}-feedback`);
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.value = saved.get(key)?.text ?? '';
      input.setAttribute(
        'aria-label',
        t.ui('results.answerField', 'Your value of {quantity}, in {unit}', {
          quantity,
          unit: r.unit,
        }),
      );
      const button = el('button', undefined, t.ui('results.checkAnswer', 'Check my answer'));
      button.type = 'submit';
      const feedback = el('p', 'results-answer-feedback');
      feedback.id = `${field}-feedback`;
      feedback.setAttribute('role', 'status');
      const say = (check: AnswerCheck | null) => {
        feedback.dataset.check = check ?? '';
        feedback.textContent =
          check === 'correct'
            ? t.ui('results.answerCorrect', "Correct: it agrees with this run's reading.")
            : check === 'incorrect'
              ? t.ui(
                  'results.answerIncorrect',
                  "Not right yet: check your working from this run's reading and try again.",
                )
              : check === 'incomplete'
                ? t.ui('results.answerIncomplete', 'Enter a number first.')
                : '';
      };
      say(saved.get(key)?.check ?? null);
      input.addEventListener('input', () => {
        saved.set(key, { text: input.value, check: null });
        say(null);
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const check = checkAnswer(definition, run, r.id, input.value);
        saved.set(key, { text: input.value, check });
        say(check);
      });
      form.append(input, el('span', 'results-answer-unit', r.unit), button);
      const heading = el('label', 'results-answer-label');
      heading.htmlFor = field;
      heading.textContent = t.ui('results.workOut', 'Work it out: {quantity}', { quantity });
      const hint = el(
        'p',
        'results-note',
        t.ui(
          'results.workOutHint',
          'Use this run’s reading of {reading}; keep every digit, do not round.',
          {
            reading: instrument ? t.of(instrument, 'quantity') : proportionalTo,
          },
        ),
      );
      hint.id = `${field}-hint`;
      return [heading, hint, form, feedback];
    });
  }

  /**
   * The station's completed runs as points (`scatters`), each from its own record: x the input it
   * ran with, y its simulated result. No line is fitted and no theory drawn.
   */
  private scatters(view: StationView): HTMLElement[] {
    const { definition, session } = view;
    if (definition.scatters.length === 0) return [];
    const t = this.texts;
    const axis = (symbol: string, unit: string) => (unit ? `${symbol} (${unit})` : symbol);
    const grid = el('div', 'results-graphs');
    for (const s of definition.scatters) {
      const points = session.history.flatMap((record) => {
        const x = record.inputs[s.x];
        const y = record.status === 'completed' ? record.results[s.y] : undefined;
        return x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)
          ? [[x, y] as const]
          : [];
      });
      if (points.length === 0) continue; // no completed run yet: no empty plot
      const p = definition.parameters.find((q) => q.id === s.x);
      const r = definition.results.find((q) => q.id === s.y);
      const title = t.of(s, 'title');
      grid.append(
        plot(
          {
            'aria-label': t.ui(
              'results.scatterLabel',
              '{title}: {n} completed runs, one point each',
              {
                title,
                n: points.length,
              },
            ),
            'data-scatter': s.id,
            'data-points': points.length,
          },
          title,
          {
            x: axis(p?.symbol ?? s.x, p?.unit ?? ''),
            y: axis(r?.symbol ?? s.y, r?.unit ?? ''),
          },
          [
            {
              x: Float64Array.from(points, ([x]) => x),
              y: Float64Array.from(points, ([, y]) => y),
              count: points.length,
              color: BLUE,
              dash: '',
              attrs: {},
              dots: true,
            },
          ],
        ),
      );
    }
    if (grid.childElementCount === 0) return [];
    return [
      grid,
      el(
        'p',
        'results-note',
        t.ui(
          'results.scatterNote',
          'Each point is one completed run of this station, from its own record: x its setting, y its simulated result. No line is fitted and no theory is drawn.',
        ),
      ),
    ];
  }

  /** Two to four recorded runs side by side: settings, results with their own theory, overlays. */
  private comparison(definition: ExperimentDefinition, runs: readonly RunRecord[]): HTMLElement[] {
    const t = this.texts;
    const labels = runLabels(runs, t);
    const graphs = comparisonGraphs(definition, runs, t);

    const legend = el('ul', 'results-legend');
    runs.forEach((run, i) => {
      const item = el('li');
      item.dataset.run = String(run.sequence);
      item.append(swatch(i), el('span', undefined, labels[i] ?? ''));
      legend.append(item);
    });
    for (const name of new Set(graphs.flatMap((g) => g.markName ?? []))) {
      legend.append(
        el(
          'li',
          'results-legend-mark',
          t.ui('results.marks', "Vertical lines: each run's own theory for {name}", { name }),
        ),
      );
    }

    const table = el('table', 'results-table results-compare');
    const header = el('tr');
    header.append(el('th'));
    runs.forEach((run, i) => {
      const th = el('th');
      th.dataset.run = String(run.sequence);
      th.append(swatch(i), document.createTextNode(` #${run.sequence}`));
      header.append(th);
    });
    table.append(header);
    for (const p of definition.parameters) {
      const tr = el('tr');
      tr.dataset.parameter = p.id;
      tr.append(el('th', undefined, p.symbol ?? t.of(p, 'label')));
      for (const run of runs) {
        tr.append(el('td', undefined, parameterValue(p, run.inputs[p.id] ?? NaN, t)));
      }
      table.append(tr);
    }
    const rows = runs.map((run) => resultRows(definition, run, t));
    shownResults(definition).forEach((r, k) => {
      const tr = el('tr');
      tr.dataset.result = r.id;
      tr.append(el('th', undefined, t.of(r, 'label')));
      for (const list of rows) {
        const row = list[k];
        const td = el('td');
        td.append(
          el(
            'span',
            'measured',
            show(row?.measured ?? null, r.unit, row?.measuredClass ?? null, row?.integer),
          ),
          el(
            'small',
            'theory',
            t.ui('results.theoryValue', 'theory {value}', {
              value: show(row?.theory ?? null, r.unit, row?.theoryClass ?? null, row?.integer),
            }),
          ),
        );
        tr.append(td);
      }
      table.append(tr);
    });
    // Each run's own reading and uncertainty, at the resolution it was run with (row d above).
    const read = runs.map((run) => readings(definition, run));
    definition.instruments.forEach((instrument, k) => {
      const tr = el('tr');
      tr.dataset.reading = instrument.result;
      tr.append(
        el(
          'th',
          undefined,
          t.ui('results.quantityReading', '{quantity} reading', {
            quantity: t.of(instrument, 'quantity'),
          }),
        ),
      );
      for (const list of read) {
        const r = list[k];
        const td = el('td');
        td.append(
          el('span', 'reading', r ? shown(r) : '—'),
          el('small', 'uncertainty', r ? `u ${formatUncertainty(r.uncertainty)} ${r.unit}` : ''),
        );
        tr.append(td);
      }
      table.append(tr);
    });

    const grid = el('div', 'results-graphs');
    for (const g of graphs) grid.append(drawComparison(g));

    return [
      el(
        'h2',
        undefined,
        t.ui('results.comparing', '{experiment} — comparing runs {runs}', {
          experiment: t.of(definition, 'name'),
          runs: runs.map((r) => `#${r.sequence}`).join(', '),
        }),
      ),
      legend,
      table,
      grid,
      el(
        'p',
        'results-note',
        t.ui(
          'results.compareNote',
          "Each line is a run's own recorded samples; each theory value is for that run's own settings, each reading and its u = d/√12 for that run's own resolution d. Nothing here is recomputed from the current dials.",
        ),
      ),
    ];
  }
}
