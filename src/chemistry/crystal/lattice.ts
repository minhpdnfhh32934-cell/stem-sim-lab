/**
 * Unit cells of three metal structures and of NaCl, and what geometry alone says about them:
 * how much of each site lies inside the cell, the number of nearest neighbours and the packing
 * fraction of touching hard spheres. Lengths are in units of the cell edge a (no lattice constant:
 * none comes with a source yet, so the picture is "not to scale").
 */

export type Vec3 = [number, number, number];
export type CrystalId = 'bcc' | 'fcc' | 'hcp' | 'nacl';
export const CRYSTALS: CrystalId[] = ['bcc', 'fcc', 'hcp', 'nacl'];
/** M: a metal atom; Na⁺ and Cl⁻ in rock salt. */
export type SiteKind = 'M' | 'Na' | 'Cl';

export interface Site {
  kind: SiteKind;
  p: Vec3;
  /** Fraction of the particle inside the drawn cell (1/8 at a cube corner, 1/6 at a hexagonal one…). */
  share: number;
}

export interface UnitCell {
  id: CrystalId;
  sites: Site[];
  /** Cell edges to draw. */
  edges: [Vec3, Vec3][];
  /** Cell volume in a³. */
  volume: number;
}

const EPS = 1e-9;
const near = (x: number, y: number) => Math.abs(x - y) < EPS;
/** Ideal close packing: c/a = √(8/3). */
export const HCP_C = Math.sqrt(8 / 3);

/** Share of a point of the unit cube: a half for each coordinate on a face (0 or 1). */
function cubeShare(p: Vec3): number {
  return p.reduce((s, x) => s * (near(x, 0) || near(x, 1) ? 0.5 : 1), 1);
}

const CUBE_CORNERS: Vec3[] = [0, 1].flatMap((x) =>
  [0, 1].flatMap((y) => [0, 1].map((z): Vec3 => [x, y, z])),
);
const CUBE_FACES: Vec3[] = [
  [0.5, 0.5, 0],
  [0.5, 0.5, 1],
  [0.5, 0, 0.5],
  [0.5, 1, 0.5],
  [0, 0.5, 0.5],
  [1, 0.5, 0.5],
];
const CUBE_EDGE_MIDS: Vec3[] = [
  ...[0, 1].flatMap((y) => [0, 1].map((z): Vec3 => [0.5, y, z])),
  ...[0, 1].flatMap((x) => [0, 1].map((z): Vec3 => [x, 0.5, z])),
  ...[0, 1].flatMap((x) => [0, 1].map((y): Vec3 => [x, y, 0.5])),
];

function cubeEdges(): [Vec3, Vec3][] {
  const out: [Vec3, Vec3][] = [];
  for (const a of CUBE_CORNERS)
    for (const b of CUBE_CORNERS) {
      const diff = a.reduce((n, x, i) => n + (near(x, b[i] ?? 0) ? 0 : 1), 0);
      if (diff === 1 && a < b) out.push([a, b]);
    }
  return out;
}

/** The hexagon of the HCP prism: vertices at radius a, every 60°. */
const HEX: [number, number][] = Array.from({ length: 6 }, (_, k) => [
  Math.cos((k * Math.PI) / 3),
  Math.sin((k * Math.PI) / 3),
]);

/** Share of a point of the hexagonal prism: 1/3 at a vertical edge, 1/2 on a side, 1/2 on top/bottom. */
function hexShare(p: Vec3): number {
  const z = near(p[2], 0) || near(p[2], HCP_C) ? 0.5 : 1;
  const r = Math.hypot(p[0], p[1]);
  const atVertex = HEX.some(([x, y]) => near(p[0], x) && near(p[1], y));
  const lateral = atVertex ? 1 / 3 : near(r, 1) ? 0.5 : 1;
  return z * lateral;
}

function hcpCell(): UnitCell {
  const sites: Site[] = [];
  for (const z of [0, HCP_C]) {
    for (const [x, y] of HEX) sites.push({ kind: 'M', p: [x, y, z], share: 0 });
    sites.push({ kind: 'M', p: [0, 0, z], share: 0 });
  }
  // The middle layer sits over every other triangle of the hexagon (radius a/√3, 30° + k·120°).
  for (let k = 0; k < 3; k++) {
    const t = Math.PI / 6 + (k * 2 * Math.PI) / 3;
    sites.push({
      kind: 'M',
      p: [Math.cos(t) / Math.sqrt(3), Math.sin(t) / Math.sqrt(3), HCP_C / 2],
      share: 0,
    });
  }
  for (const s of sites) s.share = hexShare(s.p);
  const edges: [Vec3, Vec3][] = [];
  for (let k = 0; k < 6; k++) {
    const [x0, y0] = HEX[k] ?? [0, 0];
    const [x1, y1] = HEX[(k + 1) % 6] ?? [0, 0];
    edges.push(
      [
        [x0, y0, 0],
        [x1, y1, 0],
      ],
      [
        [x0, y0, HCP_C],
        [x1, y1, HCP_C],
      ],
      [
        [x0, y0, 0],
        [x0, y0, HCP_C],
      ],
    );
  }
  return { id: 'hcp', sites, edges, volume: ((3 * Math.sqrt(3)) / 2) * HCP_C };
}

/** The drawn unit cell of a structure (cube of edge a, or the hexagonal prism for HCP). */
export function unitCell(id: CrystalId): UnitCell {
  if (id === 'hcp') return hcpCell();
  const pts: { kind: SiteKind; p: Vec3 }[] =
    id === 'bcc'
      ? [...CUBE_CORNERS, [0.5, 0.5, 0.5] as Vec3].map((p) => ({ kind: 'M' as const, p }))
      : id === 'fcc'
        ? [...CUBE_CORNERS, ...CUBE_FACES].map((p) => ({ kind: 'M' as const, p }))
        : [
            // Rock salt: Cl⁻ on the FCC points, Na⁺ on the edge midpoints and the centre.
            ...[...CUBE_CORNERS, ...CUBE_FACES].map((p) => ({ kind: 'Cl' as const, p })),
            ...[...CUBE_EDGE_MIDS, [0.5, 0.5, 0.5] as Vec3].map((p) => ({
              kind: 'Na' as const,
              p,
            })),
          ];
  return {
    id,
    sites: pts.map((s) => ({ ...s, share: cubeShare(s.p) })),
    edges: cubeEdges(),
    volume: 1,
  };
}

/** Particles of each kind inside one cell: the sum of the sites' shares. */
export function countInCell(cell: UnitCell): Partial<Record<SiteKind, number>> {
  const out: Partial<Record<SiteKind, number>> = {};
  for (const s of cell.sites) out[s.kind] = (out[s.kind] ?? 0) + s.share;
  return out;
}

/** How the count is made: shares × number of sites with that share, per kind (e.g. 8 × 1/8 + 1). */
export function countTerms(cell: UnitCell): { kind: SiteKind; share: number; sites: number }[] {
  const out: { kind: SiteKind; share: number; sites: number }[] = [];
  for (const s of cell.sites) {
    const t = out.find((x) => x.kind === s.kind && near(x.share, s.share));
    if (t) t.sites++;
    else out.push({ kind: s.kind, share: s.share, sites: 1 });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.share - b.share);
}

/** The infinite lattice as a basis repeated along three translations (Cartesian, units of a). */
function lattice(id: CrystalId): { basis: { kind: SiteKind; p: Vec3 }[]; t: [Vec3, Vec3, Vec3] } {
  const cube: [Vec3, Vec3, Vec3] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  if (id === 'hcp')
    return {
      basis: [
        { kind: 'M', p: [0, 0, 0] },
        { kind: 'M', p: [0.5, Math.sqrt(3) / 6, HCP_C / 2] },
      ],
      t: [
        [1, 0, 0],
        [-0.5, Math.sqrt(3) / 2, 0],
        [0, 0, HCP_C],
      ],
    };
  // The sites of the cube that are not repeats of another one (coordinates in [0, 1)).
  const inside = unitCell(id).sites.filter((s) => s.p.every((x) => x < 1 - EPS));
  return { basis: inside.map(({ kind, p }) => ({ kind, p })), t: cube };
}

/**
 * Nearest neighbours of a particle of `kind`: the particles at the smallest distance, counted in a
 * block of 5 × 5 × 5 cells around it. Returns their number, their kind and that distance (a).
 */
export function coordination(
  id: CrystalId,
  kind: SiteKind,
): { n: number; of: SiteKind[]; d: number } {
  const { basis, t } = lattice(id);
  const centre = basis.find((b) => b.kind === kind);
  if (!centre) return { n: 0, of: [], d: 0 };
  const found: { kind: SiteKind; d: number }[] = [];
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++)
      for (let k = -2; k <= 2; k++)
        for (const b of basis) {
          const p = b.p.map(
            (x, c) => x + i * (t[0][c] ?? 0) + j * (t[1][c] ?? 0) + k * (t[2][c] ?? 0),
          );
          const d = Math.hypot(...p.map((x, c) => x - (centre.p[c] ?? 0)));
          if (d > EPS) found.push({ kind: b.kind, d });
        }
  const d = Math.min(...found.map((f) => f.d));
  const first = found.filter((f) => Math.abs(f.d - d) < 1e-7);
  return { n: first.length, of: [...new Set(first.map((f) => f.kind))], d };
}

/**
 * Packing fraction of a metal: equal hard spheres touching their nearest neighbours (radius = half
 * that distance), their volume inside the cell over the cell's volume. None for NaCl: it would
 * need the two ions' radii.
 */
export function packingFraction(id: CrystalId): number | null {
  if (id === 'nacl') return null;
  const cell = unitCell(id);
  const n = countInCell(cell).M ?? 0;
  const r = coordination(id, 'M').d / 2;
  return (n * (4 / 3) * Math.PI * r ** 3) / cell.volume;
}
