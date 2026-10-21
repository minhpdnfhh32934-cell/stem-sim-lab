/**
 * Where the Hardy–Weinberg habitat puts things (pure, tested; world units, y up, the camera looks
 * from +z). Everything here is illustration: places, sizes and plants. Only how many figures and
 * beads there are comes from the model (`binding.ts`).
 *
 * - Figures stand on a meadow, one slot per drawn figure, spread like a sunflower from the centre
 *   out at a fixed spacing (with a little jitter): slot i stays where it is whatever the count,
 *   and no two figures are closer than a figure's footprint, so they never pass through each
 *   other. Most face the camera's side (a cone, not all round), so their antennae show.
 * - The gene pool is a glass jar on a stone plinth at the meadow's right; its beads fill it from
 *   the bottom in layers.
 * - The subject (meadow + plinth) is centred on the origin, inside a much larger terrain disc whose
 *   far edge the fog hides. Trees stand behind the subject (never between it and the camera),
 *   bushes and rocks around it, grass tufts everywhere but on the plinth.
 */
import { discPoints, type Vec3 } from '../../view3d/numbers';
import { rng } from '../stats';

/**
 * Spacing of the figure spiral: one figure per FIGURE_SPACING² of meadow. With the jitter below,
 * neighbours stay at least FIGURE_CLEARANCE apart (tested), more than a figure's footprint.
 */
export const FIGURE_SPACING = 1.8;
/** Diameter of the circle a figure (nose to tail, any facing) stands in: `organisms.ts`, tested. */
export const FIGURE_CLEARANCE = 1.54;
/** Largest shift of a slot off the spiral (each axis), so the crowd does not read as a pattern. */
const JITTER = 0.08;
/** Facing cone: within ±YAW_CONE of facing the camera (+z), so antennae and faces show. */
const YAW_CONE = 1.9;

export interface Slot {
  x: number;
  z: number;
  /** Facing (radians about +y). */
  yaw: number;
  /** Idle-motion phase in [0, 1). */
  phase: number;
}

/** Radius the meadow needs for `slots` figures (the last slot's ring plus half a figure). */
export function meadowRadius(slots: number): number {
  return Math.max(3.5, FIGURE_SPACING * Math.sqrt(Math.max(1, slots) / Math.PI) + 0.8);
}

/**
 * The first `count` figure slots around (cx, cz) (stable: slot i never moves when the count
 * changes).
 */
export function figureSlots(count: number, cx = 0, cz = 0): Slot[] {
  const n = Math.max(0, Math.floor(count));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Slot[] = [];
  for (let i = 0; i < n; i++) {
    // Vogel's sunflower spiral at a fixed density: slot i depends on i only (the first ring
    // starts at i + 1, so the centre slots are not crowded closer than the rest).
    const rr = FIGURE_SPACING * Math.sqrt((i + 1) / Math.PI);
    const a = i * golden;
    const r = rng(1 + i * 2654435761);
    const yaw = (2 * r() - 1) * YAW_CONE;
    const phase = r();
    const jx = (2 * r() - 1) * JITTER;
    const jz = (2 * r() - 1) * JITTER;
    out.push({ x: cx + Math.cos(a) * rr + jx, z: cz + Math.sin(a) * rr + jz, yaw, phase });
  }
  return out;
}

export interface PoolLayout {
  /** Centre of the plinth on the ground plane. */
  x: number;
  z: number;
  jarR: number;
  jarH: number;
  plinthR: number;
  plinthH: number;
  /** The p / q dial on the plinth's top: an annulus around the jar. */
  dialIn: number;
  dialOut: number;
  beadR: number;
  /** Bead centres relative to the jar's inner floor centre, filled from the bottom. */
  beads: Vec3[];
}

/** The gene pool's sizes and bead places for at most `beadSlots` beads (centred at x, z). */
export function poolShape(meadowR: number, beadSlots: number, x = 0, z = 0): PoolLayout {
  const jarR = Math.min(5, Math.max(1.6, meadowR * 0.24));
  const fill = jarR * 1.45;
  const plinthR = jarR * 1.62;
  const n = Math.max(0, Math.floor(beadSlots));
  // The largest bead (up to 13 % of the jar) whose layers fit the fill height.
  let beadR = jarR * 0.13;
  const fits = (r: number) => {
    const inner = jarR * 0.9 - r;
    const perLayer = Math.max(1, Math.floor((Math.PI * inner * inner) / (2.3 * r) ** 2));
    return { perLayer, ok: Math.ceil(n / perLayer) * 2.1 * r <= fill };
  };
  for (let k = 0; k < 80 && !fits(beadR).ok; k++) beadR *= 0.94;
  const { perLayer } = fits(beadR);
  const inner = jarR * 0.9 - beadR;
  const ring = discPoints(perLayer, inner, 0, 9);
  const beads: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i % perLayer] ?? [0, 0, 0];
    beads.push([p[0], beadR + Math.floor(i / perLayer) * 2.1 * beadR, p[2]]);
  }
  return {
    x,
    z,
    jarR,
    jarH: fill + jarR * 0.55,
    plinthR,
    plinthH: 0.2 + jarR * 0.16,
    dialIn: jarR * 1.1,
    dialOut: jarR * 1.52,
    beadR,
    beads,
  };
}

export interface HwLayout {
  meadow: { x: number; z: number; r: number };
  slots: Slot[];
  pool: PoolLayout;
  /** Terrain disc radius (whole units, so a small change of count keeps the same ground). */
  habitatR: number;
  /** Half the subject's width (meadow + plinth). */
  halfWidth: number;
}

/** Gap between the meadow's edge and the plinth. */
const GAP = 1.6;

export function hwLayout(slots: number, beadSlots: number): HwLayout {
  const r = meadowRadius(slots);
  const shape = poolShape(r, beadSlots);
  // Centre the subject (meadow + plinth) on the origin.
  const width = 2 * r * 1.1 + GAP + 2 * shape.plinthR;
  const mx = -width / 2 + r * 1.1;
  const pool = { ...shape, x: width / 2 - shape.plinthR, z: 0 };
  return {
    meadow: { x: mx, z: 0, r },
    slots: figureSlots(slots, mx, 0),
    pool,
    habitatR: Math.ceil(Math.max(30, width * 1.45)),
    halfWidth: width / 2,
  };
}

export type PlantKind = 'conifer' | 'broadleaf' | 'bush' | 'rock' | 'tuft';

export interface Plant {
  kind: PlantKind;
  x: number;
  z: number;
  scale: number;
  yaw: number;
  /** Colour variation in [0, 1). */
  tint: number;
}

export interface PlantCounts {
  trees: number;
  bushes: number;
  rocks: number;
  tufts: number;
}

/** Plants per quality tier (illustration; the High tier draws a denser habitat). */
export function plantCounts(tier: 'low' | 'medium' | 'high'): PlantCounts {
  if (tier === 'high') return { trees: 34, bushes: 36, rocks: 16, tufts: 520 };
  if (tier === 'medium') return { trees: 22, bushes: 22, rocks: 10, tufts: 240 };
  return { trees: 10, bushes: 10, rocks: 5, tufts: 80 };
}

/** Plants of the habitat: seeded, so the same habitat always grows the same plants. */
export function plantPlaces(L: HwLayout, counts: PlantCounts, seed = 5): Plant[] {
  const r = rng(seed);
  const out: Plant[] = [];
  const R = L.habitatR * 0.9;
  const { meadow, pool } = L;
  const clear = (x: number, z: number, margin: number) =>
    Math.hypot(x - meadow.x, z - meadow.z) > meadow.r * 1.1 + margin &&
    Math.hypot(x - pool.x, z - pool.z) > pool.plinthR + margin;
  // Tall plants never stand between the camera (+z) and the subject.
  const shades = (x: number, z: number) => z > -meadow.r * 0.6 && Math.abs(x) < L.halfWidth + 3;
  const place = (tall: boolean, margin: number, near: number) => {
    for (let k = 0; k < 40; k++) {
      // Denser near the subject: radius from `near` × the subject's half width out to R.
      const a = r() * Math.PI * 2;
      const rr = Math.min(R, L.halfWidth * near + (R - L.halfWidth * near) * r() ** 1.6);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (clear(x, z, margin) && !(tall && shades(x, z))) return [x, z] as const;
    }
    return null;
  };
  const add = (
    kind: PlantKind,
    n: number,
    tall: boolean,
    margin: number,
    s0: number,
    s1: number,
  ) => {
    for (let i = 0; i < n; i++) {
      const at = place(tall, margin, tall ? 0.6 : 0.3);
      if (!at) continue;
      out.push({
        kind,
        x: at[0],
        z: at[1],
        scale: s0 + (s1 - s0) * r(),
        yaw: r() * Math.PI * 2,
        tint: r(),
      });
    }
  };
  add('conifer', Math.ceil(counts.trees * 0.55), true, 2, 0.85, 1.4);
  add('broadleaf', Math.floor(counts.trees * 0.45), true, 2, 0.85, 1.35);
  add('bush', counts.bushes, false, 1, 0.6, 1.15);
  add('rock', counts.rocks, false, 0.8, 0.35, 0.95);
  for (let i = 0; i < counts.tufts; i++) {
    const a = r() * Math.PI * 2;
    const rr = R * Math.sqrt(r());
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    if (Math.hypot(x - pool.x, z - pool.z) < pool.plinthR + 0.3) continue;
    out.push({ kind: 'tuft', x, z, scale: 0.7 + 0.6 * r(), yaw: r() * Math.PI * 2, tint: r() });
  }
  return out;
}

/**
 * Points the camera keeps in view: the meadow's edge (ground and figure height), the jar and the
 * label in front of its plinth.
 */
export function subjectPoints(L: HwLayout): Vec3[] {
  const out: Vec3[] = [];
  const { meadow, pool } = L;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = meadow.x + Math.cos(a) * meadow.r * 1.05;
    const z = meadow.z + Math.sin(a) * meadow.r * 1.05;
    out.push([x, 0, z], [x, 1.4, z]);
  }
  const top = pool.plinthH + pool.jarH;
  for (const [dx, dz] of [
    [pool.plinthR, 0],
    [0, pool.plinthR],
    [0, -pool.plinthR],
  ] as const) {
    out.push([pool.x + dx, 0, pool.z + dz], [pool.x + dx * 0.6, top, pool.z + dz * 0.6]);
  }
  // The plinth's label in front of it (the gene pool's name, A and p, a and q).
  out.push([pool.x, -0.3, pool.z + pool.plinthR + 1.2]);
  return out;
}

/** The view's default direction (from the subject towards the camera): about 31° above it. */
export const HW_VIEW: Vec3 = [0.2, 0.62, 1];

/** "Cận cảnh cá thể": low (about 17° above) and a little from the right, near the figures. */
export const HW_CLOSE_VIEW: Vec3 = [0.25, 0.32, 1];
/** Figures the close-up frames beside the jar. */
export const CLOSEUP_FIGURES = 6;
/** The meadow's edge the close-up looks at: facing the jar, a little towards the camera. */
const CLOSE_EDGE = Math.PI / 9;

/**
 * Points the close-up keeps in view: the CLOSEUP_FIGURES slots nearest the meadow's edge facing
 * the jar among the first `drawn` (slots every generation fills, so the close-up never frames an
 * empty patch), whole figures with their antennae, and the plinth with the jar up to its bead
 * pile beside them (the jar's rim may leave the picture: the figures' beads stay readable), with
 * its label in front and some ground on its right for the jar's names.
 */
export function closeupPoints(L: HwLayout, drawn: number): Vec3[] {
  const { meadow, pool } = L;
  const n = Math.max(0, Math.min(L.slots.length, Math.floor(drawn)));
  const ex = meadow.x + Math.cos(CLOSE_EDGE) * meadow.r;
  const ez = meadow.z + Math.sin(CLOSE_EDGE) * meadow.r;
  const near = L.slots
    .slice(0, n)
    .map((s) => ({ s, d: Math.hypot(s.x - ex, s.z - ez) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, CLOSEUP_FIGURES);
  const half = FIGURE_CLEARANCE / 2;
  const out: Vec3[] = [];
  for (const { s } of near)
    out.push([s.x - half, 0, s.z - half], [s.x + half, 0, s.z + half], [s.x, 1.45, s.z]);
  // The bead pile's top (or a third of the jar when it is empty).
  const pile = pool.beads.reduce((m, b) => Math.max(m, b[1] + pool.beadR), pool.jarH / 3);
  const top = pool.plinthH + pile;
  out.push(
    [pool.x - pool.plinthR, 0, pool.z],
    // In front of the plinth: its label (the gene pool's name, A and p, a and q) stays in view.
    [pool.x, -0.3, pool.z + pool.plinthR + 1.2],
    // Ground right of the plinth: room for the jar's names.
    [pool.x + pool.plinthR + 2, 0, pool.z],
    [pool.x - pool.jarR, top, pool.z],
    [pool.x + pool.jarR, top, pool.z],
  );
  return out;
}

/**
 * The orbit centre that puts the subject in the middle of the picture seen from `dir`: the middle
 * of the points' extent across, up and along the view (an orthographic estimate, so a flat meadow
 * seen from above does not leave the top of the picture empty).
 */
export function balancedCenter(points: readonly Vec3[], dir: Vec3): Vec3 {
  const n = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const z: Vec3 = [dir[0] / n, dir[1] / n, dir[2] / n];
  // right = worldUp × z, up = z × right (three.js lookAt).
  const rl = Math.hypot(z[2], z[0]) || 1;
  const right: Vec3 = [z[2] / rl, 0, -z[0] / rl];
  const up: Vec3 = [
    z[1] * right[2] - z[2] * right[1],
    z[2] * right[0] - z[0] * right[2],
    z[0] * right[1] - z[1] * right[0],
  ];
  const axes = [right, up, z];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    axes.forEach((a, k) => {
      const d = p[0] * a[0] + p[1] * a[1] + p[2] * a[2];
      lo[k] = Math.min(lo[k] ?? d, d);
      hi[k] = Math.max(hi[k] ?? d, d);
    });
  const out: Vec3 = [0, 0, 0];
  axes.forEach((a, k) => {
    const mid = points.length ? ((lo[k] ?? 0) + (hi[k] ?? 0)) / 2 : 0;
    out[0] += a[0] * mid;
    out[1] += a[1] * mid;
    out[2] += a[2] * mid;
  });
  return out;
}
