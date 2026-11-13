import { z } from 'zod';
import type { Part } from '../../simulation/circuitSolver';
import type { ItemDefinition } from '../item';

export type BoardSpec = NonNullable<ItemDefinition['circuitBoard']>;
export type PartSpec = NonNullable<ItemDefinition['circuit']>;

/**
 * A circuit board's layout, in its own frame (x across, z towards the front, the holes on its top
 * face): `cols` × `rows` holes, numbered row by row, then the supply's + and − posts. A part sits
 * on an edge between two neighbouring holes: the horizontal edges first (row by row), then the
 * vertical ones.
 */
export const holeCount = (b: BoardSpec) => b.cols * b.rows;
export const nodeCount = (b: BoardSpec) => holeCount(b) + 2;
export const plusPost = (b: BoardSpec) => holeCount(b);
export const minusPost = (b: BoardSpec) => holeCount(b) + 1;
const horizontal = (b: BoardSpec) => (b.cols - 1) * b.rows;
export const edgeCount = (b: BoardSpec) => horizontal(b) + b.cols * (b.rows - 1);

/** Where node `n` is on the board's top face: [x, z]. */
export function nodeAt(b: BoardSpec, n: number): [number, number] {
  if (n === plusPost(b)) return [...b.posts[0]];
  if (n === minusPost(b)) return [...b.posts[1]];
  const c = n % b.cols;
  const r = Math.floor(n / b.cols);
  return [
    b.gridAt[0] + (c - (b.cols - 1) / 2) * b.pitch,
    b.gridAt[1] + (r - (b.rows - 1) / 2) * b.pitch,
  ];
}

/** The two holes of edge `e`, the lower-numbered first. */
export function edgeNodes(b: BoardSpec, e: number): [number, number] {
  const h = horizontal(b);
  if (e < h) {
    const r = Math.floor(e / (b.cols - 1));
    const c = e % (b.cols - 1);
    return [r * b.cols + c, r * b.cols + c + 1];
  }
  const n = e - h;
  return [n, n + b.cols];
}

/** What a saved board holds: its parts (by entity id), its leads, and its supply's setting. */
const MountedSchema = z.object({
  id: z.string().min(1),
  item: z.string().min(1),
  edge: z.number().int().nonnegative(),
  /** Its `a` (+) terminal at the higher-numbered hole. */
  flip: z.boolean(),
  /** A switch: 1 closed · a rheostat: the share of its track in the circuit (0…1) · else 0. */
  setting: z.number().min(0).max(1),
  /** Damaged (Phase E-2): burnt, melted or blown open — it carries nothing. */
  broken: z.boolean().default(false),
});
export const BoardStateSchema = z.object({
  parts: z.array(MountedSchema),
  wires: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
  volts: z.number().nonnegative(),
  /** The board itself burnt (Phase E-2): its supply dead, until it is replaced. */
  burnt: z.boolean().default(false),
});
export type MountedPart = z.infer<typeof MountedSchema>;
export type BoardState = z.infer<typeof BoardStateSchema>;

export const emptyBoard = (): BoardState => ({ parts: [], wires: [], volts: 0, burnt: false });

/** A saved board checked against its layout: anything that does not fit it is left out. */
export function readBoard(b: BoardSpec, raw: unknown): BoardState {
  if (typeof raw !== 'string') return emptyBoard();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyBoard();
  }
  const result = BoardStateSchema.safeParse(parsed);
  if (!result.success) return emptyBoard();
  const state = result.data;
  const used = new Set<number>();
  state.parts = state.parts.filter((p) => {
    if (p.edge >= edgeCount(b) || used.has(p.edge)) return false;
    used.add(p.edge);
    return true;
  });
  state.wires = state.wires.filter(([m, n]) => m !== n && m < nodeCount(b) && n < nodeCount(b));
  state.volts = Math.min(state.volts, b.maxVolts);
  return state;
}

/** The ends of a mounted part: [a (+), b]. */
export function partNodes(b: BoardSpec, p: MountedPart): [number, number] {
  const [low, high] = edgeNodes(b, p.edge);
  return p.flip ? [high, low] : [low, high];
}

/** A lead's resistance (Ω): ~30 cm of 0.5 mm² copper and its two plugs. */
export const LEAD_OHMS = 0.02;
/** A closed switch's contact resistance (Ω). */
export const SWITCH_OHMS = 0.005;
/** A rheostat's least resistance (Ω): its slider at the end of the track. */
export const RHEOSTAT_MIN_OHMS = 0.05;
/** The supply's output resistance in its voltage mode (Ω). */
export const SUPPLY_OHMS = 0.01;
/** A digital voltmeter's input resistance (Ω). */
export const VOLTMETER_OHMS = 1e7;

/** What a solver part stands for: the supply, a lead (by index) or a mounted part (by index). */
export type Origin =
  { kind: 'supply' } | { kind: 'wire'; index: number } | { kind: 'part'; index: number };

/** The circuit a board makes: the solver's parts, each with where it came from. */
export function netlist(
  b: BoardSpec,
  state: BoardState,
  specOf: (itemId: string) => PartSpec | undefined,
): { parts: Part[]; origins: Origin[] } {
  const parts: Part[] = [];
  const origins: Origin[] = [];
  parts.push({
    kind: 'source',
    a: plusPost(b),
    b: minusPost(b),
    volts: state.burnt ? 0 : state.volts,
    ohms: SUPPLY_OHMS,
    limit: b.limit,
  });
  origins.push({ kind: 'supply' });
  state.wires.forEach(([m, n], index) => {
    parts.push({ kind: 'resistor', a: m, b: n, ohms: LEAD_OHMS });
    origins.push({ kind: 'wire', index });
  });
  state.parts.forEach((mounted, index) => {
    const spec = specOf(mounted.item);
    if (!spec || mounted.broken) return;
    const part = solverPart(spec, mounted.setting, ...partNodes(b, mounted));
    if (!part) return;
    parts.push(part);
    origins.push({ kind: 'part', index });
  });
  return { parts, origins };
}

/** What a part is in the circuit, its `a` terminal at `a`; null when it carries nothing (open). */
export function solverPart(spec: PartSpec, setting: number, a: number, b: number): Part | null {
  const ohms = spec.ohms ?? 1;
  switch (spec.kind) {
    case 'resistor':
    case 'fuse':
    case 'ammeter':
      return { kind: 'resistor', a, b, ohms };
    case 'voltmeter':
      return { kind: 'resistor', a, b, ohms: spec.ohms ?? VOLTMETER_OHMS };
    case 'lamp':
      return { kind: 'lamp', a, b, volts: spec.volts ?? 1, watts: spec.watts ?? 1 };
    case 'cell':
      return { kind: 'source', a, b, volts: spec.volts ?? 0, ohms };
    case 'switch':
      return setting >= 0.5 ? { kind: 'resistor', a, b, ohms: SWITCH_OHMS } : null;
    case 'rheostat':
      return { kind: 'resistor', a, b, ohms: Math.max(RHEOSTAT_MIN_OHMS, setting * ohms) };
  }
}

/** What the aim is on, on a board's top face. */
export type Spot =
  | { readonly kind: 'node'; readonly node: number }
  | { readonly kind: 'part'; readonly index: number }
  | { readonly kind: 'edge'; readonly edge: number }
  | { readonly kind: 'panel' };

/** How near (m) a hole's centre the aim must be to take it. */
const HOLE_REACH = 0.02;
/** A part's body across its edge, as a share of the pitch, each side. */
const PART_ACROSS = 0.3;
/** How high (m) over the board a part is aimed at: about the top of a low part. */
export const PART_AIM_HEIGHT = 0.03;
/** A spot as one number (none: -1), so the aim can be followed every frame without allocating. */
export type SpotCode = number;
const NODE = 1;
const EDGE = 1001;
const PART = 2001;

/** The spot a code stands for. */
export function spotOf(code: SpotCode): Spot | null {
  if (code < 0) return null;
  if (code === 0) return { kind: 'panel' };
  if (code < EDGE) return { kind: 'node', node: code - NODE };
  if (code < PART) return { kind: 'edge', edge: code - EDGE };
  return { kind: 'part', index: code - PART };
}

/**
 * The spot aimed at: a mounted part whose body is at (px, pz) — where the view crosses the height
 * of the parts' tops — else, on the board's top face at (x, z), the supply's panel, a node (hole
 * or post) close to it, or (`edges`: something to plug in is held) the nearest edge. A part's
 * ends leave its holes to be aimed at (a lead to a socket a part is in).
 */
export function spotAt(
  b: BoardSpec,
  state: BoardState,
  x: number,
  z: number,
  edges: boolean,
  px = x,
  pz = z,
): SpotCode {
  if (!edges) {
    for (let i = 0; i < state.parts.length; i++) {
      const [m, n] = edgeNodes(b, state.parts[i]?.edge ?? 0);
      const [ax, az] = nodeAt(b, m);
      const [bx, bz] = nodeAt(b, n);
      const along = ax === bx ? Math.abs(pz - (az + bz) / 2) : Math.abs(px - (ax + bx) / 2);
      const across = ax === bx ? Math.abs(px - ax) : Math.abs(pz - az);
      if (along <= b.pitch / 2 - HOLE_REACH && across <= b.pitch * PART_ACROSS) return PART + i;
    }
  }
  const [x0, z0, x1, z1] = b.panel;
  if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return 0;
  let best = -1;
  let bestDistance = HOLE_REACH;
  for (let n = 0; n < nodeCount(b); n++) {
    const [nx, nz] = nodeAt(b, n);
    const d = Math.hypot(nx - x, nz - z);
    if (d < bestDistance) {
      best = n;
      bestDistance = d;
    }
  }
  if (best >= 0 && !edges) return NODE + best;
  if (!edges) return -1;
  let edge = -1;
  let edgeDistance = Infinity;
  for (let e = 0; e < edgeCount(b); e++) {
    const [m, n] = edgeNodes(b, e);
    const [ax, az] = nodeAt(b, m);
    const [bx, bz] = nodeAt(b, n);
    const along = ax === bx ? Math.abs(z - (az + bz) / 2) : Math.abs(x - (ax + bx) / 2);
    const across = ax === bx ? Math.abs(x - ax) : Math.abs(z - az);
    if (along > b.pitch / 2 || across > b.pitch / 2) continue;
    const d = Math.hypot(along, across);
    if (d < edgeDistance) {
      edge = e;
      edgeDistance = d;
    }
  }
  return edge < 0 ? -1 : EDGE + edge;
}
