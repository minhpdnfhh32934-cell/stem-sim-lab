/**
 * The 2D picture of a biomolecule (canvas), for a device without the 3D view: the same atoms seen
 * from +z (the data's conformer lies on its principal axes, so x–y is its widest view), drawn back
 * to front; bonds as lines, atoms as discs in their Jmol colour with the element letter, the
 * selected part ringed in the accent colour.
 */
import type { DrawContext } from '@/ui/canvas/useCanvas';
import { partOfAtom, type Biomolecule, type PartId } from './data';
import { atomColor, atomRadius, partCentre } from './look';

export function drawMolecule(
  d: DrawContext,
  m: Biomolecule,
  names: Readonly<Partial<Record<PartId, string>>> | null,
  selected: PartId | null,
): void {
  const { ctx, width, height, css } = d;
  ctx.clearRect(0, 0, width, height);
  const xs = m.atoms.map((a) => a.xyz[0]);
  const ys = m.atoms.map((a) => a.xyz[1]);
  const pad = 1.2;
  const spanX = Math.max(...xs) - Math.min(...xs) + 2 * pad;
  const spanY = Math.max(...ys) - Math.min(...ys) + 2 * pad;
  const top = 64;
  const bottom = 48;
  const u = Math.min(width / spanX, (height - top - bottom) / spanY);
  const cx = width / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * u;
  const cy = top + (height - top - bottom) / 2 + ((Math.max(...ys) + Math.min(...ys)) / 2) * u;
  const X = (x: number) => cx + x * u;
  const Y = (y: number) => cy - y * u;

  ctx.strokeStyle = css('--text-muted');
  ctx.lineWidth = Math.max(1.5, 0.12 * u);
  for (const b of m.bonds) {
    const a = m.atoms[b.a];
    const c = m.atoms[b.b];
    if (!a || !c) continue;
    const dx = c.xyz[0] - a.xyz[0];
    const dy = c.xyz[1] - a.xyz[1];
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 0.09 * u;
    const oy = (dx / len) * 0.09 * u;
    for (let k = 0; k < b.order; k++) {
      const f = k - (b.order - 1) / 2;
      ctx.beginPath();
      ctx.moveTo(X(a.xyz[0]) + f * ox, Y(a.xyz[1]) - f * oy);
      ctx.lineTo(X(c.xyz[0]) + f * ox, Y(c.xyz[1]) - f * oy);
      ctx.stroke();
    }
  }

  const k = Number(css('--font-scale')) || 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const order = m.atoms
    .map((_, i) => i)
    .sort((i, j) => (m.atoms[i]?.xyz[2] ?? 0) - (m.atoms[j]?.xyz[2] ?? 0));
  for (const i of order) {
    const a = m.atoms[i];
    if (!a) continue;
    const r = atomRadius(a.el) * u;
    ctx.beginPath();
    ctx.arc(X(a.xyz[0]), Y(a.xyz[1]), r, 0, Math.PI * 2);
    ctx.fillStyle = atomColor(a.el) ?? css('--text-muted');
    ctx.fill();
    const lit = selected !== null && partOfAtom(m, i) === selected;
    ctx.lineWidth = lit ? 4 : 1;
    ctx.strokeStyle = css(lit ? '--stage-accent' : '--border');
    ctx.stroke();
    if (a.el !== 'H' && r > 9) {
      ctx.font = `600 ${String(Math.round(Math.min(r, 16) * k))}px ${css('--font-sans') || 'sans-serif'}`;
      ctx.fillStyle = css('--text');
      ctx.fillText(a.el, X(a.xyz[0]), Y(a.xyz[1]));
    }
  }

  if (names) {
    ctx.font = `${String(Math.round(13 * k))}px ${css('--font-sans') || 'sans-serif'}`;
    for (const part of m.parts) {
      const text = names[part.id];
      if (!text) continue;
      const [x, y] = partCentre(m, part.id);
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = css('--bg-panel');
      ctx.globalAlpha = 0.9;
      ctx.fillRect(X(x) - w / 2, Y(y) - 12, w, 24);
      ctx.globalAlpha = 1;
      ctx.fillStyle = css('--text');
      ctx.fillText(text, X(x), Y(y));
    }
  }
}
