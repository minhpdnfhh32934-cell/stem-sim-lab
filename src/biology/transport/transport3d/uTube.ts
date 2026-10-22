/**
 * The osmosis U-tube's shape (pure geometry, scene units, y up, z = 0 plane): the axis of the
 * tube — two straight arms at x = ±a joined by a straight bottom channel at y = −r through two
 * round bends — and a sweep that turns any part of that axis into one continuous tube surface
 * (the glass, its inner face, each side's liquid). The bend radius and wall thickness are
 * illustration; the arms stay straight from y = U_BEND − r up, so a liquid surface at or above
 * that height is a flat circle (the meniscus sits there exactly).
 */
import * as THREE from 'three';
import { TUBE } from './osmosis';

/** Bend radius of the tube's axis: just over the bore, so the glass never folds on itself. */
export const U_BEND = 0.72;
/** Inner face of the glass wall and the liquid's radius, as shares of the bore radius. */
export const GLASS_INNER = 0.955;
export const LIQUID_SHARE = 0.94;

/** Where the arms become straight (y): a surface below it lies in a bend. */
export const ARM_START = U_BEND - TUBE.r;

/** A point of the axis and the unit tangent there (in the xy plane). */
export interface AxisPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/**
 * Half of the axis on side s (−1 solution arm, +1 water arm): from the membrane (x = 0) along the
 * channel, round the bend in `bendSteps` steps, and up the arm to y = top.
 */
export function halfAxis(s: -1 | 1, top: number, bendSteps: number): AxisPoint[] {
  const a = TUBE.a;
  const r = TUBE.r;
  const b = U_BEND;
  const n = Math.max(2, Math.round(bendSteps));
  const out: AxisPoint[] = [{ x: 0, y: -r, tx: s, ty: 0 }];
  const cx = s * (a - b);
  const cy = -r + b;
  for (let k = 0; k <= n; k++) {
    const phi = (k / n) * (Math.PI / 2);
    out.push({
      x: cx + s * b * Math.sin(phi),
      y: cy - b * Math.cos(phi),
      tx: s * Math.cos(phi),
      ty: Math.sin(phi),
    });
  }
  out.push({ x: s * a, y: Math.max(top, cy + 1e-3), tx: 0, ty: 1 });
  return out;
}

/** The whole axis: the solution arm's top, down, along the channel and up the water arm. */
export function uAxis(top: number, bendSteps: number): AxisPoint[] {
  const left = halfAxis(-1, top, bendSteps)
    .reverse()
    .map((p) => ({ x: p.x, y: p.y, tx: -p.tx, ty: -p.ty }));
  // The membrane's point (x = 0) is shared by both halves.
  return [...left, ...halfAxis(1, top, bendSteps).slice(1)];
}

/**
 * A tube of `radius` swept along `axis` (rings of `sides` vertices, seam duplicated for the uv),
 * indexed, with position, normal and uv. `inward` turns it inside out (normals and front faces
 * towards the axis: the inner face of a glass wall). Open at both ends.
 */
export function sweepTube(
  axis: readonly AxisPoint[],
  radius: number,
  sides: number,
  inward = false,
): THREE.BufferGeometry {
  const n = Math.max(3, Math.round(sides));
  const ring = n + 1;
  const pos = new Float32Array(axis.length * ring * 3);
  const nor = new Float32Array(axis.length * ring * 3);
  const uv = new Float32Array(axis.length * ring * 2);
  let length = 0;
  const along: number[] = [];
  axis.forEach((p, i) => {
    const prev = axis[i - 1];
    if (prev) length += Math.hypot(p.x - prev.x, p.y - prev.y);
    along.push(length);
  });
  const sign = inward ? -1 : 1;
  axis.forEach((p, i) => {
    // Frame: N in the plane (left of the tangent), B = +z.
    const nx = -p.ty;
    const ny = p.tx;
    for (let j = 0; j <= n; j++) {
      const th = (j / n) * 2 * Math.PI;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const ox = c * nx;
      const oy = c * ny;
      const oz = s;
      const k = (i * ring + j) * 3;
      pos[k] = p.x + radius * ox;
      pos[k + 1] = p.y + radius * oy;
      pos[k + 2] = radius * oz;
      nor[k] = sign * ox;
      nor[k + 1] = sign * oy;
      nor[k + 2] = sign * oz;
      uv[(i * ring + j) * 2] = j / n;
      uv[(i * ring + j) * 2 + 1] = length > 0 ? (along[i] ?? 0) / length : 0;
    }
  });
  const index: number[] = [];
  for (let i = 0; i + 1 < axis.length; i++)
    for (let j = 0; j < n; j++) {
      const a = i * ring + j;
      const b = a + ring;
      const d = a + 1;
      const e = b + 1;
      // (a, d, b) faces outwards along +normal; inward reverses the winding.
      if (inward) index.push(a, b, d, d, b, e);
      else index.push(a, d, b, d, e, b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
