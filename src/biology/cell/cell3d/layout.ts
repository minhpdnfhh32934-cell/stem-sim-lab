/**
 * Where each part of the three cells sits in the 3D picture (#37 §15 step 4). Diagram units, not
 * to scale; counts and places are illustration (the caption says so). Fixed, seeded positions:
 * every build is the same picture on every device tier. Rules the tests hold: organelles of the
 * cytoplasm lie inside the plasma membrane; wall, capsule, flagellum and pili lie outside it;
 * the endoplasmic reticulum touches the nuclear envelope; ribosomes sit on the rough ER (and
 * free in the cytoplasm).
 */
import { partsFor, type CellKind, type PartId } from '../parts';

export type Vec3 = [number, number, number];

/** The cell's outline: a capsule along x (bacterium), a sphere (animal) or a rounded box (plant). */
export type BodyShape = 'capsule' | 'sphere' | 'box';

export interface Body {
  shape: BodyShape;
  /** Half extents of the plasma membrane: capsule [half length incl. caps, radius, radius]. */
  half: Vec3;
}

export type PieceShape = 'sphere' | 'capsule' | 'torus' | 'disc' | 'rod' | 'helix';

export interface Item {
  at: Vec3;
  /** Scale of the unit shape on x, y, z. */
  scale: Vec3;
  /** Euler angles (rad). */
  rot: Vec3;
}

export interface Piece {
  part: PartId;
  shape: PieceShape;
  items: Item[];
  /** Torus pieces: the tube's radius as a share of the ring's (unit) radius. */
  tube?: number;
}

export interface CellLayout {
  kind: CellKind;
  body: Body;
  /** Layers drawn as the body's outline, outermost first (walls and membranes). */
  layers: { part: PartId; grow: number }[];
  /** The cytoplasm (or prokaryotic cytoplasm): the body's inside. */
  fill: PartId;
  pieces: Piece[];
  /** Where each part's name points. */
  anchors: Partial<Record<PartId, Vec3>>;
}

/** A small seeded generator (positions never change between builds). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const item = (at: Vec3, scale: Vec3 | number, rot: Vec3 = [0, 0, 0]): Item => ({
  at,
  scale: typeof scale === 'number' ? [scale, scale, scale] : scale,
  rot,
});

/**
 * How far point p lies inside the body's outline (> 0 inside, in diagram units; the box uses
 * its faces, ignoring the rounding of its edges, which only makes it stricter).
 */
export function depthInside(body: Body, p: Vec3): number {
  const [x, y, z] = p;
  const [hx, hy, hz] = body.half;
  if (body.shape === 'sphere') return hx - Math.hypot(x, y, z);
  if (body.shape === 'box') return Math.min(hx - Math.abs(x), hy - Math.abs(y), hz - Math.abs(z));
  // Capsule along x: a segment of half length hx − r with radius r.
  const r = hy;
  const cx = Math.max(-(hx - r), Math.min(hx - r, x));
  return r - Math.hypot(x - cx, y, z);
}

/**
 * The ER: rings around the nucleus whose inner edge lies on the nuclear envelope (ring radius
 * rn + tube, tube radius `tube`), at a few tilts. Rotations are three.js Euler angles (XYZ).
 */
function erAround(nucleus: Vec3, rn: number, tube: number, tilts: number[]): Item[] {
  return tilts.map((t, i) =>
    item(nucleus, rn + tube, [Math.PI / 2 + t, (i * Math.PI) / tilts.length, 0]),
  );
}

/** Ribosomes on the ER rings' outer rim (rough ER), seeded. */
function onEr(er: Item[], tube: number, n: number, rand: () => number): Item[] {
  const out: Item[] = [];
  const e = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    const ring = er[i % er.length];
    if (!ring) continue;
    const [cx, cy, cz] = ring.at;
    const R = ring.scale[0];
    const a = rand() * Math.PI * 2;
    // A point on the ring's outer rim in its own plane, then the ring's rotation (x, then y).
    const lx = (R + tube) * Math.cos(a);
    const ly = (R + tube) * Math.sin(a);
    const [rx, ry] = ring.rot;
    // Euler XYZ applies Rz, then Ry, then Rx to a local point (rz = 0 here).
    e.x = lx * Math.cos(ry);
    e.z = -lx * Math.sin(ry);
    e.y = ly * Math.cos(rx) - e.z * Math.sin(rx);
    e.z = ly * Math.sin(rx) + e.z * Math.cos(rx);
    out.push(item([cx + e.x, cy + e.y, cz + e.z], 0.09));
  }
  return out;
}

/** n seeded points inside the body, at least `margin` from its outline and away from `avoid`. */
function scatter(
  body: Body,
  n: number,
  margin: number,
  rand: () => number,
  avoid: { at: Vec3; r: number }[] = [],
): Vec3[] {
  const out: Vec3[] = [];
  const [hx, hy, hz] = body.half;
  for (let tries = 0; out.length < n && tries < 4000; tries++) {
    const p: Vec3 = [(rand() * 2 - 1) * hx, (rand() * 2 - 1) * hy, (rand() * 2 - 1) * hz];
    if (depthInside(body, p) < margin) continue;
    if (avoid.some((a) => Math.hypot(p[0] - a.at[0], p[1] - a.at[1], p[2] - a.at[2]) < a.r))
      continue;
    out.push(p);
  }
  return out;
}

function bacterium(): CellLayout {
  const rand = seeded(11);
  const body: Body = { shape: 'capsule', half: [4, 1.6, 1.6] };
  const ribosomes = scatter(body, 70, 0.25, rand).map((p) => item(p, 0.09));
  const pili = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const x = -2.4 + (i % 7) * 0.8;
    // Rod along y, rotated about x to point out of the side (outside the outer membrane).
    return item([x, 2.35 * Math.cos(a), 2.35 * Math.sin(a)], [0.035, 0.45, 0.035], [a, 0, 0]);
  });
  return {
    kind: 'bacterium',
    body,
    layers: [
      { part: 'outerMembrane', grow: 0.42 },
      { part: 'bacterialWall', grow: 0.22 },
      { part: 'membrane', grow: 0 },
    ],
    fill: 'prokCytoplasm',
    pieces: [
      // The nucleoid: a tangle of loops near the middle (one twisted torus per loop).
      {
        part: 'nucleoid',
        shape: 'torus',
        tube: 0.12,
        items: [0, 1, 2, 3].map((i) =>
          item([-0.6 + i * 0.4, 0, 0], [0.75, 0.55, 0.75], [i * 0.9, i * 1.3, 0]),
        ),
      },
      {
        part: 'plasmid',
        shape: 'torus',
        tube: 0.18,
        items: [
          item([2.3, 0.6, 0.3], 0.28, [0.4, 0, 0]),
          item([-2.6, -0.5, -0.4], 0.24, [1.2, 0.5, 0]),
        ],
      },
      { part: 'ribosome', shape: 'sphere', items: ribosomes },
      // The flagellum: a helix leaving the right pole, outside the cell.
      { part: 'flagellum', shape: 'helix', items: [item([4.45, 0, 0], [5, 0.35, 0.35])] },
      { part: 'pili', shape: 'rod', items: pili },
    ],
    anchors: {
      flagellum: [7.5, 0.4, 0],
      pili: [-0.8, 2.9, 0],
      outerMembrane: [0.8, 2.05, 0],
      bacterialWall: [1.6, 1.82, 0],
      membrane: [2.4, 1.6, 0],
      prokCytoplasm: [1.2, -0.9, 0.6],
      nucleoid: [0, 0.6, 0],
      plasmid: [2.3, 0.9, 0.3],
      ribosome: ribosomes[0]?.at ?? [0, 0, 0],
    },
  };
}

/** Parts shared by the two eukaryotic cells, around a nucleus of radius rn at `nucleus`. */
function eukaryote(
  kind: 'animal' | 'plant',
  body: Body,
  nucleus: Vec3,
  rn: number,
  extra: Piece[],
  avoid: { at: Vec3; r: number }[],
  seed: number,
): Omit<CellLayout, 'layers' | 'anchors'> & { anchors: Partial<Record<PartId, Vec3>> } {
  const rand = seeded(seed);
  const tube = 0.22;
  const er = erAround(nucleus, rn, tube, [0, 0.7, -0.7]);
  const keepOut = [{ at: nucleus, r: rn + 1.1 }, ...avoid];
  const free = scatter(body, 40, 0.4, rand, keepOut).map((p) => item(p, 0.09));
  const ribosomes = [...onEr(er, tube, 36, rand), ...free];
  const golgiAt = scatter(body, 1, 1.6, rand, [...keepOut, { at: nucleus, r: rn + 2 }])[0] ?? [
    0, 0, 0,
  ];
  const golgi = [0, 1, 2, 3].map((i) =>
    item(
      [golgiAt[0], golgiAt[1] + (i - 1.5) * 0.24, golgiAt[2]],
      [1.1 - 0.12 * Math.abs(i - 1.5), 0.08, 0.6],
    ),
  );
  const taken = [...keepOut, { at: golgiAt, r: 1.4 }];
  const mitoAt = scatter(body, 6, 0.9, rand, taken);
  const mito = mitoAt.map((p, i) => item(p, [0.32, 0.32, 0.32], [i, i * 1.7, 0]));
  const peroxAt = scatter(body, 3, 0.6, rand, [...taken, ...mitoAt.map((at) => ({ at, r: 1 }))]);
  // Cytoskeleton: thin rods 2.4 long in the cytoplasm, clear of the nucleus (illustration).
  const skeleton = scatter(body, 10, 1.3, rand, [{ at: nucleus, r: rn + 1.5 }, ...avoid]).map(
    (p, i) => item(p, [0.025, 2.4, 0.025], [i * 0.63, i * 1.21, i * 0.37]),
  );
  return {
    kind,
    body,
    fill: 'cytoplasm',
    pieces: [
      { part: 'nucleus', shape: 'sphere', items: [item(nucleus, rn)] },
      { part: 'er', shape: 'torus', items: er, tube: tube / (rn + tube) },
      { part: 'ribosome', shape: 'sphere', items: ribosomes },
      { part: 'golgi', shape: 'disc', items: golgi },
      { part: 'mitochondrion', shape: 'capsule', items: mito },
      { part: 'peroxysome', shape: 'sphere', items: peroxAt.map((p) => item(p, 0.28)) },
      { part: 'cytoskeleton', shape: 'rod', items: skeleton },
      ...extra,
    ],
    anchors: {
      nucleus: [nucleus[0], nucleus[1] + rn, nucleus[2]],
      er: [nucleus[0] + rn + tube, nucleus[1], nucleus[2]],
      ribosome: ribosomes[0]?.at ?? nucleus,
      golgi: [golgiAt[0], golgiAt[1] + 0.5, golgiAt[2]],
      mitochondrion: mitoAt[0] ?? nucleus,
      peroxysome: peroxAt[0] ?? nucleus,
      cytoskeleton: [0, -body.half[1] * 0.6, 0],
    },
  };
}

function animal(): CellLayout {
  const body: Body = { shape: 'sphere', half: [5, 5, 5] };
  const rand = seeded(23);
  const centro: Vec3 = [2.4, 0.6, 1.2];
  const lysoAt = scatter(body, 4, 0.6, rand, [{ at: [0, 0, 0], r: 3.4 }]);
  const e = eukaryote(
    'animal',
    body,
    [0, 0, 0],
    1.6,
    [
      { part: 'lysosome', shape: 'sphere', items: lysoAt.map((p) => item(p, 0.3)) },
      {
        part: 'centrosome',
        shape: 'rod',
        // Two centrioles at right angles.
        items: [
          item(centro, [0.12, 0.4, 0.12]),
          item(centro, [0.12, 0.4, 0.12], [Math.PI / 2, 0, 0]),
        ],
      },
    ],
    [{ at: centro, r: 0.8 }, ...lysoAt.map((at) => ({ at, r: 0.8 }))],
    29,
  );
  return {
    ...e,
    layers: [{ part: 'membrane', grow: 0 }],
    anchors: {
      ...e.anchors,
      membrane: [0, 5, 0],
      cytoplasm: [-3, -2.5, 1.5],
      lysosome: lysoAt[0] ?? [0, 0, 0],
      centrosome: centro,
    },
  };
}

function plant(): CellLayout {
  const body: Body = { shape: 'box', half: [6, 4.2, 4.2] };
  const vacuole: Item = item([1.2, 0, 0], [3.4, 2.7, 2.7]);
  const nucleus: Vec3 = [-4, 1.5, 0];
  const rand = seeded(37);
  // Chloroplasts along the walls (lens shapes), clear of the vacuole and nucleus.
  const chloroAt = scatter(body, 7, 0.9, rand, [
    { at: vacuole.at, r: 3.6 },
    { at: nucleus, r: 2.5 },
  ]);
  const e = eukaryote(
    'plant',
    body,
    nucleus,
    1.2,
    [
      { part: 'vacuole', shape: 'sphere', items: [vacuole] },
      {
        part: 'chloroplast',
        shape: 'sphere',
        items: chloroAt.map((p, i) => item(p, [0.75, 0.3, 0.45], [0, i * 0.9, 0.3])),
      },
    ],
    [{ at: vacuole.at, r: 3.6 }, ...chloroAt.map((at) => ({ at, r: 1 }))],
    41,
  );
  return {
    ...e,
    layers: [
      { part: 'plantWall', grow: 0.35 },
      { part: 'membrane', grow: 0 },
    ],
    anchors: {
      ...e.anchors,
      plantWall: [3, 4.6, 0],
      membrane: [-1, 4.2, 2],
      cytoplasm: [-4.6, -3, 2],
      vacuole: [1.2, 2.7, 0],
      chloroplast: chloroAt[0] ?? [0, 0, 0],
    },
  };
}

const LAYOUTS: Record<CellKind, () => CellLayout> = { bacterium, animal, plant };

export function cellLayout(kind: CellKind): CellLayout {
  return LAYOUTS[kind]();
}

/**
 * Unit shapes the scene draws (scaled by `Item.scale`): sphere radius 1; capsule radius 1 with a
 * straight part 2 long (along y); torus ring radius 1 (in the xy plane); disc and rod: cylinders
 * radius 1, height 1 (along y); helix: from x = 0 to x = 1 around the x axis, radius 1.
 * A radius around `Item.at` that holds the whole shape.
 */
export function extent(piece: Piece, it: Item): number {
  const [sx, sy, sz] = it.scale;
  const m = Math.max(sx, sy, sz);
  switch (piece.shape) {
    case 'sphere':
      return m;
    case 'capsule':
      return Math.max(sx, sz) + sy;
    case 'torus':
      return m * (1 + (piece.tube ?? 0));
    case 'helix':
      return Math.hypot(sx, Math.max(sy, sz));
    default:
      return Math.hypot(Math.max(sx, sz), sy / 2);
  }
}

/** The body grown by `g` on every side (an outer layer's outline). */
export function grown(body: Body, g: number): Body {
  return { shape: body.shape, half: [body.half[0] + g, body.half[1] + g, body.half[2] + g] };
}

/** Parts the picture draws: the layers, the fill and every piece (the tests compare with partsFor). */
export function drawnParts(l: CellLayout): PartId[] {
  return [...l.layers.map((x) => x.part), l.fill, ...l.pieces.map((p) => p.part)];
}

/** Parts that lie outside the plasma membrane (walls, capsule layers, flagellum, pili). */
export const OUTSIDE: ReadonlySet<PartId> = new Set([
  'outerMembrane',
  'bacterialWall',
  'plantWall',
  'flagellum',
  'pili',
]);

export { partsFor };
