/**
 * Hand-drawn strokes for the board (PROMPT_PHAN_2 B7.1): underline, a circle that does not
 * quite close, a box with overshooting corners, a marker highlight, curved arrows and the
 * small per-letter wobble of handwriting. Everything is random but seeded, so the same lesson
 * always looks the same (and tests are stable). Pure: returns SVG path data.
 */
import type { Box } from './layout';

/** mulberry32: small, fast, deterministic. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from an element id ("f1" → always the same strokes). */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Per-character wobble: rotation (deg), baseline shift and scale, like a real hand. */
export function letterJitter(seed: number, count: number) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    rotate: (r() - 0.5) * 4,
    dy: (r() - 0.5) * 2.4 + i * 0.012, // long lines drift down a little
    scale: 1 + (r() - 0.5) * 0.06,
  }));
}

const f = (n: number) => Math.round(n * 10) / 10;

/** Smooth path through points (Catmull–Rom as cubic Béziers). */
function smooth(points: [number, number][]): string {
  if (points.length < 2) return '';
  const [first] = points;
  let d = `M${f(first?.[0] ?? 0)},${f(first?.[1] ?? 0)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0] ?? 0)},${f(c1[1] ?? 0)} ${f(c2[0] ?? 0)},${f(c2[1] ?? 0)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export function underline(box: Box, seed: number): string {
  const r = rng(seed);
  const y = box.y + box.h + 2;
  const x1 = box.x - 4 - r() * 6;
  const x2 = box.x + box.w + 4 + r() * 8;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const x = x1 + ((x2 - x1) * i) / 6;
    pts.push([x, y + (r() - 0.5) * 3 + (i / 6) * (r() * 3 - 1)]);
  }
  return smooth(pts);
}

/** An ellipse around the box that overshoots its start and stays slightly open. */
export function circle(box: Box, seed: number): string {
  const r = rng(seed);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2 + 14 + r() * 6;
  const ry = box.h / 2 + 10 + r() * 6;
  const start = -Math.PI * (0.6 + r() * 0.3);
  const sweep = Math.PI * 2 * (0.93 + r() * 0.04); // never quite closed
  const pts: [number, number][] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = start + (sweep * i) / n;
    const wobble = 1 + (r() - 0.5) * 0.05;
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
  }
  return smooth(pts);
}

/** A frame: four slightly crooked strokes whose ends overshoot the corners. */
export function rect(box: Box, seed: number): string {
  const r = rng(seed);
  const pad = 8;
  const x1 = box.x - pad;
  const y1 = box.y - pad;
  const x2 = box.x + box.w + pad;
  const y2 = box.y + box.h + pad;
  const j = () => (r() - 0.5) * 4;
  const o = () => 3 + r() * 5;
  return [
    `M${f(x1 - o())},${f(y1 + j())} L${f(x2 + o())},${f(y1 + j())}`,
    `M${f(x2 + j())},${f(y1 - o())} L${f(x2 + j())},${f(y2 + o())}`,
    `M${f(x2 + o())},${f(y2 + j())} L${f(x1 - o())},${f(y2 + j())}`,
    `M${f(x1 + j())},${f(y2 + o())} L${f(x1 + j())},${f(y1 - o())}`,
  ].join(' ');
}

/** A marker stroke behind the text (filled, ragged ends). */
export function highlight(box: Box, seed: number): string {
  const r = rng(seed);
  const x1 = box.x - 6;
  const x2 = box.x + box.w + 6;
  const y1 = box.y + box.h * 0.12;
  const y2 = box.y + box.h * 0.95;
  return `M${f(x1 + r() * 4)},${f(y1 + r() * 3)} L${f(x2)},${f(y1 + r() * 3)} L${f(x2 - r() * 4)},${f(y2)} L${f(x1)},${f(y2 - r() * 3)} Z`;
}

/** A line through the text (for `<correct>`). */
export function strike(box: Box, seed: number): string {
  const r = rng(seed);
  const y = box.y + box.h * 0.55;
  return `M${f(box.x - 4)},${f(y + (r() - 0.5) * 4)} L${f(box.x + box.w + 4)},${f(y - (r() - 0.5) * 4)}`;
}

function anchor(from: Box, to: Box): { a: [number, number]; b: [number, number] } {
  const fc: [number, number] = [from.x + from.w / 2, from.y + from.h / 2];
  const tc: [number, number] = [to.x + to.w / 2, to.y + to.h / 2];
  const edge = (b: Box, c: [number, number], toward: [number, number]): [number, number] => {
    const dx = toward[0] - c[0];
    const dy = toward[1] - c[1];
    const sx = dx === 0 ? Infinity : (b.w / 2 + 8) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (b.h / 2 + 8) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return [c[0] + dx * s, c[1] + dy * s];
  };
  return { a: edge(from, fc, tc), b: edge(to, tc, fc) };
}

/** A curved arrow between two boxes: the shaft and the head (two paths). */
export function arrow(
  from: Box,
  to: Box,
  seed: number,
): { shaft: string; head: string; mid: [number, number] } {
  const r = rng(seed);
  const { a, b } = anchor(from, to);
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const bend = (r() > 0.5 ? 1 : -1) * Math.min(60, len * 0.18);
  const nx = -(b[1] - a[1]) / len;
  const ny = (b[0] - a[0]) / len;
  const c: [number, number] = [mx + nx * bend, my + ny * bend];
  const shaft = `M${f(a[0])},${f(a[1])} Q${f(c[0])},${f(c[1])} ${f(b[0])},${f(b[1])}`;
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const h = 14;
  const head = [ang + 2.6, ang - 2.6]
    .map((t) => `M${f(b[0])},${f(b[1])} L${f(b[0] + Math.cos(t) * h)},${f(b[1] + Math.sin(t) * h)}`)
    .join(' ');
  return { shaft, head, mid: [c[0], c[1]] };
}

/** A straight hand-drawn line (axes, force arrows, table rules). */
export function line(x1: number, y1: number, x2: number, y2: number, seed: number): string {
  const r = rng(seed);
  const mx = (x1 + x2) / 2 + (r() - 0.5) * 2;
  const my = (y1 + y2) / 2 + (r() - 0.5) * 2;
  return `M${f(x1)},${f(y1)} Q${f(mx)},${f(my)} ${f(x2)},${f(y2)}`;
}

/** Arrow head at (x, y) pointing along angle `ang`. */
export function head(x: number, y: number, ang: number, size = 12): string {
  return [ang + 2.6, ang - 2.6]
    .map((t) => `M${f(x)},${f(y)} L${f(x + Math.cos(t) * size)},${f(y + Math.sin(t) * size)}`)
    .join(' ');
}
