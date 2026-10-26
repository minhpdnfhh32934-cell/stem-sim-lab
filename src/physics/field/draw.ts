import { arrow, circle, line, polyline, text, vectorScale } from '../render/draw';
import { fmtQty } from '../common/tex';
import type { DrawContext, Params, WorldBounds } from '../types';
import { FE } from './engine';
import { traceFieldLines, type FieldLines, type Frame } from './fieldLines';
import { MODE, fieldSetup, type FieldSetup } from './model';

/** Region shown for these parameters: every charge and point M, or the capacitor. */
export function fieldView(p: Params): WorldBounds {
  const s = fieldSetup(p);
  if (s.mode === MODE.plates) {
    const w = s.plates.w;
    return { xMin: -0.75 * w, xMax: 0.75 * w, yMin: -0.55 * w, yMax: 0.55 * w };
  }
  const xs = [...s.charges.map((c) => c.x), s.probe.x];
  const ys = [...s.charges.map((c) => c.y), s.probe.y];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const half = Math.max(0.1, 0.65 * Math.max(x1 - x0, y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { xMin: cx - 1.3 * half, xMax: cx + 1.3 * half, yMin: cy - half, yMax: cy + half };
}

/** Field lines are traced over twice the view, so they run on past the edges of a wide stage. */
export function lineFrame(p: Params): Frame {
  const v = fieldView(p);
  const hx = v.xMax - v.xMin;
  const hy = v.yMax - v.yMin;
  return {
    xMin: v.xMin - hx / 2,
    xMax: v.xMax + hx / 2,
    yMin: v.yMin - hy / 2,
    yMax: v.yMax + hy / 2,
  };
}

/** Radius of a charge's disc, where its lines start (`fieldLines.ts` SEED_RADIUS). */
export function chargeRadius(p: Params): number {
  const f = lineFrame(p);
  return 0.02 * Math.max(f.xMax - f.xMin, f.yMax - f.yMin);
}

let cached: { key: string; lines: FieldLines } | undefined;

/** Field lines for these parameters: traced once per parameter change, never per frame. */
export function linesFor(p: Params): FieldLines {
  const s = fieldSetup(p);
  const key = JSON.stringify([s.charges, s.k, lineFrame(p)]);
  if (cached?.key !== key) cached = { key, lines: traceFieldLines(s.charges, s.k, lineFrame(p)) };
  return cached.lines;
}

const SUB = ['₁', '₂', '₃'];

function drawPlates({ ctx, cam, opts }: DrawContext, s: FieldSetup): void {
  const col = opts.colors;
  const { U, d, w } = s.plates;
  // + plate on top when U > 0 (E points from the + plate to the − plate).
  const top = U >= 0 ? col.acceleration : col.velocity;
  const bottom = U >= 0 ? col.velocity : col.acceleration;
  line(ctx, cam, -w / 2, d / 2, w / 2, d / 2, top, 5);
  line(ctx, cam, -w / 2, -d / 2, w / 2, -d / 2, bottom, 5);
  text(ctx, cam, w / 2, d / 2, U >= 0 ? '+' : '−', top, 'left', { x: 8, y: 8 });
  text(ctx, cam, w / 2, -d / 2, U >= 0 ? '−' : '+', bottom, 'left', { x: 8, y: 8 });
  const e = U / d;
  if (e !== 0) {
    const lines = 9;
    for (let i = 0; i < lines; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / lines;
      line(ctx, cam, x, d / 2, x, -d / 2, col.muted, 1.2);
      arrow(ctx, cam, x, (Math.sign(e) * d) / 6, 0, (-Math.sign(e) * d) / 3, col.muted);
    }
  }
  if (opts.vectors && e !== 0) {
    arrow(ctx, cam, 0, 0, 0, -Math.sign(e) * 0.35 * d, col.force, 'E');
  }
  circle(ctx, cam, 0, 0, 0.004 * w, opts.selected === 'probe' ? col.accent : col.text, col.text, 4);
  text(
    ctx,
    cam,
    -0.75 * w,
    0.55 * w,
    `U = ${fmtQty(opts.locale, U, 'V')}, d = ${fmtQty(opts.locale, d, 'cm')}, E = ${fmtQty(opts.locale, Math.abs(e), 'V/m')}`,
    col.muted,
    'left',
    { x: 60, y: 18 },
  );
}

function drawCharges({ ctx, cam, state, p, opts }: DrawContext, s: FieldSetup): void {
  const col = opts.colors;
  const r0 = chargeRadius(p);
  const { lines, nullPoints } = linesFor(p);
  const px = 14 / cam.scale;
  for (const l of lines) {
    const pts = [];
    for (let i = 0; i + 1 < l.points.length; i += 2) {
      pts.push({ x: l.points[i] ?? 0, y: l.points[i + 1] ?? 0 });
    }
    // A line cut by its step budget is dashed: it may not end where the true line ends.
    polyline(ctx, cam, pts, col.muted, 1.2, l.end === 'steps' ? [5, 4] : undefined);
    const mid = pts[Math.floor(pts.length / 2)];
    const next = pts[Math.floor(pts.length / 2) + 1];
    if (mid && next) {
      const len = Math.hypot(next.x - mid.x, next.y - mid.y);
      if (len > 0) {
        const ux = (l.dir * (next.x - mid.x)) / len;
        const uy = (l.dir * (next.y - mid.y)) / len;
        arrow(ctx, cam, mid.x - (ux * px) / 2, mid.y - (uy * px) / 2, ux * px, uy * px, col.muted);
      }
    }
  }
  for (const [x, y] of nullPoints) {
    circle(ctx, cam, x, y, 0, col.panel, col.text, 4);
    text(ctx, cam, x, y, 'E = 0', col.text);
  }
  s.charges.forEach((c, i) => {
    const color = c.q >= 0 ? col.acceleration : col.velocity;
    circle(ctx, cam, c.x, c.y, r0, color, col.text, 9);
    text(ctx, cam, c.x, c.y, c.q >= 0 ? '+' : '−', col.panel, 'center', { x: 0, y: 7 });
    text(ctx, cam, c.x, c.y, `q${SUB[i] ?? ''}`, col.text, 'left', { x: 12, y: -10 });
  });
  const { x, y } = s.probe;
  circle(ctx, cam, x, y, 0, opts.selected === 'probe' ? col.accent : col.text, undefined, 4);
  text(ctx, cam, x, y, 'M', col.text, 'left', { x: 6, y: 14 });
  const e = state[FE.e] ?? 0;
  if (opts.vectors && e > 0) {
    const v = fieldView(p);
    const k = vectorScale(e, v.yMax - v.yMin, 0.25);
    arrow(ctx, cam, x, y, (state[FE.ex] ?? 0) * k, (state[FE.ey] ?? 0) * k, col.force, 'E');
  }
  const v = fieldView(p);
  text(ctx, cam, v.xMin, v.yMax, `E(M) = ${fmtQty(opts.locale, e, 'V/m')}`, col.muted, 'left', {
    x: 60,
    y: 18,
  });
}

export function drawField(dc: DrawContext): void {
  const s = fieldSetup(dc.p);
  if (s.mode === MODE.plates) drawPlates(dc, s);
  else drawCharges(dc, s);
}
