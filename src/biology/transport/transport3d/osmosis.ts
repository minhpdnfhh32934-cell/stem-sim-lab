/**
 * Osmosis in 3D, the numbers and places (pure, tested against the lesson's model). The U-tube's
 * liquid heights are the model's trajectory (`osmosisTrajectory`, the same samples and tEnd as
 * the 2D chart; a moment shows the sample at or before it), drawn to one vertical scale with a
 * cm ruler; the tube's width and the molecules' size are illustration. A fixed sample of solute
 * particles stays in the solution arm (the membrane holds the solute back), spread over the
 * column's height, so their density follows c = c₀h₀/h_L. Water molecules crossing the membrane
 * are illustration: they move by the volume of water that has crossed (the rise h_L − h₀).
 */
import { C } from '@/core/constants';
import { rng } from '../../genetics/stats';
import { niceStep } from '../../fmt';
import type { OsmosisParams } from '../transport';

export type Vec3 = [number, number, number];

/** What `useOsmosis` gives the 2D and 3D views. */
export interface OsmosisData {
  p: OsmosisParams;
  eq: { hL: number; hR: number; dh: number; pi: number; dry: boolean };
  pi0: number;
  tEnd: number;
  traj: { t: number[]; hL: number[] };
}

export interface OsmosisModel3D extends OsmosisData {
  /** Scene units per metre of liquid (both columns): the picture's only vertical scale. */
  perMetre: number;
  /** Ruler: tick step and top (cm). */
  tickCm: number;
  rulerCm: number;
}

export interface OsmosisFrame {
  /** Time of the sample shown (s) and its index in the trajectory. */
  t: number;
  index: number;
  /** Liquid heights (m) and Δh = h_L − h_R (m). */
  hL: number;
  hR: number;
  dh: number;
  /** Solution concentration c = c₀h₀/h_L (mol/m³ = mM). */
  c: number;
  /** Osmotic pressure Π = i·c·R·T and hydrostatic pressure ρgΔh (Pa). */
  pi: number;
  rhoGdh: number;
}

/** The U-tube (scene units): arm centres at x = ±a, bore radius r, tallest liquid ≈ height. */
export const TUBE = {
  a: 2.5,
  r: 0.62,
  /** Scene height of the tallest liquid the model reaches (with head room above it). */
  height: 8.5,
  /** Glass above the tallest liquid. */
  headroom: 0.9,
  /** Ruler (x, right of the water arm) and the Δh bracket (x, between the arms). */
  rulerX: 4.1,
  bracketX: 0,
  /** Solute and water particle radii (illustration). */
  soluteR: 0.1,
  waterR: 0.11,
} as const;

/** Solute particles drawn: a fixed sample (the solute never crosses, so it never changes). */
export const SOLUTE_DRAWN = 60;
/** Water molecules drawn crossing the membrane (illustration). */
export const WATER_DRAWN = 16;

export function osmosisModel3d(d: OsmosisData): OsmosisModel3D {
  // The liquid never rises above max(h_L at the end, h₀); 15 % head room for the ruler.
  const top = Math.max(d.eq.hL, d.p.h0, ...d.traj.hL) * 1.15;
  const perMetre = TUBE.height / top;
  const tickCm = niceStep(top * 100, 5);
  const rulerCm = Math.floor((top * 100) / tickCm + 1e-9) * tickCm;
  return { ...d, perMetre, tickCm, rulerCm };
}

/** The trajectory sample shown at time t: the one at or before t (the 2D picture's rule). */
export function sampleIndex(m: OsmosisData, t: number): number {
  const n = m.traj.t.length;
  const u = Math.max(0, t) / Math.max(1e-12, m.tEnd);
  return Math.max(0, Math.min(n - 1, Math.floor(u * (n - 1) + 1e-9)));
}

export function osmosisFrameAt(m: OsmosisData, t: number): OsmosisFrame {
  const index = sampleIndex(m, t);
  const p = m.p;
  const hL = m.traj.hL[index] ?? p.h0;
  // The model never lets the water arm go below empty (osmosisTrajectory stops there).
  const hR = Math.max(0, 2 * p.h0 - hL);
  const dh = hL - hR;
  const c = (p.c0 * p.h0) / hL;
  return {
    t: m.traj.t[index] ?? 0,
    index,
    hL,
    hR,
    dh,
    c,
    pi: p.i * c * C.R * p.T,
    rhoGdh: p.rho * p.g * dh,
  };
}

/** Scene height of a liquid level h (m): 0 is the top of the bottom channel. */
export const levelY = (m: OsmosisModel3D, h: number): number => h * m.perMetre;

/** Top of the glass arms (scene units). */
export const tubeTop = (): number => TUBE.height + TUBE.headroom;

/** Fixed places of the solute sample in the solution column: radius share, angle, height share. */
export const SOLUTE_PLACES: readonly [number, number, number][] = (() => {
  const rand = rng(90_001);
  return Array.from({ length: SOLUTE_DRAWN }, (_, k) => {
    // Height shares spread evenly (stratified), jittered within their layer.
    const v = (k + 0.15 + 0.7 * rand()) / SOLUTE_DRAWN;
    return [Math.sqrt(rand()), rand() * 2 * Math.PI, v] as [number, number, number];
  });
})();

/**
 * Solute particle j at a frame: in the solution arm (x = −a), between the bottom channel's top
 * and the liquid's surface; `phase` (s of animation) adds a small illustrative wobble.
 */
export function soluteAt(
  m: OsmosisModel3D,
  f: OsmosisFrame,
  j: number,
  phase: number,
  out: Vec3,
): Vec3 {
  const [rr = 0, ang = 0, v = 0] = SOLUTE_PLACES[j] ?? [];
  const pr = TUBE.soluteR;
  const room = TUBE.r * 0.9 - pr;
  const a = ang + 0.35 * Math.sin(phase * 0.9 + j);
  const top = levelY(m, f.hL);
  const span = Math.max(0, top - 2 * pr);
  const y = pr + v * span + 0.04 * Math.sin(phase * 1.7 + j * 2.3);
  out[0] = -TUBE.a + rr * room * Math.cos(a);
  out[1] = top > 2 * pr ? Math.min(top - pr, Math.max(pr, y)) : top / 2;
  out[2] = rr * room * Math.sin(a);
  return out;
}

/** Lane of the water molecules along the bottom channel (x), centred on the membrane. */
const LANE = TUBE.a * 1.6;

/** Fixed lane offsets of the water molecules: start along the lane, radius share, angle. */
const WATER_PLACES: readonly [number, number, number][] = (() => {
  const rand = rng(90_002);
  return Array.from({ length: WATER_DRAWN }, (_, k) => [
    (k + rand()) / WATER_DRAWN,
    Math.sqrt(rand()) * 0.8,
    rand() * 2 * Math.PI,
  ]);
})();

/**
 * Water molecule j at a frame (illustration): along the bottom channel, moved from the water
 * side towards the solution by the rise of the solution's level (the volume that has crossed),
 * wrapped around the lane; `phase` adds a small wobble.
 */
export function waterAt(
  m: OsmosisModel3D,
  f: OsmosisFrame,
  j: number,
  phase: number,
  out: Vec3,
): Vec3 {
  const [s = 0, rr = 0, ang = 0] = WATER_PLACES[j] ?? [];
  const moved = levelY(m, f.hL - m.p.h0);
  let u = (s - moved / LANE) % 1;
  if (u < 0) u += 1;
  const room = TUBE.r * 0.8 - TUBE.waterR;
  const a = ang + 0.5 * Math.sin(phase * 1.3 + j * 1.7);
  out[0] = (u - 0.5) * LANE;
  out[1] = -TUBE.r + rr * room * Math.sin(a);
  out[2] = rr * room * Math.cos(a);
  return out;
}

/** Ruler ticks (cm) from 0 to the ruler's top. */
export function rulerTicks(m: OsmosisModel3D): number[] {
  const n = Math.round(m.rulerCm / m.tickCm);
  return Array.from({ length: n + 1 }, (_, k) => k * m.tickCm);
}
