/**
 * Shapes of the illustrative virus (pure numbers, no three.js): a regular icosahedron (the
 * textbook's "hình đa diện", H 24.1b), capsomeres on its faces, spikes on a round envelope and a
 * coiled nucleic acid inside. Sizes and counts are drawing choices (VIRUS_ILLUSTRATION), not data
 * about a real virus. Scene units; the particle is about 4 units across.
 */
import type { VirusPart } from './parts';

export type V3 = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;

const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

/** The 12 vertices of an icosahedron of circumradius r. */
export function icosahedronVertices(r: number): V3[] {
  const raw: V3[] = [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ];
  return raw.map((v) => scale(norm(v), r));
}

/** The 20 triangular faces (vertex indices, counter-clockwise seen from outside). */
export const ICOSAHEDRON_FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

/**
 * Capsomere centres: a triangular grid of `f` steps on each face, shared points on edges and
 * vertices kept once (10f² + 2 points), each pushed out to the circumsphere by `bulge` (0: flat
 * faces, 1: a sphere) so the shell looks polyhedral but rounded, as in the textbook picture.
 */
export function capsomereCentres(r: number, f: number, bulge = 0.35): V3[] {
  const v = icosahedronVertices(r);
  const out: V3[] = [];
  const seen = new Set<string>();
  for (const [a, b, c] of ICOSAHEDRON_FACES) {
    const A = v[a] as V3;
    const B = v[b] as V3;
    const C = v[c] as V3;
    for (let i = 0; i <= f; i++)
      for (let j = 0; j <= f - i; j++) {
        const k = f - i - j;
        const p: V3 = [
          (A[0] * i + B[0] * j + C[0] * k) / f,
          (A[1] * i + B[1] * j + C[1] * k) / f,
          (A[2] * i + B[2] * j + C[2] * k) / f,
        ];
        const key = p.map((x) => x.toFixed(5)).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const d = Math.hypot(...p);
        out.push(scale(p, 1 + bulge * (r / d - 1)));
      }
  }
  return out;
}

/** `n` directions spread evenly over a sphere (Fibonacci lattice): where the spikes stand. */
export function sphereDirections(n: number): V3[] {
  const out: V3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const a = i * golden;
    out.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
  }
  return out;
}

/** A coiled thread inside a sphere of radius r: the nucleic acid core, `count` points. */
export function coreCoil(r: number, count = 160): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const a = u * Math.PI * 14;
    const y = (u * 2 - 1) * r * 0.75;
    const rr = Math.sqrt(Math.max(0, r * r - y * y)) * 0.7;
    out.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
  }
  return out;
}

/** Sizes of the drawing (scene units). */
export const VIRUS_SIZE = {
  capsid: 2,
  facets: 3,
  capsomere: 0.26,
  core: 1.25,
  envelope: 2.75,
  spikes: 48,
  spikeLength: 0.55,
} as const;

/** Where each part's name points (scene units). */
export function anchors(enveloped: boolean): Record<VirusPart, V3> {
  const S = VIRUS_SIZE;
  const tip = S.envelope + S.spikeLength;
  return {
    core: [0, 0, 0],
    capsid: [S.capsid + S.capsomere, 0, 0],
    capsomere: [-S.capsid * 0.45, -S.capsid * 0.8, S.capsid * 0.4],
    envelope: [-S.envelope * 0.71, S.envelope * 0.71, 0],
    spikes: enveloped ? [tip * 0.62, tip * 0.62, tip * 0.47] : [0, 0, 0],
  };
}

/** The capsomere marked when the part "capsomere" is picked: the one nearest `at` (its name). */
export function nearestCapsomere(centres: readonly V3[], at: V3): number {
  const dist = (c: V3) => Math.hypot(c[0] - at[0], c[1] - at[1], c[2] - at[2]);
  let best = 0;
  centres.forEach((c, i) => {
    if (dist(c) < dist(centres[best] ?? c)) best = i;
  });
  return best;
}
