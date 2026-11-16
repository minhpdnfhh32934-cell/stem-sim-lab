/**
 * The 2D virus picture (canvas) for a device without the 3D view: the same illustrative shapes
 * (geometry.ts) seen from the front, with the right half of the front capsomeres left out (a cut,
 * like the textbook's H 24.1b) so the core shows. The picked part is drawn in the accent colour.
 */
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { VIRUS_SIZE, anchors, capsomereCentres, coreCoil, sphereDirections } from './geometry';
import type { VirusPart } from './parts';

export function drawVirus(
  d: DrawContext,
  enveloped: boolean,
  names: Readonly<Partial<Record<VirusPart, string>>> | null,
  selected: VirusPart | null,
): void {
  const { ctx, width, height, css } = d;
  const S = VIRUS_SIZE;
  ctx.clearRect(0, 0, width, height);
  const extent = (enveloped ? S.envelope + S.spikeLength : S.capsid + S.capsomere) * 1.25;
  const top = 64;
  const bottom = 48;
  const u = Math.min(width, height - top - bottom) / (2 * extent);
  const cx = width / 2;
  const cy = top + (height - top - bottom) / 2;
  const X = (x: number) => cx + x * u;
  const Y = (y: number) => cy - y * u;
  const accent = css('--stage-accent');
  const pen = (part: VirusPart, token: string) => (selected === part ? accent : css(token));

  if (enveloped) {
    ctx.beginPath();
    ctx.arc(cx, cy, S.envelope * u, 0, Math.PI * 2);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = css('--subject-biology');
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected === 'envelope' ? 5 : 3;
    ctx.strokeStyle = pen('envelope', '--subject-biology');
    ctx.stroke();
    ctx.strokeStyle = pen('spikes', '--chart-2');
    ctx.fillStyle = pen('spikes', '--chart-2');
    ctx.lineWidth = 2;
    for (const [dx, dy, dz] of sphereDirections(S.spikes)) {
      if (Math.abs(dz) > 0.45) continue; // only the spikes seen side-on, around the outline
      const l = Math.hypot(dx, dy) || 1;
      const [ux, uy] = [dx / l, dy / l];
      ctx.beginPath();
      ctx.moveTo(X(ux * S.envelope), Y(uy * S.envelope));
      ctx.lineTo(X(ux * (S.envelope + S.spikeLength)), Y(uy * (S.envelope + S.spikeLength)));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(
        X(ux * (S.envelope + S.spikeLength)),
        Y(uy * (S.envelope + S.spikeLength)),
        0.12 * u,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  const centres = capsomereCentres(S.capsid, S.facets).sort((a, b) => a[2] - b[2]);
  const capsomere = (x: number, y: number, part: VirusPart, alpha: number) => {
    ctx.beginPath();
    ctx.arc(X(x), Y(y), S.capsomere * u, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pen(part, '--bio3d-protein');
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = css('--border');
    ctx.stroke();
  };
  for (const [x, y, z] of centres) if (z < 0) capsomere(x, y, 'capsid', 0.45);

  ctx.beginPath();
  coreCoil(S.core).forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(X(x), Y(y));
    else ctx.lineTo(X(x), Y(y));
  });
  ctx.lineWidth = selected === 'core' ? 4 : 2.5;
  ctx.strokeStyle = pen('core', '--chart-5');
  ctx.stroke();

  for (const [x, y, z] of centres) if (z >= 0 && x < 0) capsomere(x, y, 'capsid', 1);

  if (names) {
    const k = Number(css('--font-scale')) || 1;
    ctx.font = `${String(Math.round(13 * k))}px ${css('--font-sans') || 'sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const at = anchors(enveloped);
    for (const [part, text] of Object.entries(names) as [VirusPart, string][]) {
      const [x, y] = at[part];
      const w = ctx.measureText(text).width + 12;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = css('--bg-panel');
      ctx.fillRect(X(x) - w / 2, Y(y) - 12, w, 24);
      ctx.globalAlpha = 1;
      ctx.fillStyle = css('--text');
      ctx.fillText(text, X(x), Y(y));
    }
  }
}
