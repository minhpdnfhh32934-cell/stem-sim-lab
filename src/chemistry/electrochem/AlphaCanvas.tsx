import { formatNumber } from '@/app/i18n';
import { useSettingsStore } from '@/app/settings/settingsStore';
import { useCanvas } from '@/ui/canvas/useCanvas';
import { volts } from './format';
import { PAIRABLE, coupleLabel, termText, type Couple, type Reaction } from './model';

/**
 * Two couples on the book's "dãy điện hóa" (E° growing to the right) and, when they react, the α
 * of tr. 72: the strong oxidant takes electrons from the strong reductant.
 */
export function AlphaCanvas({
  first,
  second,
  r,
  label,
}: {
  first: Couple;
  second: Couple;
  r: Reaction | null;
  label: string;
}) {
  const locale = useSettingsStore((s) => s.locale);
  const ref = useCanvas(
    ({ ctx, width, css }) => {
      // The series as a number line (the book's "dãy điện hóa", E° growing to the right).
      const lo = -3.2;
      const hi = 1.7;
      const x0 = 50;
      const x1 = width - 50;
      const X = (e: number) => x0 + ((e - lo) / (hi - lo)) * (x1 - x0);
      const yAxis = 64;
      ctx.strokeStyle = css('--text-muted');
      ctx.fillStyle = css('--text-muted');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, yAxis);
      ctx.lineTo(x1, yAxis);
      ctx.stroke();
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const v of [-3, -2, -1, 0, 1]) {
        ctx.fillText(formatNumber(locale, v, { signDisplay: 'exceptZero' }), X(v), yAxis + 34);
      }
      ctx.fillText('E° (V)', x1 - 10, yAxis + 34);
      for (const c of PAIRABLE) {
        ctx.beginPath();
        ctx.moveTo(X(c.E_V), yAxis - 5);
        ctx.lineTo(X(c.E_V), yAxis + 5);
        ctx.stroke();
      }
      const pair = [first, second].sort((p, q) => p.E_V - q.E_V);
      pair.forEach((c, i) => {
        ctx.fillStyle = css(i === 0 ? '--chart-2' : '--chart-4');
        ctx.beginPath();
        ctx.arc(X(c.E_V), yAxis, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        const tx = Math.min(Math.max(X(c.E_V), x0 + 60), x1 - 60);
        // Both names above the line, on two rows so close values never overlap.
        ctx.fillText(`${coupleLabel(c)} ${volts(locale, c)} V`, tx, yAxis - (i === 0 ? 38 : 14));
      });
      if (!r) return;
      // The α: the strong oxidant (top right) takes electrons from the strong reductant (bottom
      // left), giving the weak oxidant (top left) and the weak reductant (bottom right).
      const cx = width / 2;
      const left = cx - 130;
      const right = cx + 130;
      const top = 138;
      const bottom = 250;
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = css('--text');
      ctx.fillText(termText(r.reductant.label[0]), left, top);
      ctx.fillText(termText(r.reductant.label[1]), left, bottom + 14);
      ctx.fillText(termText(r.oxidant.label[0]), right, top);
      ctx.fillText(termText(r.oxidant.label[1]), right, bottom + 14);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = css('--text-muted');
      ctx.fillText(`E° = ${volts(locale, r.reductant)} V`, left, bottom + 40);
      ctx.fillText(`E° = ${volts(locale, r.oxidant)} V`, right, bottom + 40);
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(right - 20, top + 10);
      ctx.lineTo(left + 20, bottom - 14);
      ctx.quadraticCurveTo(left - 70, (top + bottom) / 2, left - 6, top + 14);
      ctx.lineTo(right - 22, bottom - 16);
      ctx.stroke();
      const ang = Math.atan2(bottom - 16 - (top + 14), right - 22 - (left - 6));
      ctx.fillStyle = css('--accent');
      ctx.beginPath();
      ctx.moveTo(right - 22, bottom - 16);
      ctx.lineTo(right - 22 - 12 * Math.cos(ang - 0.4), bottom - 16 - 12 * Math.sin(ang - 0.4));
      ctx.lineTo(right - 22 - 12 * Math.cos(ang + 0.4), bottom - 16 - 12 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
    },
    false,
    [first.id, second.id, r !== null, locale],
  );
  // Without a reaction only the number line is drawn: a shorter canvas.
  return (
    <canvas
      ref={ref}
      className={r ? 'ec-canvas' : 'ec-canvas ec-canvas--line'}
      role="img"
      aria-label={label}
    />
  );
}
