import type { Texts } from '../../../core/i18n';
import type { StationView } from '../../../gameplay/experiment/StationSystem';
import { el, svg } from '../dom';
import { extent, niceAxis, scale, tickLabel } from '../plot';
import { graphFor } from '../results';
import { type WorkspaceLabels, workspaceLabels } from './labels';

const W = 360;
const H = 220;
const PAD = { left: 48, right: 12, top: 12, bottom: 36 };
/** Series are told apart by colour and by line style, and named in the legend. */
const STYLES = [
  { color: '#4fb3d9', dash: '' },
  { color: '#f0a35a', dash: '8 4' },
  { color: '#7bd88f', dash: '2 3' },
] as const;
const setText = (node: Node, text: string): void => {
  if (node.textContent !== text) node.textContent = text;
};

/** The graph is redrawn at most this often while a run goes (seconds). */
const REFRESH_S = 0.1;

/**
 * The live monitor graph (the definition's `monitor`, else its first graph) drawn from the current
 * run's own sample buffers with the results panel's plot helpers: nothing is smoothed or
 * recomputed. The frame (axes, grid, legend) is rebuilt only when the run, the graph or the axis
 * range changes; otherwise a redraw only rewrites each polyline's points, and only when a sample
 * arrived, at most ten times a second.
 */
export class LiveGraph {
  readonly root = el('figure', 'ws-graph');
  private readonly caption = el('figcaption', 'ws-graph-title');
  private readonly body = el('div', 'ws-graph-body');
  private readonly empty = el('p', 'ws-graph-empty');
  private view: StationView | null = null;
  private lines: SVGPolylineElement[] = [];
  private frame = '';
  private drawnRun = '';
  private drawnCount = -1;
  private last = -Infinity;
  /** Built once: the host builds a new graph whenever the language changes. */
  private readonly labels: WorkspaceLabels;

  constructor(private readonly texts: Texts) {
    this.labels = workspaceLabels(texts);
    this.root.append(this.caption, this.body, this.empty);
  }

  /** The station (or null) whose run is drawn; forces a redraw. */
  show(view: StationView | null): void {
    this.view = view;
    this.drawnRun = '';
    this.drawnCount = -1;
    this.last = -Infinity;
    this.redraw();
  }

  /** Called each frame with the workspace's clock (s): redraws when a new sample has arrived. */
  tick(now: number): void {
    const run = this.view?.session.run;
    if (!run || now - this.last < REFRESH_S) return;
    if (run.runId === this.drawnRun && run.sampleCount === this.drawnCount) return;
    this.last = now;
    this.redraw();
  }

  private redraw(): void {
    const view = this.view;
    const run = view?.session.run ?? null;
    const { labels } = this;
    const definition = view?.definition;
    const spec =
      definition &&
      (definition.graphs.find((g) => g.id === definition.monitor) ?? definition.graphs[0]);
    this.drawnRun = run?.runId ?? '';
    this.drawnCount = run?.sampleCount ?? -1;
    if (!view || !definition || !spec) {
      this.root.classList.add('hidden');
      return;
    }
    this.root.classList.remove('hidden');
    const data = run && run.sampleCount > 0 ? graphFor(definition, run, spec, this.texts) : null;
    setText(this.caption, `${labels.graph}: ${this.texts.of(spec, 'title')}`);
    setText(this.empty, labels.noGraph);
    this.empty.classList.toggle('hidden', data !== null);
    if (!data) {
      this.body.replaceChildren();
      this.lines = [];
      this.frame = '';
      return;
    }
    const [x0, x1] = extent(data.x.values, data.count);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of data.y) {
      const [lo, hi] = extent(s.values, data.count);
      y0 = Math.min(y0, lo);
      y1 = Math.max(y1, hi);
    }
    const ax = niceAxis(x0, x1);
    const ay = niceAxis(Math.min(0, y0), y1);
    const frame = `${data.id}|${ax.min}|${ax.max}|${ay.min}|${ay.max}|${data.y.length}`;
    const sx = scale(ax.min, ax.max, PAD.left, W - PAD.right);
    const sy = scale(ay.min, ay.max, H - PAD.bottom, PAD.top);
    if (frame !== this.frame) {
      this.frame = frame;
      const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': data.title });
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
        svg('text', { x: W - PAD.right, y: H - 6, class: 'axis-label x' }, data.xLabel),
        svg(
          'text',
          { x: 12, y: (PAD.top + H - PAD.bottom) / 2, class: 'axis-label y' },
          data.yLabel,
        ),
      );
      this.lines = data.y.map((_, i) => {
        const style = STYLES[i % STYLES.length] ?? STYLES[0];
        return svg('polyline', {
          class: 'series',
          fill: 'none',
          stroke: style.color,
          'stroke-width': 2,
          ...(style.dash ? { 'stroke-dasharray': style.dash } : {}),
        });
      });
      root.append(...this.lines);
      const legend = el('ul', 'ws-graph-legend');
      for (const [i, s] of data.y.entries()) {
        const item = el('li', undefined, s.label);
        item.style.setProperty('--series', STYLES[i % STYLES.length]?.color ?? '');
        legend.append(item);
      }
      this.body.replaceChildren(root, ...(data.y.length > 1 ? [legend] : []));
    }
    data.y.forEach((s, i) => {
      let points = '';
      for (let k = 0; k < data.count; k++) {
        const x = data.x.values[k] ?? Number.NaN;
        const y = s.values[k] ?? Number.NaN;
        if (Number.isFinite(x) && Number.isFinite(y))
          points += `${sx(x).toFixed(1)},${sy(y).toFixed(1)} `;
      }
      this.lines[i]?.setAttribute('points', points);
    });
  }
}
