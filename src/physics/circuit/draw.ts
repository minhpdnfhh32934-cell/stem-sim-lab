/**
 * The circuit diagram on the stage: the source (E, r) on the left with an ammeter in the main wire
 * and a voltmeter across its terminals, the external circuit along the top. Diagram units, not a
 * scale drawing: the stage grid has no meaning here (the Science Card says so).
 */
import { fmtQty } from '../common/tex';
import { circle, line, text } from '../render/draw';
import type { DrawContext, Params, WorldBounds } from '../types';
import { CE } from './engine';
import { LAYOUT, circuitInput, solveCircuit } from './model';

const TOP = 4;
const RIGHT = 8.4;
const SUB = ['₁', '₂', '₃'];

/** Centre of each used resistor and the wires that join them, per layout (diagram units). */
export function placement(layout: number): {
  at: { x: number; y: number }[];
  wires: [number, number, number, number][];
} {
  const top: [number, number, number, number][] = [[0, TOP, RIGHT, TOP]];
  const branch = (xL: number, xR: number, ys: number[]): [number, number, number, number][] => [
    [xL, Math.min(...ys), xL, Math.max(...ys)],
    [xR, Math.min(...ys), xR, Math.max(...ys)],
    ...ys.map((y): [number, number, number, number] => [xL, y, xR, y]),
    [0, TOP, xL, TOP],
    [xR, TOP, RIGHT, TOP],
  ];
  switch (layout) {
    case LAYOUT.one:
      return { at: [{ x: 5, y: TOP }], wires: top };
    case LAYOUT.series2:
      return { at: [3.8, 6.4].map((x) => ({ x, y: TOP })), wires: top };
    case LAYOUT.series3:
      return { at: [3.2, 5.1, 7].map((x) => ({ x, y: TOP })), wires: top };
    case LAYOUT.parallel2:
      return {
        at: [4.8, 3.2].map((y) => ({ x: 5.2, y })),
        wires: branch(3.2, 7.2, [4.8, 3.2]),
      };
    case LAYOUT.parallel3:
      return {
        at: [5.2, 4, 2.8].map((y) => ({ x: 5.2, y })),
        wires: branch(3.2, 7.2, [5.2, 4, 2.8]),
      };
    case LAYOUT.seriesParallel:
      return {
        at: [
          { x: 2.8, y: TOP },
          { x: 6, y: 4.8 },
          { x: 6, y: 3.2 },
        ],
        wires: branch(4.4, 7.6, [4.8, 3.2]),
      };
    default:
      return {
        at: [
          { x: 4.2, y: 4.8 },
          { x: 6.2, y: 4.8 },
          { x: 5.2, y: 3.2 },
        ],
        wires: branch(2.8, 7.6, [4.8, 3.2]),
      };
  }
}

export function circuitView(_p: Params): WorldBounds {
  return { xMin: -3.2, xMax: 10, yMin: -1.6, yMax: 6.6 };
}

export function drawCircuit({ ctx, cam, state, p, opts }: DrawContext): void {
  const col = opts.colors;
  const c = circuitInput(p);
  const parts = solveCircuit(c).parts;
  const { at, wires } = placement(c.layout);
  const q = (v: number, u: string) => fmtQty(opts.locale, v, u);
  // Wires: the external circuit, the right side and the bottom back to the − terminal.
  for (const [x0, y0, x1, y1] of wires) line(ctx, cam, x0, y0, x1, y1, col.text, 2);
  line(ctx, cam, RIGHT, TOP, RIGHT, 0, col.text, 2);
  line(ctx, cam, RIGHT, 0, 0, 0, col.text, 2);
  // Source: the long plate is +, the short one −; the wire joins them through E and r.
  line(ctx, cam, 0, 0, 0, 1.75, col.text, 2);
  line(ctx, cam, 0, 2.25, 0, TOP, col.text, 2);
  line(ctx, cam, -0.6, 2.25, 0.6, 2.25, col.text, 2.5);
  line(ctx, cam, -0.3, 1.75, 0.3, 1.75, col.text, 5);
  text(ctx, cam, 0.7, 2.25, '+', col.text, 'left', { x: 0, y: 4 });
  text(ctx, cam, 0.45, 1.75, '−', col.text, 'left', { x: 0, y: 12 });
  text(ctx, cam, 0.9, 2, `E = ${q(c.emf, 'V')}, r = ${q(c.r, 'ohm')}`, col.muted, 'left', {
    x: 4,
    y: 6,
  });
  // Ammeter in the main wire, reading the current through the source.
  circle(ctx, cam, 1.3, TOP, 0.38, col.panel, col.text, 1.5);
  text(ctx, cam, 1.3, TOP, 'A', col.text, 'center', { x: 0, y: 6 }, false);
  text(ctx, cam, 1.3, TOP + 0.4, `I = ${q(state[CE.I] ?? 0, 'A')}`, col.accent, 'center', {
    x: 0,
    y: -4,
  });
  // Voltmeter across the terminals.
  line(ctx, cam, 0, 3.2, -2, 3.2, col.muted, 1.5);
  line(ctx, cam, -2, 3.2, -2, 0.8, col.muted, 1.5);
  line(ctx, cam, -2, 0.8, 0, 0.8, col.muted, 1.5);
  circle(ctx, cam, -2, 2, 0.38, col.panel, col.text, 1.5);
  text(ctx, cam, -2, 2, 'V', col.text, 'center', { x: 0, y: 6 }, false);
  text(ctx, cam, -2, 0.8, `U = ${q(state[CE.U] ?? 0, 'V')}`, col.accent, 'center', {
    x: 0,
    y: 22,
  });
  // Resistors: a box with its name; the selected one is outlined in the accent colour.
  at.forEach(({ x, y }, i) => {
    const sel = opts.selected === `R${String(i + 1)}`;
    const { sx, sy } = cam.toScreen(x, y);
    const w = 1.2 * cam.scale;
    const h = 0.42 * cam.scale;
    ctx.save();
    ctx.fillStyle = col.panel;
    ctx.strokeStyle = sel ? col.accent : col.text;
    ctx.lineWidth = sel ? 3 : 2;
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
    ctx.restore();
    text(ctx, cam, x, y, `R${SUB[i] ?? ''}`, col.text, 'center', { x: 0, y: 6 }, false);
    const part = parts[i];
    if (part) text(ctx, cam, x, y - 0.2, q(part.R, 'ohm'), col.muted, 'center', { x: 0, y: 16 });
  });
}
