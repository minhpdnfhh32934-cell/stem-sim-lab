/**
 * What the name labels of the division views keep clear of (world space, projected by
 * `LabelLayer`): the chromosomes — counted data, a label box never covers them — and, once there
 * are separate cells, each cell (a leader never runs across a cell that does not hold its part).
 * Bounds only: nothing here changes what is drawn.
 */
import type { Hull } from '@/ui/three/labelLayer';
import type { Vec3 } from './math';

/**
 * The 8 corners of the box around a chromatid tube: its ring centres (relative to `at`, the
 * mesh position) widened by its thickest ring. Null for a tube without rings.
 */
export function tubeHull(
  at: { x: number; y: number; z: number },
  centre: Float32Array,
  radii: Float32Array,
): Hull | null {
  const rings = Math.min(radii.length, Math.floor(centre.length / 3));
  if (rings === 0) return null;
  let r = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (let k = 0; k < rings; k++) {
    r = Math.max(r, radii[k] ?? 0);
    const x = centre[3 * k] ?? 0;
    const y = centre[3 * k + 1] ?? 0;
    const z = centre[3 * k + 2] ?? 0;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    z1 = Math.max(z1, z);
  }
  const xs = [at.x + x0 - r, at.x + x1 + r];
  const ys = [at.y + y0 - r, at.y + y1 + r];
  const zs = [at.z + z0 - r, at.z + z1 + r];
  const out: Vec3[] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) out.push([x, y, z]);
  return out;
}

/** The 6 extreme points of an axis-aligned ellipsoid (its silhouette's bounds from the front). */
export function ellipsoidHull(center: Vec3, semi: Vec3): Hull {
  const [cx, cy, cz] = center;
  const [a, b, c] = semi;
  return [
    [cx - a, cy, cz],
    [cx + a, cy, cz],
    [cx, cy - b, cz],
    [cx, cy + b, cz],
    [cx, cy, cz - c],
    [cx, cy, cz + c],
  ];
}

/**
 * A stretched two-sphere cell (spheres at ±`offset` along its `axis`, radius `radius`, stretched
 * by 1 + `elongation` along the axis and 1/√(1 + e) across it, volume kept): its 6 extreme points.
 */
export function cellHull(cell: {
  center: Vec3;
  axis: 'x' | 'y';
  elongation: number;
  offset: number;
  radius: number;
}): Hull {
  const e = 1 + cell.elongation;
  const along = (cell.offset + cell.radius) * e;
  const across = cell.radius / Math.sqrt(e);
  return ellipsoidHull(
    cell.center,
    cell.axis === 'x' ? [along, across, across] : [across, along, across],
  );
}

/**
 * The cells a dividing cell stands for: once its furrow shows (`ring`) or it has split
 * (`separated`), its two daughters (each sphere of the profile, stretched); before, itself.
 */
export function cellRegions(cell: {
  center: Vec3;
  axis: 'x' | 'y';
  elongation: number;
  offset: number;
  radius: number;
  ring: boolean;
  separated: boolean;
}): Hull[] {
  if (!(cell.ring || cell.separated) || cell.offset <= 0) return [cellHull(cell)];
  const e = 1 + cell.elongation;
  const along = cell.radius * e;
  const across = cell.radius / Math.sqrt(e);
  const k = cell.axis === 'x' ? 0 : 1;
  return [-1, 1].map((s) => {
    const c: Vec3 = [cell.center[0], cell.center[1], cell.center[2]];
    c[k] += s * cell.offset * e;
    return ellipsoidHull(c, k === 0 ? [along, across, across] : [across, along, across]);
  });
}
