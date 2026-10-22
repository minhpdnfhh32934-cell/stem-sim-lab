/**
 * Where the predator–prey habitat puts things (pure, tested; world units, y up, the camera looks
 * from +z). Everything here is illustration: places, sizes, the board, the clover and the plants.
 * Only how many animals of each species stand comes from the model (`binding.ts`).
 *
 * - Both species share one meadow: the Hardy–Weinberg sunflower spiral with one slot per figure
 *   either species can ever draw (`speciesSlots`). The predators' slots are spread evenly through
 *   the spiral, the prey take the rest; each species fills its own slots from the centre out, so
 *   slot i of a species never moves when the counts change and the two always mingle.
 * - The meadow is covered with clover (always lush: the model gives the prey unlimited food).
 * - Left to right, the picture reads from the animals to their numbers: the meadow, the two
 *   columns (x and y) on one oval plinth, then the phase-plane board on two posts, leaning back a
 *   little and turned slightly towards the meadow (the camera's side).
 * - The subject (meadow + plinth + board) is centred on the origin inside a larger terrain disc
 *   whose far edge the fog hides; plants stay clear of the meadow, the plinth and the board.
 */
import { discPoints, type Vec3 } from '../../view3d/numbers';
import {
  FIGURE_SPACING,
  figureSlots,
  meadowRadius,
  plantPlaces,
  type Plant,
  type PlantCounts,
  type Slot,
} from '../../genetics/hw3d/layout';

export type { Slot };

export interface ColumnsLayout {
  /** Centre of the oval plinth on the ground plane. */
  x: number;
  z: number;
  /** The plinth's half-width (x) and half-depth (z), its height. */
  plinthRx: number;
  plinthRz: number;
  plinthH: number;
  /** Each glass tube's radius and the height the full scale (`model.top`) fills. */
  tubeR: number;
  tubeH: number;
  /** x of the prey tube's and the predator tube's centres. */
  preyX: number;
  predatorX: number;
}

export interface BoardLayout {
  /** Foot of the board (centre between its posts, on the ground plane). */
  x: number;
  z: number;
  width: number;
  height: number;
  /** Height of the panel's lower edge above the ground. */
  lift: number;
  /** Lean back (radians): the top further from the camera. */
  lean: number;
  /** Turn about the vertical (radians; negative: the face turns towards -x, the meadow). */
  yaw: number;
}

export interface CloverPatch {
  x: number;
  z: number;
  yaw: number;
  size: number;
}

export interface LvLayout {
  meadow: { x: number; z: number; r: number };
  prey: Slot[];
  predators: Slot[];
  columns: ColumnsLayout;
  board: BoardLayout;
  clover: CloverPatch[];
  /** Terrain disc radius (whole units, so a small change of count keeps the same ground). */
  habitatR: number;
  /** Half the subject's width (meadow + plinth + board). */
  halfWidth: number;
}

/**
 * Gap between the meadow's edge and the plinth: the prey's plaque under its tube reaches left of
 * the plinth and must not cover the crowd's front.
 */
const GAP = 3;
/**
 * The gap from the plinth to the board as a share of the subject's whole width. Right of the
 * predator tube stand its arrow and its y* tag; the tag is page text of a fixed size, so at the
 * overview (which fits the whole width) it takes about a tenth of the width whatever the
 * populations, and the gap grows with the width to keep it clear of the board.
 */
export const BOARD_GAP_SHARE = 0.13;

/** Clover patches per quality tier (illustration). */
export function cloverCount(tier: 'low' | 'medium' | 'high'): number {
  return tier === 'high' ? 44 : tier === 'medium' ? 30 : 16;
}

/**
 * The slots of `prey` + `predators` figures on one sunflower spiral round (cx, cz): spiral slot i
 * is a predator's when ⌊(i + 1)·P / S⌋ > ⌊i·P / S⌋ (P predators of S slots: spread evenly), else
 * a prey's. Each list is in spiral order (the centre first).
 */
export function speciesSlots(
  prey: number,
  predators: number,
  cx = 0,
  cz = 0,
): { prey: Slot[]; predators: Slot[] } {
  const a = Math.max(0, Math.floor(prey));
  const b = Math.max(0, Math.floor(predators));
  const S = a + b;
  const all = figureSlots(S, cx, cz);
  const out = { prey: [] as Slot[], predators: [] as Slot[] };
  all.forEach((s, i) => {
    const pred = Math.floor(((i + 1) * b) / S) > Math.floor((i * b) / S);
    (pred ? out.predators : out.prey).push(s);
  });
  return out;
}

/** The columns' sizes for a meadow of radius r (a little taller than the crowd is deep). */
export function columnsShape(r: number): Omit<ColumnsLayout, 'x' | 'z' | 'preyX' | 'predatorX'> {
  const tubeH = Math.min(9, Math.max(4.5, r * 0.62));
  const tubeR = Math.max(0.7, tubeH * 0.1);
  return {
    tubeH,
    tubeR,
    plinthRx: tubeR * 3.5,
    plinthRz: tubeR * 1.75,
    plinthH: 0.25 + tubeR * 0.3,
  };
}

/** The board's size for a meadow of radius r. */
export function boardShape(
  r: number,
): Pick<BoardLayout, 'width' | 'height' | 'lift' | 'lean' | 'yaw'> {
  const width = Math.min(10, Math.max(6.5, r * 0.85));
  return { width, height: width * 0.66, lift: 0.7, lean: 0.18, yaw: -0.24 };
}

/** The layout for `prey` and `predators` slots (the most figures each species draws). */
export function lvLayout(prey: number, predators: number, patches: number): LvLayout {
  const S = Math.max(0, Math.floor(prey)) + Math.max(0, Math.floor(predators));
  const r = meadowRadius(S);
  const shape = columnsShape(r);
  const bs = boardShape(r);
  // The board's footprint across the view, turned by its yaw.
  const boardW = bs.width * Math.cos(bs.yaw);
  const rest = 2 * r + GAP + 2 * shape.plinthRx + boardW;
  const width = rest / (1 - BOARD_GAP_SHARE);
  const mx = -width / 2 + r;
  const cx = mx + r + GAP + shape.plinthRx;
  const offset = shape.tubeR * 2;
  const columns: ColumnsLayout = {
    ...shape,
    x: cx,
    z: 0,
    preyX: cx - offset,
    predatorX: cx + offset,
  };
  const board: BoardLayout = { ...bs, x: width / 2 - boardW / 2, z: -0.6 };
  const n = Math.max(0, Math.floor(patches));
  const inner = Math.max(1, r - 0.7);
  const room = n > 0 ? Math.sqrt((Math.PI * inner * inner) / n) : 0;
  const size = Math.min(1.25, Math.max(0.45, 0.4 * room));
  const clover: CloverPatch[] = discPoints(n, inner, 0, 23).map((p, i) => ({
    x: mx + p[0],
    z: p[2],
    yaw: (i * 2.399963) % (Math.PI * 2),
    size,
  }));
  const s = speciesSlots(prey, predators, mx, 0);
  return {
    meadow: { x: mx, z: 0, r },
    prey: s.prey,
    predators: s.predators,
    columns,
    board,
    clover,
    habitatR: Math.ceil(Math.max(30, width * 1.45)),
    halfWidth: width / 2,
  };
}

/** Whether (x, z) is within `margin` of the board's footprint (its posts and the panel above). */
export function nearBoard(L: LvLayout, x: number, z: number, margin: number): boolean {
  const b = L.board;
  // Into the board's own frame (turned back by its yaw about its feet).
  const dx = x - b.x;
  const dz = z - b.z;
  const s = dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw);
  const d = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
  const depth = (b.lift / Math.cos(b.lean) + b.height) * Math.sin(b.lean) + 0.4;
  return Math.abs(s) < b.width / 2 + margin && d < 0.4 + margin && d > -depth - margin;
}

/** Plants of the habitat (seeded): clear of the meadow, the plinth and the board. */
export function lvPlants(L: LvLayout, counts: PlantCounts): Plant[] {
  return plantPlaces(
    {
      meadow: L.meadow,
      pool: { x: L.columns.x, z: L.columns.z, plinthR: L.columns.plinthRx },
      habitatR: L.habitatR,
      halfWidth: L.halfWidth,
    },
    counts,
    13,
  ).filter((p) =>
    p.kind === 'tuft'
      ? !nearBoard(L, p.x, p.z, 0.1)
      : !nearBoard(L, p.x, p.z, p.kind === 'rock' ? 1 : 2.4),
  );
}

/**
 * A point of the board in world units (ground plane at y = 0): (s, h) with s across from its
 * centre (-width/2 ... width/2), h up along the leaning panel from its lower edge (0 ... height;
 * -L0 = the posts' feet, L0 = lift / cos(lean)), `out` off its face. The board's group in
 * `board.ts` uses the same transform: Euler order 'YXZ' (the yaw of a panel leaning back).
 */
export function boardPoint(b: BoardLayout, s: number, h: number, out = 0): Vec3 {
  const c = Math.cos(b.lean);
  const n = Math.sin(b.lean);
  const Y = b.lift / c + h;
  // Lean: (Y, out) -> (c Y + n out, -n Y + c out); then the yaw about y.
  const y = c * Y + n * out;
  const z = -n * Y + c * out;
  const cy = Math.cos(b.yaw);
  const sy = Math.sin(b.yaw);
  return [b.x + s * cy + z * sy, y, b.z - s * sy + z * cy];
}

/** The direction square on to the board's face (from it towards a viewer), a little above. */
export function boardView(b: BoardLayout): Vec3 {
  return [Math.sin(b.yaw), 0.32, Math.cos(b.yaw)];
}

/** World units kept free left of the meadow in the whole view, for the names' column. */
export const CALLOUT_ROOM = 3.6;

/**
 * Points the camera keeps in view: the meadow's edge (and room for the names on its left), the
 * columns with their titles, the board.
 */
export function subjectPoints(L: LvLayout): Vec3[] {
  const out: Vec3[] = [];
  const { meadow, columns: c, board: b } = L;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = meadow.x + Math.cos(a) * meadow.r * 1.03;
    const z = meadow.z + Math.sin(a) * meadow.r * 1.03;
    out.push([x, 0, z], [x, 1.4, z]);
  }
  const top = c.plinthH + c.tubeH * 1.06 + 1.1;
  for (const dx of [-c.plinthRx, c.plinthRx])
    out.push([c.x + dx, 0, c.z], [c.x + dx * 0.7, top, c.z], [c.x + dx * 0.6, 0, c.z + c.plinthRz]);
  // The x* tag left of the prey tube (the y* tag stands between the plinth and the board), and
  // the plaques hanging under the plinth's front.
  out.push([c.x - c.plinthRx - 1.6, c.plinthH + c.tubeH * 0.5, c.z]);
  out.push([c.x, 0, c.z + c.plinthRz + 3]);
  const L0 = b.lift / Math.cos(b.lean);
  // Room left of the meadow for the name callouts' column (they never cover the animals).
  out.push([meadow.x - meadow.r - CALLOUT_ROOM, 0.7, meadow.z]);
  for (const s of [-b.width / 2, b.width / 2])
    out.push(boardPoint(b, s, -L0), boardPoint(b, s, b.height + 1));
  return out;
}

/** The view's default direction (from the subject towards the camera): about 28° above it. */
export const LV_VIEW: Vec3 = [0.12, 0.55, 1];
/** "Cận cảnh đàn" and the columns' close-up: lower and nearer. */
export const LV_CLOSE_VIEW: Vec3 = [0.22, 0.28, 1];
/** A picked animal: from higher up, so the animals in front never hide it. */
export const LV_PICK_VIEW: Vec3 = [0.16, 0.9, 1];

/** Points of a strip of the ground (ground and figure height) from z0 to z1, half-width w. */
function strip(cx: number, cz: number, z0: number, z1: number, w: number): Vec3[] {
  const out: Vec3[] = [];
  for (const z of [z0, (z0 + z1) / 2, z1])
    for (const x of [-w, 0, w]) out.push([cx + x, 0, cz + z], [cx + x, 1.4, cz + z]);
  return out;
}

/**
 * "Cận cảnh đàn": the strip of the meadow from just behind its centre, where the first animals of
 * both species stand (so the close-up is never empty), to its front edge.
 */
export function closeupPoints(L: LvLayout): Vec3[] {
  const r = L.meadow.r;
  return strip(L.meadow.x, L.meadow.z, -0.15 * r, r * 1.03, Math.max(2.4, r * 0.4));
}

/** A picked animal's close-up: its slot and the neighbours about two figures away. */
export function figurePoints(L: LvLayout, kind: 'prey' | 'predator', slot: number): Vec3[] {
  const s = (kind === 'prey' ? L.prey : L.predators)[slot];
  if (!s) return [];
  const r = FIGURE_SPACING * 2.2;
  return strip(s.x, s.z, -r, r, r);
}

/**
 * The columns' close-up: the plinth, both tubes with their titles, the tags either side and the
 * plaques under the plinth's front.
 */
export function columnsPoints(L: LvLayout): Vec3[] {
  const c = L.columns;
  const top = c.plinthH + c.tubeH * 1.06 + 1.6;
  const out: Vec3[] = [];
  for (const x of [c.x - c.plinthRx - 2.6, c.x, c.x + c.plinthRx + 2.6])
    out.push([x, 0, c.z + c.plinthRz + 1.6], [x, top, c.z], [x, 0, c.z - c.plinthRz]);
  return out;
}

/** The board's close-up: its panel with the title above and the posts' feet. */
export function boardPoints(L: LvLayout): Vec3[] {
  const b = L.board;
  const out: Vec3[] = [];
  for (const s of [-b.width / 2 - 0.4, 0, b.width / 2 + 0.4])
    out.push(boardPoint(b, s, -0.3), boardPoint(b, s, b.height + 1.2));
  return out;
}
