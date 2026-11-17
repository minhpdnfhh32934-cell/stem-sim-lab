import { formatNumber, type Locale } from '@/app/i18n';

/**
 * Small 2D chart kit for the physics modules that draw their own canvas (heat curve, gas laws,
 * induction, …): grid and labelled axes from SI values with a display scale, dots with labels,
 * two charts side by side. Pure drawing, no state.
 */

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Css = (token: string) => string;

/** 1, 2, 5 × 10ⁿ just above x. */
export function niceStep(x: number): number {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/**
 * Axes, grid and labels of one chart; values are SI, `xs`/`ys` turn them into the shown unit.
 * Returns the maps from values to pixels.
 */
export function axes(
  ctx: CanvasRenderingContext2D,
  css: Css,
  locale: Locale,
  f: Frame,
  xr: readonly [number, number],
  yr: readonly [number, number],
  labels: { x: string; y: string },
  xs = 1,
  ys = 1,
) {
  const X = (v: number) => f.x + ((v - xr[0]) / (xr[1] - xr[0])) * f.w;
  const Y = (v: number) => f.y + f.h - ((v - yr[0]) / (yr[1] - yr[0])) * f.h;
  ctx.font = '12px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeStyle = css('--border');
  ctx.fillStyle = css('--text-muted');
  const yStep = niceStep(((yr[1] - yr[0]) * ys) / 5);
  ctx.textAlign = 'right';
  for (let v = Math.ceil((yr[0] * ys) / yStep) * yStep; v <= yr[1] * ys + 1e-9; v += yStep) {
    const y = Y(v / ys);
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x + f.w, y);
    ctx.stroke();
    ctx.fillText(formatNumber(locale, Number(v.toPrecision(6))), f.x - 6, y + 4);
  }
  const xStep = niceStep(((xr[1] - xr[0]) * xs) / 5);
  ctx.textAlign = 'center';
  for (let v = Math.ceil((xr[0] * xs) / xStep) * xStep; v <= xr[1] * xs + 1e-9; v += xStep)
    ctx.fillText(formatNumber(locale, Number(v.toPrecision(6))), X(v / xs), f.y + f.h + 16);
  ctx.fillText(labels.x, f.x + f.w / 2, f.y + f.h + 34);
  ctx.save();
  ctx.translate(f.x - 46, f.y + f.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(labels.y, 0, 0);
  ctx.restore();
  ctx.strokeStyle = css('--text-muted');
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.lineTo(f.x, f.y + f.h);
  ctx.lineTo(f.x + f.w, f.y + f.h);
  ctx.stroke();
  return { X, Y };
}

export function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label?: string,
  left = false,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = left ? 'right' : 'left';
    ctx.fillText(label, left ? x - 8 : x + 8, y - 8);
  }
}

/** Two charts side by side under the overlay chips. */
export function twoFrames(width: number, height: number): [Frame, Frame] {
  const top = 70;
  const bottom = 48;
  const gap = 84;
  const left = 64;
  const w = width - left - 24 - gap;
  const wa = Math.round(w * 0.58);
  return [
    { x: left, y: top, w: wa, h: height - top - bottom },
    { x: left + wa + gap, y: top, w: w - wa, h: height - top - bottom },
  ];
}
