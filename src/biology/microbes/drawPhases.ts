/**
 * The four-phase picture (canvas): the illustrative curve of phases.ts over four bands, the
 * selected phase's band tinted. No axis values (an illustration: PHASES_CARD); colours are theme
 * tokens.
 */
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { PHASES, PHASE_SPAN, illustrativeLevel, type PhaseId } from './phases';

export function drawPhases(
  d: DrawContext,
  names: Readonly<Record<PhaseId, string>>,
  axes: { x: string; y: string },
  selected: PhaseId,
): void {
  const { ctx, width, height, css } = d;
  ctx.clearRect(0, 0, width, height);
  const left = 56;
  const right = width - 24;
  const top = 64;
  const bottom = height - 72;
  const X = (u: number) => left + u * (right - left);
  const Y = (v: number) => bottom - v * (bottom - top) * 0.85;

  ctx.font = `14px ${css('--font-sans') || 'sans-serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const p of PHASES) {
    const [a, b] = PHASE_SPAN[p];
    const on = p === selected;
    ctx.globalAlpha = on ? 0.22 : 0.07;
    ctx.fillStyle = css(on ? '--accent' : '--text-muted');
    ctx.fillRect(X(a), top, X(b) - X(a), bottom - top);
    ctx.globalAlpha = 1;
    ctx.fillStyle = css(on ? '--text' : '--text-muted');
    ctx.fillText(names[p], (X(a) + X(b)) / 2, top - 30, X(b) - X(a) - 6);
  }

  // Axes (arrows, no values).
  ctx.strokeStyle = css('--text-muted');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, top - 6);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right + 8, bottom);
  ctx.stroke();
  ctx.fillStyle = css('--text-muted');
  ctx.fillText(axes.x, (left + right) / 2, bottom + 10);
  ctx.save();
  ctx.translate(left - 30, (top + bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(axes.y, 0, -8);
  ctx.restore();

  ctx.strokeStyle = css('--chart-1');
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    const x = X(u);
    const y = Y(illustrativeLevel(u));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
