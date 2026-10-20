/**
 * Where things go in the 3D view of "Đột biến điểm" (pure maths, no three.js). Both helices
 * follow the B-DNA proportions of `bdna.ts` (one turn = 10 base pairs, 3,4 nm; 2 nm across; scene
 * unit 1 nm). Everything else — the two lanes (one per DNA, on faint plates), the bulge of an
 * insertion, the gap of a deletion, the brackets and the bead chains — is illustration
 * (DATA_REVIEW MUT3D-*). Positions are written into `out` vectors.
 *
 * Axes: the DNA runs along +x (slot s at x = s · 0,34 nm, coding strand 5′ → 3′ left to right), y
 * is up. From the top: the normal mRNA (its bases facing down to its DNA) and its codon brackets,
 * the normal helix, a ruler of positions, the mutated helix, the mutated mRNA (bases facing up)
 * and its brackets, then the two protein chains side by side (normal above, mutated below).
 */
import { RADIUS, RISE, TWIST } from '../dogma3d/bdna';
import type { Vec3 } from '../dogma3d/layout';
import { beadSlot, inBulge, type HelixId, type MutationModel3D } from './binding';

export type { Vec3 };

/** Illustrative layout (scene units; the helices themselves are 1 unit = 1 nm). */
export const LAYOUT = {
  /** Axes of the two helices (far enough apart that one lane's letters never meet the other's). */
  helixY: { normal: 3.9, mutated: 0 } as Record<HelixId, number>,
  /** mRNA backbones: above the normal helix, below the mutated one. */
  mrnaY: { normal: 5.85, mutated: -1.95 } as Record<HelixId, number>,
  /** Codon brackets beside each mRNA (away from its DNA). */
  bracketY: { normal: 6.25, mutated: -2.35 } as Record<HelixId, number>,
  /** Bracket end ticks, towards the mRNA. */
  tick: 0.22,
  /** Length of an mRNA base (a half rung). */
  stick: 0.75,
  /** Ruler of positions, between the two lanes. */
  rulerY: 1.95,
  /** Protein chains, side by side under the lanes. */
  chainY: { normal: -3.75, mutated: -4.7 } as Record<HelixId, number>,
  /** The lanes' plates: behind the helices, a margin around each lane. */
  plateZ: -1.45,
  plateMargin: 0.38,
  /** How far the bulge of an insertion comes out towards the viewer (z of its middle). */
  bulgeDepth: 1.85,
  /** Half width of the bulge per inserted base (it never is narrower than `bulgeMinHalf`). */
  bulgePerBase: 0.22,
  bulgeMinHalf: 0.35,
} as const;

/** x of a slot. */
export const xOf = (slot: number): number => slot * RISE;

/** Angle of a slot around the axis: the helix turns 36° per base pair, the site faces up. */
export const angleAt = (slot: number, site: number): number => TWIST * (slot - site);

function setVec(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Where an inserted base sits in the bulge (x, z): on a half ellipse in front of the helix,
 * between the neighbours of the insertion, in sequence order from left to right.
 */
export function bulgePoint(model: MutationModel3D, j: number): { x: number; z: number } {
  const b = model.bulge;
  if (!b) return { x: xOf(model.mutated.slot[j] ?? 0), z: 0 };
  const L = b.to - b.from;
  const k = j - b.from;
  const phi = Math.PI - ((k + 1) * Math.PI) / (L + 1);
  const half = Math.max(LAYOUT.bulgeMinHalf, LAYOUT.bulgePerBase * (L + 1));
  const xc = xOf(b.from - 0.5);
  return { x: xc + half * Math.cos(phi), z: LAYOUT.bulgeDepth * Math.sin(phi) };
}

/**
 * Backbone point and base tip of one strand of a base pair. In the helix both tips meet on the
 * axis; a pair in the bulge stands upright (coding strand on top) in front of the helix.
 */
export function pairPose(
  model: MutationModel3D,
  helix: HelixId,
  i: number,
  strand: 'coding' | 'template',
  back: Vec3,
  tip: Vec3,
): void {
  const y0 = LAYOUT.helixY[helix];
  const sign = strand === 'coding' ? 1 : -1;
  if (helix === 'mutated' && inBulge(model, i)) {
    const p = bulgePoint(model, i);
    setVec(back, p.x, y0 + sign * RADIUS, p.z);
    setVec(tip, p.x, y0, p.z);
    return;
  }
  const slot = (helix === 'normal' ? model.normal.slot[i] : model.mutated.slot[i]) ?? 0;
  slotPose(slot, model.site, y0, strand, back, tip);
}

/** `pairPose` of a slot of a helix (also the empty slots of a deletion's gap). */
export function slotPose(
  slot: number,
  site: number,
  y0: number,
  strand: 'coding' | 'template',
  back: Vec3,
  tip: Vec3,
): void {
  const a = angleAt(slot, site) + (strand === 'template' ? Math.PI : 0);
  const x = xOf(slot);
  setVec(back, x, y0 + RADIUS * Math.cos(a), RADIUS * Math.sin(a));
  setVec(tip, x, y0, 0);
}

/** Backbone point and base tip of mRNA base j of a helix (inserted bases bulge like their DNA). */
export function mrnaPose(
  model: MutationModel3D,
  helix: HelixId,
  j: number,
  back: Vec3,
  tip: Vec3,
): void {
  const y = LAYOUT.mrnaY[helix];
  // Bases face their DNA: down from the normal mRNA, up from the mutated one.
  const dir = helix === 'normal' ? -1 : 1;
  let x: number;
  let z = 0;
  if (helix === 'mutated' && inBulge(model, j)) {
    const p = bulgePoint(model, j);
    x = p.x;
    z = p.z;
  } else x = xOf((helix === 'normal' ? model.normal.slot[j] : model.mutated.slot[j]) ?? 0);
  setVec(back, x, y, z);
  setVec(tip, x, y + dir * LAYOUT.stick, z);
}

/** The bar of codon c's bracket (from its first to its last base) at its row. */
export function bracketEnds(
  model: MutationModel3D,
  helix: HelixId,
  c: number,
  a: Vec3,
  b: Vec3,
): boolean {
  const s = helix === 'normal' ? model.normal : model.mutated;
  const codon = s.t.codons[c];
  if (!codon) return false;
  const y = LAYOUT.bracketY[helix];
  mrnaPose(model, helix, codon.pos, a, b);
  const x0 = a[0];
  const z0 = a[2];
  mrnaPose(model, helix, codon.pos + 2, a, b);
  const x1 = a[0];
  const z1 = a[2];
  // A little short of the bases' middles at both ends: neighbouring brackets never touch.
  const pad = 0.12;
  setVec(a, Math.min(x0, x1) - pad, y, z0);
  setVec(b, Math.max(x0, x1) + pad, y, z1);
  return true;
}

/** Centre of bead k of a chain. */
export function beadPoint(model: MutationModel3D, helix: HelixId, k: number, out: Vec3): Vec3 {
  return setVec(out, xOf(beadSlot(model, k)), LAYOUT.chainY[helix], 0);
}

/** A lane's plate (helix, mRNA and brackets of one DNA): bottom and top y. */
export function laneSpan(helix: HelixId): { lo: number; hi: number } {
  const m = LAYOUT.plateMargin;
  return helix === 'normal'
    ? { lo: LAYOUT.helixY.normal - RADIUS - m, hi: LAYOUT.bracketY.normal + m }
    : { lo: LAYOUT.bracketY.mutated - m, hi: LAYOUT.helixY.mutated + RADIUS + m };
}

/** Top and bottom of the picture (camera framing). */
export const PICTURE_TOP = LAYOUT.bracketY.normal + LAYOUT.plateMargin + 0.1;
export const PICTURE_BOTTOM = LAYOUT.chainY.mutated - 0.9;
