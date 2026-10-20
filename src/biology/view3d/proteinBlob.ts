/**
 * The illustrative shape of a protein (RNA polymerase, ribosome subunits, enzymes, the tRNA
 * body): a seeded lumpy blob — an icosphere pushed in and out by three octaves of value noise —
 * with soft vertex-colour shading in its hollows (cavity "ambient occlusion" from curvature).
 * Deterministic: the same seed gives the same blob. Not a real protein structure; the lessons'
 * captions and Science Cards say so ("Minh họa — không phải tỉ lệ/hình dạng thật").
 */
import * as THREE from 'three';
import type { QualityTier } from '@/perf/tiers';
import { fbm3 } from './noise';

/**
 * three.js icosahedron detail per tier: 7 → 1280 triangles (a level-3 recursive icosphere),
 * 15 → 5120 (level 4). Low has no 3D.
 */
export const BLOB_DETAIL: Record<QualityTier, number> = { low: 3, medium: 7, high: 15 };

export interface BlobOptions {
  seed: number;
  /** Bump height as a share of the radius (8–12 %). */
  amplitude?: number;
  /** Bumps around the blob (noise frequency on the unit sphere). */
  frequency?: number;
  /** Darkest cavity (share of full brightness, 0.8 = −20 %). */
  cavity?: number;
}

/**
 * An indexed unit icosphere: the icosahedron with every triangle split in four `level` times
 * (edge midpoints shared through a cache, pushed onto the sphere). Level 3: 642 vertices, 1280
 * triangles; level 4: 2562 and 5120 — the counts of three.js's IcosahedronGeometry at detail 7
 * and 15, built without its unindexed copy and the vertex merge (several times faster: a scene
 * with three blobs is built inside its time budget).
 */
export function icosphere(level: number): THREE.BufferGeometry {
  const t = (1 + Math.sqrt(5)) / 2;
  const pos: number[] = [];
  const push = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z);
    pos.push(x / l, y / l, z / l);
    return pos.length / 3 - 1;
  };
  for (const [x, y, z] of [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ] as const) {
    push(x, y, z);
  }
  // prettier-ignore
  let faces = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6,
    7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7,
    9, 8, 1,
  ];
  for (let k = 0; k < level; k++) {
    const mid = new Map<number, number>();
    const at = (a: number, b: number) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      const hit = mid.get(key);
      if (hit !== undefined) return hit;
      const i = push(
        (pos[3 * a] ?? 0) + (pos[3 * b] ?? 0),
        (pos[3 * a + 1] ?? 0) + (pos[3 * b + 1] ?? 0),
        (pos[3 * a + 2] ?? 0) + (pos[3 * b + 2] ?? 0),
      );
      mid.set(key, i);
      return i;
    };
    const next: number[] = [];
    for (let f = 0; f < faces.length; f += 3) {
      const a = faces[f] ?? 0;
      const b = faces[f + 1] ?? 0;
      const c = faces[f + 2] ?? 0;
      const ab = at(a, b);
      const bc = at(b, c);
      const ca = at(c, a);
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    faces = next;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(faces);
  return g;
}

/** Recursive icosphere level of a three.js icosahedron detail (3 → 2, 7 → 3, 15 → 4). */
const levelOf = (detail: number) => Math.round(Math.log2(detail + 1));

/** The blob (radius about 1) at a tier's detail: positions, smooth normals, cavity colours. */
export function proteinBlob(tier: QualityTier, o: BlobOptions): THREE.BufferGeometry {
  const amplitude = Math.min(0.12, Math.max(0.08, o.amplitude ?? 0.1));
  const frequency = o.frequency ?? 1.6;
  const cavity = o.cavity ?? 0.8;
  // Shared vertices: smooth normals and a neighbour graph for the curvature.
  const g = icosphere(levelOf(BLOB_DETAIL[tier]));
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = fbm3(v.x * frequency + 11.3, v.y * frequency - 7.1, v.z * frequency + 3.7, o.seed);
    v.multiplyScalar(1 + amplitude * n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  bakeCavity(g, cavity);
  g.computeBoundingSphere();
  return g;
}

/**
 * Darkens hollows: a vertex whose neighbours sit above it along its normal (a concave spot) gets
 * a lower vertex colour, down to `darkest`; convex and flat spots stay at 1.
 */
export function bakeCavity(g: THREE.BufferGeometry, darkest: number): void {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const index = g.index;
  const n = pos.count;
  const sum = new Float32Array(n * 3);
  const count = new Uint16Array(n);
  const add = (a: number, b: number) => {
    sum[a * 3] = (sum[a * 3] ?? 0) + pos.getX(b);
    sum[a * 3 + 1] = (sum[a * 3 + 1] ?? 0) + pos.getY(b);
    sum[a * 3 + 2] = (sum[a * 3 + 2] ?? 0) + pos.getZ(b);
    count[a] = (count[a] ?? 0) + 1;
  };
  const tri = index ? index.count / 3 : n / 3;
  for (let t = 0; t < tri; t++) {
    const a = index ? index.getX(3 * t) : 3 * t;
    const b = index ? index.getX(3 * t + 1) : 3 * t + 1;
    const c = index ? index.getX(3 * t + 2) : 3 * t + 2;
    add(a, b);
    add(a, c);
    add(b, a);
    add(b, c);
    add(c, a);
    add(c, b);
  }
  const concave = new Float32Array(n);
  let max = 1e-9;
  for (let i = 0; i < n; i++) {
    const k = count[i] ?? 0;
    if (!k) continue;
    const dx = (sum[i * 3] ?? 0) / k - pos.getX(i);
    const dy = (sum[i * 3 + 1] ?? 0) / k - pos.getY(i);
    const dz = (sum[i * 3 + 2] ?? 0) / k - pos.getZ(i);
    const c = dx * nor.getX(i) + dy * nor.getY(i) + dz * nor.getZ(i);
    concave[i] = c;
    if (c > max) max = c;
  }
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.max(0, (concave[i] ?? 0) / max);
    const shade = 1 - (1 - darkest) * Math.sqrt(t);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
