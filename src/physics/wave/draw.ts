import type { Locale } from '@/app/i18n/types';
import { formatNumber } from '@/app/i18n';
import { fmtQty } from '../common/tex';
import { block, circle, line, polyline, text } from '../render/draw';
import type { DrawContext } from '../types';
import { SW, standingInput, waveOf, type StandingInput } from './engine';
import { antinodes, harmonicRatio, nodes, ratioDigits } from './model';

/** m = 2Lf/v with enough digits that a non-whole m never reads as whole. */
export function fmtRatio(locale: Locale, m: number): string {
  const d = ratioDigits(m);
  return formatNumber(locale, Number(m.toPrecision(d)), { maximumSignificantDigits: d });
}

/** Points along the drawn string (≥ 200, plan item 12.4). */
export const STRING_POINTS = 241;

/**
 * Vertical stretch of the picture so the antinodes reach ~12 % of L (1, 2, 5 × 10ⁿ, never
 * below 1). Written on the picture; graphs and numbers are never stretched.
 */
export function verticalScale(q: StandingInput): number {
  const raw = (0.12 * q.L) / (2 * q.A);
  if (!(raw > 1) || !Number.isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

/** String y(x) = 2A·sin(kx)·sin φ and, when shown, y₁ and y₂, at the state's phase φ = ωt. */
export function draw({ ctx, cam, state, p, opts }: DrawContext): void {
  const c = opts.colors;
  const q = standingInput(p);
  if (!(q.L > 0)) return;
  const w = waveOf(q);
  const S = verticalScale(q);
  const phi = state[SW.phi] ?? 0;
  const H = 2 * q.A * S;
  const clampH = Math.max(1.6 * H, 0.08 * q.L);
  const xs = Array.from({ length: STRING_POINTS }, (_, i) => (i * q.L) / (STRING_POINTS - 1));

  line(ctx, cam, 0, 0, q.L, 0, c.faint, 1, [5, 5]);
  for (const x0 of [0, q.L]) {
    const side = x0 === 0 ? -1 : 1;
    block(ctx, cam, x0 + side * 0.015 * q.L, 0, 0.03 * q.L, clampH, 0, c.ground, c.text);
  }

  if (!w) {
    line(ctx, cam, 0, 0, q.L, 0, c.spring, 3);
    const m = harmonicRatio(q.L, q.f, q.v);
    const ms = Number.isFinite(m) ? fmtRatio(opts.locale, m) : '—';
    text(
      ctx,
      cam,
      q.L / 2,
      clampH,
      opts.locale === 'vi'
        ? `Không có sóng dừng (2Lf/v = ${ms})`
        : `No standing wave (2Lf/v = ${ms})`,
      c.muted,
      'center',
      { x: 0, y: -8 },
    );
    return;
  }

  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  // Envelope ±2A|sin kx| of the standing wave.
  for (const sgn of [1, -1]) {
    polyline(
      ctx,
      cam,
      xs.map((x) => ({ x, y: sgn * H * Math.abs(Math.sin(w.k * x)) })),
      c.faint,
      1,
      [2, 4],
    );
  }
  if ((p.showParts ?? 1) > 0.5) {
    polyline(
      ctx,
      cam,
      xs.map((x) => ({ x, y: S * q.A * (cosP * Math.cos(w.k * x) + sinP * Math.sin(w.k * x)) })),
      c.velocity,
      1.5,
      [7, 5],
    );
    polyline(
      ctx,
      cam,
      xs.map((x) => ({ x, y: -S * q.A * (cosP * Math.cos(w.k * x) - sinP * Math.sin(w.k * x)) })),
      c.force,
      1.5,
      [3, 4],
    );
  }
  polyline(
    ctx,
    cam,
    xs.map((x) => ({ x, y: H * Math.sin(w.k * x) * sinP })),
    c.spring,
    3,
  );

  const n = q.n ?? 0;
  const r = q.L / 160;
  for (const x of nodes(q.L, n)) {
    circle(ctx, cam, x, 0, r, c.text, undefined, 3.5);
    text(ctx, cam, x, 0, 'N', c.text, 'center', { x: 0, y: 18 });
  }
  for (const x of antinodes(q.L, n)) text(ctx, cam, x, H, 'B', c.muted, 'center', { x: 0, y: -6 });

  const yP = (state[SW.y] ?? 0) * S;
  line(ctx, cam, q.xP, -H, q.xP, H, c.accent, 1, [2, 3]);
  circle(ctx, cam, q.xP, yP, q.L / 100, opts.selected === 'probe' ? c.accent : c.bodyAlt, c.text);
  text(ctx, cam, q.xP, Math.max(H, yP), 'P', c.accent, 'center', { x: 10, y: -16 });

  const lambda = (2 * q.L) / n;
  const b = cam.visible();
  const header = `f = ${fmtQty(opts.locale, q.f, 'Hz')},  v = ${fmtQty(opts.locale, q.v, 'm/s')},  λ = ${fmtQty(opts.locale, lambda, 'm')},  n = ${n}`;
  text(ctx, cam, b.xMin, b.yMax, header, c.muted, 'left', { x: 60, y: 18 });
  if (S > 1)
    text(
      ctx,
      cam,
      b.xMin,
      b.yMax,
      opts.locale === 'vi'
        ? `Trục dọc phóng to ×${S} để nhìn rõ`
        : `Vertical axis stretched ×${S} for visibility`,
      c.muted,
      'left',
      { x: 60, y: 36 },
    );
}
