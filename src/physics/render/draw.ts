import type { Locale } from '@/app/i18n/types';
import { formatNumber } from '@/app/i18n';
import type { Camera } from './camera';
import { niceStep } from './camera';
import type { ThemeColors } from '../types';

/**
 * Canvas label size following the UI font scale (Settings → font size, and the larger
 * text of presentation mode). `--font-scale` is set inline on <html> by useApplyTheme.
 */
export function fontPx(base: number): string {
  const scale = Number(document.documentElement.style.getPropertyValue('--font-scale')) || 1;
  return `${String(Math.round(base * scale * 10) / 10)}px`;
}

type Ctx = CanvasRenderingContext2D;
export interface Pt {
  x: number;
  y: number;
}

export function drawGrid(ctx: Ctx, cam: Camera, colors: ThemeColors, locale: Locale): void {
  const v = cam.visible();
  const major = niceStep(cam.scale, 90);
  const minor = major / 5;
  ctx.save();
  ctx.lineWidth = 1;
  const lines = (step: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = Math.ceil(v.xMin / step) * step; x <= v.xMax; x += step) {
      const { sx } = cam.toScreen(x, 0);
      ctx.moveTo(Math.round(sx) + 0.5, 0);
      ctx.lineTo(Math.round(sx) + 0.5, cam.height);
    }
    for (let y = Math.ceil(v.yMin / step) * step; y <= v.yMax; y += step) {
      const { sy } = cam.toScreen(0, y);
      ctx.moveTo(0, Math.round(sy) + 0.5);
      ctx.lineTo(cam.width, Math.round(sy) + 0.5);
    }
    ctx.stroke();
  };
  if (minor * cam.scale > 12) lines(minor, colors.grid);
  lines(major, colors.gridMajor);

  // Axis labels (metres) along the bottom and left edges.
  ctx.fillStyle = colors.faint;
  ctx.font = `${fontPx(11)} ui-monospace, Consolas, monospace`;
  const digits = Math.max(0, -Math.floor(Math.log10(major) + 1e-9));
  const fmt = (n: number) =>
    formatNumber(locale, Math.abs(n) < major / 1e6 ? 0 : n, { maximumFractionDigits: digits });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let x = Math.ceil(v.xMin / major) * major; x <= v.xMax; x += major) {
    const { sx } = cam.toScreen(x, 0);
    ctx.fillText(fmt(x), sx, cam.height - 4);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(v.yMin / major) * major; y <= v.yMax; y += major) {
    const { sy } = cam.toScreen(0, y);
    if (sy > cam.height - 18) continue;
    ctx.fillText(fmt(y), 4, sy);
  }
  ctx.restore();
}

/** Arrow from world point (x, y) along world vector (dx, dy). */
export function arrow(
  ctx: Ctx,
  cam: Camera,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
  text?: string,
): void {
  const a = cam.toScreen(x, y);
  const b = cam.toScreen(x + dx, y + dy);
  const len = Math.hypot(b.sx - a.sx, b.sy - a.sy);
  if (len < 2) return;
  const ang = Math.atan2(b.sy - a.sy, b.sx - a.sx);
  const head = Math.min(10, len * 0.4);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx - Math.cos(ang) * head * 0.6, b.sy - Math.sin(ang) * head * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.sx, b.sy);
  ctx.lineTo(b.sx - Math.cos(ang - 0.4) * head, b.sy - Math.sin(ang - 0.4) * head);
  ctx.lineTo(b.sx - Math.cos(ang + 0.4) * head, b.sy - Math.sin(ang + 0.4) * head);
  ctx.closePath();
  ctx.fill();
  if (text) {
    ctx.font = `italic 600 ${fontPx(13)} "Cambria Math", "Times New Roman", serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, b.sx + 4, b.sy - 2);
  }
  ctx.restore();
}

export function circle(
  ctx: Ctx,
  cam: Camera,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke?: string,
  minPx = 5,
): void {
  const { sx, sy } = cam.toScreen(x, y);
  const pr = Math.max(minPx, r * cam.scale);
  ctx.beginPath();
  ctx.arc(sx, sy, pr, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Ground line at world y with a hatched underside. */
export function ground(
  ctx: Ctx,
  cam: Camera,
  y: number,
  colors: ThemeColors,
  x0?: number,
  x1?: number,
): void {
  const v = cam.visible();
  const a = cam.toScreen(x0 ?? v.xMin, y);
  const b = cam.toScreen(x1 ?? v.xMax, y);
  ctx.save();
  ctx.strokeStyle = colors.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let sx = Math.floor(a.sx / 12) * 12 + 12; sx < b.sx; sx += 12) {
    ctx.moveTo(sx, a.sy + 1);
    ctx.lineTo(sx - 8, a.sy + 9);
  }
  ctx.stroke();
  ctx.restore();
}

/** Line in world coordinates. */
export function line(
  ctx: Ctx,
  cam: Camera,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  width = 1.5,
  dash?: number[],
): void {
  const a = cam.toScreen(x0, y0);
  const b = cam.toScreen(x1, y1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.restore();
}

/** Zig-zag spring between two world points. */
export function spring(
  ctx: Ctx,
  cam: Camera,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  coils = 12,
  widthPx = 9,
): void {
  const a = cam.toScreen(x0, y0);
  const b = cam.toScreen(x1, y1);
  const len = Math.hypot(b.sx - a.sx, b.sy - a.sy);
  if (len < 1) return;
  const ux = (b.sx - a.sx) / len;
  const uy = (b.sy - a.sy) / len;
  const nx = -uy;
  const ny = ux;
  const lead = Math.min(10, len * 0.1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(a.sx + ux * lead, a.sy + uy * lead);
  const body = len - 2 * lead;
  const n = coils * 2;
  for (let i = 1; i < n; i++) {
    const t = lead + (body * i) / n;
    const side = i % 2 ? 1 : -1;
    ctx.lineTo(a.sx + ux * t + nx * widthPx * side, a.sy + uy * t + ny * widthPx * side);
  }
  ctx.lineTo(b.sx - ux * lead, b.sy - uy * lead);
  ctx.lineTo(b.sx, b.sy);
  ctx.stroke();
  ctx.restore();
}

/** Rectangle (block) centred at (x, y), size w×h metres, rotated by `angle` rad (CCW). */
export function block(
  ctx: Ctx,
  cam: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
  fill: string,
  stroke: string,
  text?: string,
): void {
  const { sx, sy } = cam.toScreen(x, y);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-angle);
  const pw = Math.max(6, w * cam.scale);
  const ph = Math.max(6, h * cam.scale);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, Math.min(4, pw / 6));
  ctx.fill();
  ctx.stroke();
  if (text) {
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fontPx(12)} system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

export function text(
  ctx: Ctx,
  cam: Camera,
  x: number,
  y: number,
  value: string,
  color: string,
  align: CanvasTextAlign = 'left',
  offset = { x: 6, y: -6 },
): void {
  const { sx, sy } = cam.toScreen(x, y);
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontPx(12)} system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'bottom';
  ctx.fillText(value, sx + offset.x, sy + offset.y);
  ctx.restore();
}

/** Polyline through world points (trails, curves). */
export function polyline(
  ctx: Ctx,
  cam: Camera,
  pts: readonly Pt[],
  color: string,
  width = 1.5,
  dash?: number[],
): void {
  const first = pts[0];
  if (!first || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  const s0 = cam.toScreen(first.x, first.y);
  ctx.moveTo(s0.sx, s0.sy);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const s = cam.toScreen(p.x, p.y);
    ctx.lineTo(s.sx, s.sy);
  }
  ctx.stroke();
  ctx.restore();
}

/** Filled polygon in world coordinates. */
export function polygon(ctx: Ctx, cam: Camera, pts: readonly Pt[], fill: string, stroke?: string) {
  const first = pts[0];
  if (!first) return;
  ctx.save();
  ctx.beginPath();
  const s0 = cam.toScreen(first.x, first.y);
  ctx.moveTo(s0.sx, s0.sy);
  for (const p of pts.slice(1)) {
    const s = cam.toScreen(p.x, p.y);
    ctx.lineTo(s.sx, s.sy);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Scale (m per unit) so a vector of magnitude `ref` spans `fraction` of `viewSize` metres. */
export function vectorScale(ref: number, viewSize: number, fraction = 0.18): number {
  return ref > 1e-12 ? (viewSize * fraction) / ref : 0;
}
