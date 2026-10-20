/**
 * Where the diffusion picture's things stand (pure maths, scene units, y up): a box split by a
 * membrane slab at x = xm into two compartments whose widths are in the ratio V₁ : V₂ (same
 * height and depth, so the volumes are too — the only spatial scale of the picture), `pores`
 * round channels through the slab, and each particle's place at time t.
 *
 * A particle wanders by Brownian jitter (`brownianStep`, seeded by the lesson's `run`) inside the
 * compartment it is in; a particle that crosses (`diffusion.ts` says which and when) walks to a
 * pore's mouth, along the channel's axis, and out on the other side, so no particle ever enters
 * the slab outside a pore. Paths, sizes and the jitter are illustration; the counts are Fick's.
 */
import { rng } from '../../genetics/stats';
import { brownianStep } from '../transport';
import type { DiffusionFrame, DiffusionModel3D } from './diffusion';

export type Vec3 = [number, number, number];

export const BOX = {
  /** Interior width of the two compartments together (V₁ + V₂). */
  inner: 12,
  /** Half height and half depth of the box. */
  hy: 2.5,
  hz: 2.5,
  /** Half thickness of the membrane slab. */
  mh: 0.1,
  /** Particle radius and pore radius (illustration). */
  r: 0.12,
  poreR: 0.36,
  /** How far before a pore a crossing particle lines up with its channel. */
  gap: 0.32,
} as const;

/** Knots of each particle's Brownian walk over the time range (linear in between). */
export const WALK_KNOTS = 96;
/** Illustrative diffusion coefficient of the walk (unit box, one knot = one step). */
const WALK_D = 0.0009;
/** Share of the time range one crossing takes to reach a pore and to leave it. */
const TRANSIT = 1 / 25;

export interface PorePlace {
  y: number;
  z: number;
}

export interface DiffusionLayout {
  /** Left wall, membrane centre and right wall (x). */
  x0: number;
  xm: number;
  x1: number;
  /** Interior widths of compartments 1 and 2 (w₁ : w₂ = V₁ : V₂). */
  w1: number;
  w2: number;
  pores: PorePlace[];
}

/** Pore centres on the membrane face: one row up to 3 pores, then two rows (top row first). */
export function poreCentres(n: number): PorePlace[] {
  const count = Math.max(0, Math.round(n));
  if (count === 0) return [];
  const rows = count <= 3 ? 1 : 2;
  const top = Math.ceil(count / rows);
  const out: PorePlace[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = r === 0 ? top : count - top;
    const y = rows === 1 ? 0 : r === 0 ? BOX.hy * 0.45 : -BOX.hy * 0.45;
    for (let c = 0; c < inRow; c++)
      out.push({ y, z: ((c + 0.5) / inRow) * 2 * BOX.hz * 0.84 - BOX.hz * 0.84 });
  }
  return out;
}

export function diffusionLayout(v1: number, v2: number, pores: number): DiffusionLayout {
  const w1 = (BOX.inner * v1) / (v1 + v2);
  const w2 = BOX.inner - w1;
  const x0 = -(BOX.inner + 2 * BOX.mh) / 2;
  const xm = x0 + w1 + BOX.mh;
  return { x0, xm, x1: xm + BOX.mh + w2, w1, w2, pores: poreCentres(pores) };
}

/** Interior volume of compartment s (scene units³): width × height × depth. */
export function compartmentVolume(lay: DiffusionLayout, s: 1 | 2): number {
  return (s === 1 ? lay.w1 : lay.w2) * 2 * BOX.hy * 2 * BOX.hz;
}

/**
 * Each particle's Brownian walk in its compartment's unit box [0, 1]³ (reflecting walls), at
 * WALK_KNOTS + 1 knots: `count` × (WALK_KNOTS + 1) × 3 numbers, seeded by the lesson's `run`
 * (the 2D picture's seed), the same on every machine and tier.
 */
export function brownianWalks(count: number, run: number): Float32Array {
  const rand = rng(7 + run);
  const n = WALK_KNOTS + 1;
  const out = new Float32Array(count * n * 3);
  const reflect = (v: number) => {
    const a = v < 0 ? -v : v > 1 ? 2 - v : v;
    return Math.min(1, Math.max(0, a));
  };
  for (let j = 0; j < count; j++) {
    let o = j * n * 3;
    let x = rand();
    let y = rand();
    let z = rand();
    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = z;
    for (let s = 1; s < n; s++) {
      const [dx, dy] = brownianStep(WALK_D, 1, rand);
      const [dz] = brownianStep(WALK_D, 1, rand);
      x = reflect(x + dx);
      y = reflect(y + dy);
      z = reflect(z + dz);
      o += 3;
      out[o] = x;
      out[o + 1] = y;
      out[o + 2] = z;
    }
  }
  return out;
}

export interface DiffusionPlan {
  model: DiffusionModel3D;
  layout: DiffusionLayout;
  walks: Float32Array;
  /** Pore each crossing particle uses (index into `layout.pores`; −1: it stays). */
  poreOf: Int16Array;
  /** Time one leg of a crossing takes (min). */
  transit: number;
}

const scratch: Vec3 = [0, 0, 0];

/** Walk of particle j at knot position f ∈ [0, WALK_KNOTS] (unit box). */
export function walkAt(walks: Float32Array, j: number, f: number, out: Vec3): Vec3 {
  const n = WALK_KNOTS + 1;
  const k = Math.max(0, Math.min(WALK_KNOTS, f));
  const i = Math.min(WALK_KNOTS - 1, Math.floor(k));
  const u = k - i;
  const a = (j * n + i) * 3;
  const b = a + 3;
  out[0] = (walks[a] ?? 0) * (1 - u) + (walks[b] ?? 0) * u;
  out[1] = (walks[a + 1] ?? 0) * (1 - u) + (walks[b + 1] ?? 0) * u;
  out[2] = (walks[a + 2] ?? 0) * (1 - u) + (walks[b + 2] ?? 0) * u;
  return out;
}

/** A point of compartment s for unit-box coordinates u (the particle stays clear of walls). */
export function placeIn(lay: DiffusionLayout, s: 1 | 2, u: Vec3, out: Vec3): Vec3 {
  const r = BOX.r;
  const left = s === 1 ? lay.x0 : lay.xm + BOX.mh;
  const w = s === 1 ? lay.w1 : lay.w2;
  out[0] = left + r + u[0] * (w - 2 * r);
  out[1] = -BOX.hy + r + u[1] * (2 * BOX.hy - 2 * r);
  out[2] = -BOX.hz + r + u[2] * (2 * BOX.hz - 2 * r);
  return out;
}

const knotOf = (m: DiffusionModel3D, t: number) =>
  (Math.max(0, Math.min(m.tEnd, t)) / m.tEnd) * WALK_KNOTS;

/** The plan of a model: layout, walks and the pore each crossing uses (nearest at its time). */
export function diffusionPlan(m: DiffusionModel3D): DiffusionPlan {
  const layout = diffusionLayout(m.inputs.v1, m.inputs.v2, m.inputs.pores);
  const walks = brownianWalks(m.total, m.inputs.run);
  const poreOf = new Int16Array(m.total).fill(-1);
  const at: Vec3 = [0, 0, 0];
  for (let c = 0; c < m.crossers.length; c++) {
    const j = m.crossers[c] ?? 0;
    const tau = m.crossTimes[c] ?? 0;
    walkAt(walks, j, Number.isFinite(tau) ? knotOf(m, tau) : WALK_KNOTS, scratch);
    placeIn(layout, 1, scratch, at);
    let best = 0;
    let bestD = Infinity;
    layout.pores.forEach((p, k) => {
      const d = (p.y - at[1]) ** 2 + (p.z - at[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    poreOf[j] = layout.pores.length ? best : -1;
  }
  return { model: m, layout, walks, poreOf, transit: m.tEnd * TRANSIT };
}

const lerp = (a: Vec3, b: Vec3, u: number, out: Vec3): Vec3 => {
  const v = Math.max(0, Math.min(1, u));
  out[0] = a[0] + (b[0] - a[0]) * v;
  out[1] = a[1] + (b[1] - a[1]) * v;
  out[2] = a[2] + (b[2] - a[2]) * v;
  return out;
};

const home: Vec3 = [0, 0, 0];
const mouth: Vec3 = [0, 0, 0];
const inside: Vec3 = [0, 0, 0];
const unit: Vec3 = [0, 0, 0];

/** The two points of a pore on side s: before its mouth, and just inside its channel. */
function poreLegs(lay: DiffusionLayout, pore: PorePlace, s: 1 | 2): void {
  const sign = s === 1 ? -1 : 1;
  mouth[0] = lay.xm + sign * (BOX.mh + BOX.r + BOX.gap);
  mouth[1] = pore.y;
  mouth[2] = pore.z;
  inside[0] = lay.xm + sign * BOX.mh * 0.5;
  inside[1] = pore.y;
  inside[2] = pore.z;
}

/**
 * Where particle j is at a frame (scene units). `jitter` false (reduced motion) freezes the walk
 * at its start; crossings still happen, they are the lesson's content.
 */
export function particleAt(
  plan: DiffusionPlan,
  frame: DiffusionFrame,
  j: number,
  jitter: boolean,
  out: Vec3,
): Vec3 {
  const { model: m, layout: lay } = plan;
  walkAt(plan.walks, j, jitter ? knotOf(m, frame.t) : 0, unit);
  const start: 1 | 2 = j < m.n1Start ? 1 : 2;
  const c = m.crossIndex[j] ?? -1;
  const pore = lay.pores[plan.poreOf[j] ?? -1];
  if (c < 0 || m.blocked || !pore) return placeIn(lay, start, unit, out);
  const tau = m.crossTimes[c] ?? Infinity;
  const other: 1 | 2 = start === 1 ? 2 : 1;
  const w = plan.transit;
  if (c < frame.crossed) {
    // Out of the channel, to the mouth, then off into the compartment.
    const q = Number.isFinite(tau) ? (frame.t - tau) / w : 1;
    if (q >= 1) return placeIn(lay, other, unit, out);
    poreLegs(lay, pore, other);
    placeIn(lay, other, unit, home);
    const k = Math.max(0, q);
    return k < 0.35
      ? lerp(inside, mouth, k / 0.35, out)
      : lerp(mouth, home, (k - 0.35) / 0.65, out);
  }
  // Not crossed yet: home, or on the way to the pore.
  if (!Number.isFinite(tau)) return placeIn(lay, start, unit, out);
  const span = Math.min(w, tau);
  if (frame.t <= tau - span) return placeIn(lay, start, unit, out);
  const p = span > 0 ? (frame.t - (tau - span)) / span : 1;
  poreLegs(lay, pore, start);
  placeIn(lay, start, unit, home);
  return p < 0.65 ? lerp(home, mouth, p / 0.65, out) : lerp(mouth, inside, (p - 0.65) / 0.35, out);
}

/** True when a point is inside the membrane slab (where only a pore's channel may be). */
export function inSlab(lay: DiffusionLayout, p: Vec3): boolean {
  return Math.abs(p[0] - lay.xm) < BOX.mh + BOX.r;
}

/** The pore whose channel holds a point of the slab, or −1. */
export function poreHolding(lay: DiffusionLayout, p: Vec3): number {
  const room = BOX.poreR - BOX.r;
  return lay.pores.findIndex((q) => (p[1] - q.y) ** 2 + (p[2] - q.z) ** 2 <= room * room + 1e-9);
}
