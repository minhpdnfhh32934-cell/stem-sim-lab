/**
 * Where the genetic drift archipelago puts things (pure, tested; world units, y up, sea level
 * y = 0, the camera looks from +z). Everything here is illustration: islands, their shapes, places
 * and plants. Only how many islands (runs) and figures (N / k) there are comes from the model.
 *
 * - The islands sit on a staggered grid, numbered like reading a page: island 1 at the back left
 *   (the top left of the picture), then left to right, row by row towards the camera.
 * - Each island is a low dome with a sandy beach, its coast a little uneven (seeded noise), its
 *   figures on the grassy top in a sunflower spiral (the Hardy–Weinberg habitat's slots: stable,
 *   never closer than a figure's footprint).
 * - A band around the coast shows the island's p : q split; its tag stands on the water in front.
 * - Trees grow on the island's back half (never between the camera and the figures), bushes and
 *   rocks around, grass tufts on the grass.
 */
import type { Vec3 } from '../../view3d/numbers';
import { fbm3 } from '../../view3d/noise';
import { figureSlots, meadowRadius, type Plant, type PlantKind, type Slot } from '../hw3d/layout';
import { rng } from '../stats';

/** Sand and grass between the figures and the water (world units). */
export const SHORE = 1.7;
/** How far a coast swells in or out of its mean radius (share of it). */
const WOBBLE = 0.08;
/** Open water between two neighbouring coasts (world units). */
export const STRAIT = 2.2;
/** Largest shift of an island off its grid place (each axis, world units). */
const JITTER = 0.5;
/** The p : q band: its inner radius past the coast's widest point, its width and height. */
export const BAND_GAP = 0.45;
export const BAND_WIDTH = 0.36;
export const BAND_HEIGHT = 0.12;

export interface IslandPlace {
  /** 0-based index = the run (the learner sees index + 1). */
  index: number;
  x: number;
  z: number;
  /** Mean coast radius and the radius the figures stand within. */
  coast: number;
  meadow: number;
  /** Shape seed (coast and hills). */
  seed: number;
}

export interface DriftLayout {
  islands: IslandPlace[];
  /** Every island's figure slots, island r's at r·figures … (r + 1)·figures − 1 (world). */
  slots: Slot[];
  figures: number;
  /** Centre-to-centre distance of neighbours. */
  pitch: number;
  /** Radius of a circle around the origin holding every island. */
  extent: number;
}

/** Columns of the island grid: about as many as rows look tall from the view's height. */
export function columnsFor(runs: number): number {
  const n = Math.max(1, Math.round(runs));
  return Math.min(n, Math.max(1, Math.ceil(Math.sqrt(n * 1.3))));
}

/** The coast radius of an island towards `angle` (radians about +y, from +x towards +z). */
export function coastAt(island: IslandPlace, angle: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const n = fbm3(c * 1.3 + 7, island.seed * 0.37, s * 1.3 + 3, island.seed, 3);
  // fbm3 is in [−1, 1] (mostly within ±0.5): the coast stays within ±WOBBLE of its mean.
  return island.coast * (1 + WOBBLE * Math.max(-1, Math.min(1, n)));
}

/** The widest the coast ever gets (the band's inner edge stays outside it). */
export const coastMax = (island: IslandPlace) => island.coast * (1 + WOBBLE);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Ground height of an island at (x, z) (world): a grassy dome down to a beach at sea level on its
 * coast, then under the water. Bumps are seeded noise.
 */
export function islandHeight(island: IslandPlace, x: number, z: number): number {
  const dx = x - island.x;
  const dz = z - island.z;
  const u = Math.hypot(dx, dz) / coastAt(island, Math.atan2(dz, dx));
  const bumps = fbm3(dx * 0.35 + 11, island.seed, dz * 0.35 + 5, island.seed + 1, 3);
  const top = 0.75 * (1 - smooth(0.6, 1, u)) * (0.85 + 0.25 * bumps);
  return top + 0.14 * (1 - smooth(0.85, 1.12, u)) - 0.1 - 0.5 * smooth(1, 1.3, u);
}

export function driftLayout(runs: number, figures: number): DriftLayout {
  const n = Math.max(1, Math.round(runs));
  const f = Math.max(0, Math.round(figures));
  const meadow = meadowRadius(f);
  const coast = meadow + SHORE;
  const pitch = 2 * (coast * (1 + WOBBLE) + BAND_GAP + BAND_WIDTH) + STRAIT;
  const cols = columnsFor(n);
  const rows = Math.ceil(n / cols);
  const rowStep = pitch * 0.9;
  const r = rng(31 + n);
  const islands: IslandPlace[] = [];
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const col = k - row * cols;
    // Odd rows shift by half a pitch; a short last row is centred to a whole column (so it keeps
    // the half-pitch stagger against the row behind it).
    const shift = (row % 2 ? 0.25 : -0.25) * (rows > 1 ? pitch : 0);
    const lead = row === rows - 1 ? Math.floor((cols - inRow) / 2) - (cols - inRow) / 2 : 0;
    // A little jitter (at most ±JITTER each way), so the grid does not read as a pattern; the
    // straits stay at least STRAIT − 2·JITTER wide.
    const x = (col + lead - (inRow - 1) / 2) * pitch + shift + (2 * r() - 1) * JITTER;
    const z = (row - (rows - 1) / 2) * rowStep + (2 * r() - 1) * JITTER;
    islands.push({ index: k, x, z, coast, meadow, seed: 3 + k * 17 });
  }
  const slots: Slot[] = islands.flatMap((is) => figureSlots(f, is.x, is.z));
  const extent = Math.max(...islands.map((is) => Math.hypot(is.x, is.z) + pitch / 2));
  return { islands, slots, figures: f, pitch, extent };
}

/** Plants on one island per quality tier (illustration). */
export function islandPlantCounts(tier: 'low' | 'medium' | 'high'): {
  trees: number;
  bushes: number;
  rocks: number;
  tufts: number;
} {
  if (tier === 'high') return { trees: 4, bushes: 3, rocks: 2, tufts: 26 };
  if (tier === 'medium') return { trees: 3, bushes: 2, rocks: 1, tufts: 14 };
  return { trees: 1, bushes: 1, rocks: 1, tufts: 6 };
}

/** Plants of every island: seeded, so the same island always grows the same plants. */
export function islandPlants(
  L: DriftLayout,
  counts: ReturnType<typeof islandPlantCounts>,
): Plant[] {
  const out: Plant[] = [];
  for (const is of L.islands) {
    const r = rng(is.seed * 13 + 1);
    // Between the figures and the beach (u: share of the coast radius at that angle).
    const band = (back: boolean) => {
      const a = back ? Math.PI + r() * Math.PI : r() * Math.PI * 2;
      const lo = (is.meadow + 0.35) / is.coast;
      const u = lo + (0.84 - lo) * r();
      const rr = u * coastAt(is, a);
      return [is.x + Math.cos(a) * rr, is.z + Math.sin(a) * rr] as const;
    };
    const add = (kind: PlantKind, n: number, back: boolean, s0: number, s1: number) => {
      for (let i = 0; i < n; i++) {
        const [x, z] = band(back);
        out.push({ kind, x, z, scale: s0 + (s1 - s0) * r(), yaw: r() * Math.PI * 2, tint: r() });
      }
    };
    add('conifer', Math.ceil(counts.trees * 0.6), true, 0.42, 0.62);
    add('broadleaf', Math.floor(counts.trees * 0.4), true, 0.42, 0.6);
    add('bush', counts.bushes, false, 0.45, 0.75);
    add('rock', counts.rocks, false, 0.3, 0.55);
    for (let i = 0; i < counts.tufts; i++) {
      const a = r() * Math.PI * 2;
      const rr = 0.86 * coastAt(is, a) * Math.sqrt(r());
      out.push({
        kind: 'tuft',
        x: is.x + Math.cos(a) * rr,
        z: is.z + Math.sin(a) * rr,
        scale: 0.6 + 0.5 * r(),
        yaw: r() * Math.PI * 2,
        tint: r(),
      });
    }
  }
  return out;
}

/** Where an island's tag stands: on the water in front of its band (camera side). */
export function tagPoint(is: IslandPlace): Vec3 {
  return [is.x, 0.05, is.z + coastMax(is) + BAND_GAP + BAND_WIDTH + 0.6];
}

/** Points the camera keeps in view for an island: its band's rim, figure height, its tag. */
export function islandPoints(is: IslandPlace, outline = 12): Vec3[] {
  const R = coastMax(is) + BAND_GAP + BAND_WIDTH;
  const ring = (n: number, r: number, y: number): Vec3[] =>
    Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return [is.x + Math.cos(a) * r, y, is.z + Math.sin(a) * r];
    });
  const out: Vec3[] = [...ring(outline, R, 0), ...ring(6, is.meadow, 1.45)];
  out.push(tagPoint(is));
  return out;
}

/** Points the camera keeps in view for the whole archipelago. */
export function subjectPoints(L: DriftLayout): Vec3[] {
  return L.islands.flatMap((is) => islandPoints(is, 8));
}

/** The view's default direction (from the subject towards the camera): about 27° above it. */
export const DRIFT_VIEW: Vec3 = [0.1, 0.5, 1];
/** "Cận cảnh một đảo": lower (about 19° above) and a little from the right. */
export const DRIFT_CLOSE_VIEW: Vec3 = [0.25, 0.36, 1];

/** The island in the middle of the front row (nearest the camera): the close-up's default. */
export function frontIsland(runs: number): number {
  const n = Math.max(1, Math.round(runs));
  const cols = columnsFor(n);
  const lastRow = Math.ceil(n / cols) - 1;
  const inRow = n - lastRow * cols;
  return lastRow * cols + Math.floor((inRow - 1) / 2);
}
