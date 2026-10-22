/**
 * Where the logistic-growth habitat puts things (pure, tested; world units, y up, the camera looks
 * from +z). Everything here is illustration: places, sizes, the fence, the food patches and the
 * plants. Only how many figures stand and how many patches are grazed comes from the model
 * (`binding.ts`).
 *
 * - Figures stand on a meadow, one slot per drawn figure, on the same sunflower spiral as the
 *   Hardy–Weinberg habitat (`figureSlots`: slot i never moves when the count changes, neighbours
 *   never overlap). The population fills it from the centre out.
 * - A low fence rings exactly the first `kSlots` slots: the room the picture gives K individuals
 *   at its drawing scale (an illustration of the carrying capacity, not a place in the model).
 *   Slots from kSlots on (only when N₀ > K) continue the spiral at the same density in a ring
 *   outside the fence, so the figures above K stand outside it.
 * - Food patches (clover) lie inside the fence, ordered from the centre out: the grazed ones are
 *   the first, so the bare ground spreads with the crowd.
 * - The gauge column stands on a plinth at the meadow's right; the subject (meadow + plinth) is
 *   centred on the origin inside a larger terrain disc whose far edge the fog hides.
 */
import { discPoints, type Vec3 } from '../../view3d/numbers';
import {
  FIGURE_CLEARANCE,
  FIGURE_SPACING,
  figureSlots,
  plantPlaces,
  type Plant,
  type PlantCounts,
  type Slot,
} from '../../genetics/hw3d/layout';

export type { Slot };

export interface GaugeLayout {
  /** Centre of the plinth on the ground plane. */
  x: number;
  z: number;
  plinthR: number;
  plinthH: number;
  /** The glass tube (outer radius) and the height its full scale (`model.top`) fills. */
  tubeR: number;
  tubeH: number;
}

export interface FoodPatch {
  x: number;
  z: number;
  yaw: number;
  /** Radius of the patch (world units). */
  size: number;
}

export interface LogiLayout {
  /** The crowd's disc: every slot of the run (outside the fence too when N₀ > K). */
  meadow: { x: number; z: number; r: number };
  /** Radius of the fence (just outside slot kSlots − 1). */
  fenceR: number;
  slots: Slot[];
  gauge: GaugeLayout;
  /** Food patches inside the fence, nearest the centre first. */
  food: FoodPatch[];
  /** Terrain disc radius (whole units, so a small change of count keeps the same ground). */
  habitatR: number;
  /** Half the subject's width (meadow + plinth). */
  halfWidth: number;
}

/** Gap between the crowd's edge and the plinth. */
const GAP = 2;
/** Fence posts stand about this far apart. */
export const POST_SPACING = 1.7;

/** Food patches per quality tier (illustration; the High tier draws a denser meadow). */
export function foodCount(tier: 'low' | 'medium' | 'high'): number {
  return tier === 'high' ? 40 : tier === 'medium' ? 28 : 14;
}

/**
 * The fence's radius for `kSlots` figures: the last slot's ring plus a little more than half a
 * figure (`FIGURE_CLEARANCE`), so every figure below kSlots stands clear inside it.
 */
export const fenceRadius = (kSlots: number): number =>
  Math.max(
    3.5,
    FIGURE_SPACING * Math.sqrt(Math.max(1, kSlots) / Math.PI) + FIGURE_CLEARANCE * 0.62,
  );

/** The gauge's sizes for a crowd of radius r (a column about as tall as the crowd is deep). */
export function gaugeShape(r: number): Omit<GaugeLayout, 'x' | 'z'> {
  const tubeH = Math.min(11, Math.max(5, r * 0.7));
  const tubeR = Math.max(0.8, tubeH * 0.12);
  return { tubeH, tubeR, plinthR: tubeR * 2.1, plinthH: 0.25 + tubeR * 0.3 };
}

/** Gap from the fence to the first ring of slots outside it (more than half a figure). */
const OUTSIDE_GAP = 1.1;

/**
 * The first `count` slots of a crowd fenced at `kSlots` around (cx, cz): slot i < kSlots is the
 * Hardy–Weinberg spiral's slot i (inside the fence); slot i ≥ kSlots lies in a ring outside the
 * fence at the same density. Slot i depends on i and kSlots only (stable when the count changes).
 */
export function crowdSlots(count: number, kSlots: number, cx = 0, cz = 0): Slot[] {
  const n = Math.max(0, Math.floor(count));
  const k = Math.max(0, Math.floor(kSlots));
  const base = figureSlots(n, cx, cz);
  if (n <= k) return base;
  const outer = fenceRadius(k) + OUTSIDE_GAP;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return base.map((s, i) => {
    if (i < k) return s;
    const rr = Math.sqrt(
      outer * outer + (FIGURE_SPACING * FIGURE_SPACING * (i - k + 0.5)) / Math.PI,
    );
    const a = i * golden;
    return { ...s, x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr };
  });
}

/** Radius of the crowd's disc for `count` slots fenced at `kSlots` (plus half a figure). */
export function crowdRadius(count: number, kSlots: number): number {
  const fence = fenceRadius(kSlots);
  if (count <= kSlots) return fence;
  const outer = fence + OUTSIDE_GAP;
  return (
    Math.sqrt(outer * outer + (FIGURE_SPACING * FIGURE_SPACING * (count - kSlots)) / Math.PI) + 0.8
  );
}

/**
 * The layout for `slots` figures (the most the run draws) and a fence round `kSlots` of them,
 * with `patches` food patches inside the fence.
 */
export function logiLayout(slots: number, kSlots: number, patches: number): LogiLayout {
  const fenceR = fenceRadius(kSlots);
  const r = Math.max(fenceR + 0.4, crowdRadius(slots, kSlots));
  const shape = gaugeShape(r);
  // Centre the subject (crowd + plinth) on the origin.
  const width = 2 * r + GAP + 2 * shape.plinthR;
  const mx = -width / 2 + r;
  const gauge: GaugeLayout = { ...shape, x: width / 2 - shape.plinthR, z: 0 };
  // Patches on their own spiral inside the fence (nearest the centre first), sized to the room.
  const n = Math.max(0, Math.floor(patches));
  const inner = Math.max(1, fenceR - 0.9);
  const room = n > 0 ? Math.sqrt((Math.PI * inner * inner) / n) : 0;
  const size = Math.min(1.25, Math.max(0.45, 0.42 * room));
  const food: FoodPatch[] = discPoints(n, inner, 0, 17).map((p, i) => ({
    x: mx + p[0],
    z: p[2],
    yaw: (i * 2.399963) % (Math.PI * 2),
    size,
  }));
  food.sort((a, b) => Math.hypot(a.x - mx, a.z) - Math.hypot(b.x - mx, b.z));
  return {
    meadow: { x: mx, z: 0, r },
    fenceR,
    slots: crowdSlots(slots, kSlots, mx, 0),
    gauge,
    food,
    habitatR: Math.ceil(Math.max(30, width * 1.45)),
    halfWidth: width / 2,
  };
}

/** Fence posts round the fence circle (x, z), evenly spaced about POST_SPACING apart. */
export function fencePosts(L: LogiLayout): [number, number][] {
  const n = Math.max(12, Math.round((2 * Math.PI * L.fenceR) / POST_SPACING));
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [L.meadow.x + Math.cos(a) * L.fenceR, L.meadow.z + Math.sin(a) * L.fenceR];
  });
}

/** Plants of the habitat (seeded): clear of the crowd, the fence and the plinth. */
export function logiPlants(L: LogiLayout, counts: PlantCounts): Plant[] {
  return plantPlaces(
    {
      meadow: { ...L.meadow, r: Math.max(L.meadow.r, L.fenceR + 0.4) },
      pool: L.gauge,
      habitatR: L.habitatR,
      halfWidth: L.halfWidth,
    },
    counts,
    11,
  );
}

/**
 * Points the camera keeps in view: the crowd's edge (ground and figure height), the fence, the
 * column on its plinth with its labels (left: K and K/2, right: N and dN/dt) and the arrow above.
 */
export function subjectPoints(L: LogiLayout): Vec3[] {
  const out: Vec3[] = [];
  const { meadow, gauge } = L;
  const r = Math.max(meadow.r, L.fenceR) * 1.04;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = meadow.x + Math.cos(a) * r;
    const z = meadow.z + Math.sin(a) * r;
    out.push([x, 0, z], [x, 1.4, z]);
  }
  const top = gauge.plinthH + gauge.tubeH * 1.06 + 1.05;
  for (const [dx, dz] of [
    [gauge.plinthR, 0],
    [0, gauge.plinthR],
    [0, -gauge.plinthR],
  ] as const) {
    out.push([gauge.x + dx, 0, gauge.z + dz], [gauge.x + dx * 0.5, top, gauge.z + dz * 0.5]);
  }
  // The N / dN/dt label on the column's right.
  out.push([gauge.x + gauge.plinthR + 2.2, gauge.plinthH + gauge.tubeH * 0.5, gauge.z]);
  return out;
}

/** The view's default direction (from the subject towards the camera): about 28° above it. */
export const LOGI_VIEW: Vec3 = [0.2, 0.56, 1];
/** "Cận cảnh đàn" and the column's close-up: lower and nearer, the animals seen from the side. */
export const LOGI_CLOSE_VIEW: Vec3 = [0.22, 0.27, 1];
/** A picked animal: from higher up, so the animals in front never hide it. */
export const LOGI_PICK_VIEW: Vec3 = [0.16, 0.9, 1];

/** Points of a strip of the ground (ground and figure height) from z0 to z1, half-width w. */
function strip(cx: number, cz: number, z0: number, z1: number, w: number): Vec3[] {
  const out: Vec3[] = [];
  for (const z of [z0, (z0 + z1) / 2, z1])
    for (const x of [-w, 0, w]) out.push([cx + x, 0, cz + z], [cx + x, 1.4, cz + z]);
  return out;
}

/**
 * "Cận cảnh đàn": the strip of the meadow from just in front of its
 * centre, where the first animals stand (so the close-up is never empty), to the crowd's front
 * edge and the fence facing the camera, about a third of the crowd's radius either side.
 */
export function closeupPoints(L: LogiLayout): Vec3[] {
  const edge = Math.max(L.meadow.r, L.fenceR);
  return strip(L.meadow.x, L.meadow.z, 0.1 * edge, edge * 1.04, edge * 0.36);
}

/**
 * The clover's close-up (seen from the overview's height, so the bare and the lush patches show
 * between the animals): the outer part of the meadow facing the camera, where the patches grazed
 * last stand, with the inner ring above it.
 */
export function foodPoints(L: LogiLayout): Vec3[] {
  const edge = Math.max(L.meadow.r, L.fenceR);
  return strip(L.meadow.x, L.meadow.z, 0.3 * edge, edge * 1.04, edge * 0.36);
}

/** A picked animal's close-up: its slot and the neighbours about two figures away. */
export function figurePoints(L: LogiLayout, slot: number): Vec3[] {
  const s = L.slots[slot];
  if (!s) return [];
  const r = FIGURE_SPACING * 2.2;
  return strip(s.x, s.z, -r, r, r);
}

/**
 * The column's close-up: the plinth, the tube with its title, the K and K/2 tags on its left and
 * the moment's label (N, dN/dt) on its right — so a card beside it never covers a label.
 */
export function gaugePoints(L: LogiLayout): Vec3[] {
  const g = L.gauge;
  const top = g.plinthH + g.tubeH * 1.06 + 1.75;
  const left = g.x - g.tubeR * 1.1 - 0.55 - 3.4;
  const right = g.x + g.tubeR + 0.9 + 4.4;
  const out: Vec3[] = [];
  for (const x of [left, g.x - g.plinthR, g.x + g.plinthR, right])
    out.push([x, 0, g.z + g.plinthR], [x, top, g.z], [x, 0, g.z - g.plinthR]);
  return out;
}
