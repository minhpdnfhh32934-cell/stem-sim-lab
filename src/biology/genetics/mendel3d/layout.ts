/**
 * Where everything of the 3D Mendel view stands (pure maths, scene units, y up), composed as a lab
 * bench seen from the front and above, read like the 2D table: the Punnett board is a tray with
 * one recessed slot per cell (rows = the mother's gametes along z, columns = the father's along
 * x, the first row at the back like a table's top row) and two header channels where the
 * gametes rest; the mother ♀ stands on a pedestal left of it, the father ♂ behind it, the
 * phenotype cylinders stand right of it and a random draw's offspring field lies in front of it.
 *
 * Shapes, sizes and paths are illustration. The only sizes that carry a number are the liquid
 * columns in the cylinders: height = exact probability × `barH` (engraved marks at 1/4 … 1).
 */
import { easeInOut } from '@/ui/three/camera';
import { stepProgress, type ParentId } from './binding';

export type Vec3 = [number, number, number];

export const LAYOUT = {
  /** Spacing of the board's cells. */
  cell: 1.3,
  /** Half width of a cell's slot in the tray (the walls between slots fill the rest). */
  slotHalf: 0.55,
  /** Half width of the pad at the bottom of a slot (picked as the cell). */
  tileHalf: 0.5,
  /** Top of the tray's floor (the slots' and channels' bottom). */
  floorY: 0.05,
  /** Height of a pad's top face (tokens stand on it). */
  tileTop: 0.1,
  /** Height of the tray's walls above the floor. */
  wallH: 0.26,
  /** Tray rim beyond the outermost slot or channel. */
  trayRim: 0.28,
  tokenR: 0.34,
  gameteR: 0.42,
  /** Gametes rest on the channel floor. */
  gameteY: 0.47,
  /** Board edge → the gametes' centres (the header channels). */
  headerGap: 1.02,
  /** Half width of a header channel. */
  channelHalf: 0.5,
  parentR: 1.35,
  /** Parents rest on a low pedestal. */
  pedestalH: 0.3,
  pedestalR: 1.05,
  parentY: 1.65,
  /** Board edge → the father's centre (behind the board). */
  parentGap: 3.45,
  /** Board edge → the mother's centre (left of it; room for her gametes' tags). */
  motherGap: 4.75,
  /** Board's right edge → the first cylinder's centre. */
  pedestalGap: 2.35,
  pedestalStep: 1.25,
  /** Radius of a cylinder's liquid column. */
  barHalf: 0.32,
  /** Inner and outer radius of a cylinder's glass wall. */
  tubeIn: 0.345,
  tubeOut: 0.4,
  /** Height of the liquid for probability 1. */
  barH: 4.4,
  /** The cylinder's foot: the liquid starts on it. */
  plinthH: 0.14,
  /** Glass above the mark "1". */
  tubeHead: 0.32,
  /** Board's front edge → the first row of the offspring field. */
  fieldGap: 1.55,
  fieldStep: 0.3,
  fieldR: 0.11,
  /** Gamete copies travelling to the cells at fertilisation. */
  copyR: 0.18,
  rodR: 0.085,
  /** Chromosome lengths, one per pair (illustration: tells the pairs apart). */
  rodLengths: [1.3, 1.0, 0.8],
  /** Distance between two chromosome pairs in a parent. */
  pairSpacing: 0.62,
  /** Half distance between the homologues of a pair: paired, then separated. */
  pairedGap: 0.11,
  apartGap: 0.5,
  markerR: 0.13,
  /** Size of a gamete's chromosomes relative to the parent's. */
  gameteScale: 0.36,
  /** Offspring tokens drop into their slots from this height (illustration). */
  dropH: 0.9,
} as const;

/** In front of the cylinders: the class tokens, then the class keys (a second row up to KEYS_FRONT). */
export const CLASS_TOKEN_Z = LAYOUT.tubeOut + 0.5;
export const CLASS_KEY_Z = CLASS_TOKEN_Z + 0.62;
export const KEYS_FRONT = CLASS_KEY_Z + 1.3;

/** Marks engraved on every cylinder: probability 1/4, 1/2, 3/4 and 1. */
export const QUARTERS = [0.25, 0.5, 0.75, 1] as const;

export interface BoardDims {
  rows: number;
  cols: number;
  loci: number;
  classes: number;
}

const L = LAYOUT;

export function half(d: BoardDims): { x: number; z: number } {
  return { x: (d.cols * L.cell) / 2, z: (d.rows * L.cell) / 2 };
}

const colX = (d: BoardDims, j: number) => (j - (d.cols - 1) / 2) * L.cell;
const rowZ = (d: BoardDims, i: number) => (i - (d.rows - 1) / 2) * L.cell;

/** Centre of a cell's top face. */
export function cellPoint(d: BoardDims, row: number, col: number, out: Vec3): Vec3 {
  out[0] = colX(d, col);
  out[1] = L.tileTop;
  out[2] = rowZ(d, row);
  return out;
}

/** Where gamete k of a parent settles: the mother's along the left edge, the father's behind. */
export function gameteSlot(d: BoardDims, parent: ParentId, k: number, out: Vec3): Vec3 {
  const h = half(d);
  if (parent === 0) {
    out[0] = -h.x - L.headerGap;
    out[2] = rowZ(d, k);
  } else {
    out[0] = colX(d, k);
    out[2] = -h.z - L.headerGap;
  }
  out[1] = L.gameteY;
  return out;
}

export function parentCenter(d: BoardDims, parent: ParentId, out: Vec3): Vec3 {
  const h = half(d);
  out[0] = parent === 0 ? -h.x - L.motherGap : 0;
  out[1] = L.parentY;
  out[2] = parent === 0 ? 0 : -h.z - L.parentGap;
  return out;
}

/** x of phenotype class k's pedestal (all stand at z = 0, beside the board). */
export function pedestalX(d: BoardDims, k: number): number {
  return half(d).x + L.pedestalGap + k * L.pedestalStep;
}

/** A bar's full height: the class's exact probability × `barH`. */
export function barHeight(p: number): number {
  return Math.max(0, Math.min(1, p)) * L.barH;
}

/** Columns of the offspring field for `total` figures (about twice as wide as deep). */
export function fieldCols(total: number): number {
  return Math.max(8, Math.min(28, Math.ceil(Math.sqrt(2 * Math.max(1, total)))));
}

/** Rows of the offspring field for `total` figures. */
export function fieldRows(total: number): number {
  return Math.ceil(Math.max(0, total) / fieldCols(total));
}

/** Centre of figure k of the offspring field (figures run row by row, class after class). */
export function fieldSlot(d: BoardDims, total: number, k: number, out: Vec3): Vec3 {
  const g = fieldCols(total);
  const col = k % g;
  const row = Math.floor(k / g);
  out[0] = (col - (g - 1) / 2) * L.fieldStep;
  out[1] = L.fieldR;
  out[2] = half(d).z + L.fieldGap + row * L.fieldStep;
  return out;
}

/** Length of chromosome pair `locus` (cycling past the table). */
export function rodLength(locus: number): number {
  return L.rodLengths[locus % L.rodLengths.length] ?? 1;
}

/**
 * Centre of a homologue in a parent, relative to the parent's centre: the pairs side by side
 * along x, the two homologues of a pair along z, `apart` (0 … 1) from paired to separated.
 */
export function homologueOffset(
  d: BoardDims,
  locus: number,
  side: 0 | 1,
  apart: number,
  out: Vec3,
): Vec3 {
  const gap = L.pairedGap + (L.apartGap - L.pairedGap) * apart;
  out[0] = (locus - (d.loci - 1) / 2) * L.pairSpacing;
  out[1] = 0;
  out[2] = side === 0 ? -gap : gap;
  return out;
}

/** Centre of a gamete's chromosome `locus`, relative to the gamete's centre (unscaled). */
export function gameteRodOffset(d: BoardDims, locus: number, out: Vec3): Vec3 {
  out[0] = (locus - (d.loci - 1) / 2) * L.pairSpacing * L.gameteScale * 1.2;
  out[1] = 0;
  out[2] = 0;
  return out;
}

/** Height of an allele's band on its chromosome, relative to the chromosome's centre. */
export function markerLift(locus: number): number {
  return rodLength(locus) * 0.22;
}

/** The illustrative motion of the four steps at time t (shares 0 … 1, eased). */
export interface Motion {
  /** Step 1: the homologues of each pair move apart. */
  apart: number;
  /** Step 2: the gametes leave the parents for their places along the board. */
  emerge: number;
  /** Step 3: copies of the gametes travel to the cells… */
  travel: number;
  /** …and the offspring appear where they meet. */
  grow: number;
  /** Step 4: the bars rise to their probabilities; the random offspring appear. */
  rise: number;
}

/** The motion at time t, written into `out` (no allocation). */
export function motionAt(t: number, out: Motion): Motion {
  const u2 = stepProgress(t, 2);
  out.apart = easeInOut(stepProgress(t, 0));
  out.emerge = easeInOut(stepProgress(t, 1));
  out.travel = easeInOut(u2 / 0.7);
  out.grow = easeInOut((u2 - 0.55) / 0.45);
  out.rise = easeInOut(stepProgress(t, 3));
  return out;
}

export function lerp3(a: Vec3, b: Vec3, u: number, out: Vec3): Vec3 {
  out[0] = a[0] + (b[0] - a[0]) * u;
  out[1] = a[1] + (b[1] - a[1]) * u;
  out[2] = a[2] + (b[2] - a[2]) * u;
  return out;
}

/** The tray's outline on the floor (absolute): left, right, back and front edges. */
export function trayEdges(d: BoardDims): { x0: number; x1: number; z0: number; z1: number } {
  const h = half(d);
  // The outermost slot's outer edge lies (cell / 2 − slotHalf) inside the board's half size.
  const inner = L.cell / 2 - L.slotHalf;
  const header = L.headerGap + L.channelHalf + L.trayRim;
  return {
    x0: -h.x - header,
    x1: h.x - inner + L.trayRim,
    z0: -h.z - header,
    z1: h.z - inner + L.trayRim,
  };
}

/** Top of a cylinder's glass (probability 1 plus some head room). */
export function tubeTop(): number {
  return L.plinthH + L.barH + L.tubeHead;
}

/** x of the gutter left of the cylinders, where the marks' numbers stand. */
export function gutterX(d: BoardDims): number {
  return pedestalX(d, 0) - L.tubeOut - 0.42;
}

/**
 * Points the overview camera must show (absolute): the floor's footprint (parents, gametes,
 * tray, cylinders, a draw's field) and the tall things — the parents with their genotypes and
 * the cylinders up to the mark "1". Only real outlines, so the picture fills the view.
 */
export function overviewPoints(d: BoardDims, fieldTotal: number): Vec3[] {
  const h = half(d);
  const tray = trayEdges(d);
  const x0 = gutterX(d) - 0.25;
  const x1 = pedestalX(d, Math.max(0, d.classes - 1)) + L.tubeOut + 0.2;
  const fieldHalf = fieldTotal > 0 ? (fieldCols(fieldTotal) * L.fieldStep) / 2 : 0;
  const front = Math.max(
    KEYS_FRONT,
    fieldTotal > 0 ? h.z + L.fieldGap + fieldRows(fieldTotal) * L.fieldStep : tray.z1 + 0.2,
  );
  const left = Math.min(-h.x - L.motherGap - L.parentR, tray.x0, -fieldHalf);
  // Room right of the cylinders for their name label.
  const right = Math.max(x1 + 1.2, fieldHalf);
  const back = -h.z - L.parentGap - L.parentR;
  const top = tubeTop() + 0.2;
  const out: Vec3[] = [
    [left, 0, back],
    [right, 0, back],
    [left, 0, front],
    [right, 0, front],
    // The cylinders and the marks' numbers, up to probability 1.
    [x0, top, 0],
    [x1, top, 0],
  ];
  const c: Vec3 = [0, 0, 0];
  for (const p of [0, 1] as const) {
    parentCenter(d, p, c);
    // The parent's top with its genotype above it.
    out.push([c[0], c[1] + L.parentR + 0.5, c[2]]);
  }
  return out;
}

/**
 * Points of the parents (on their pedestals, with their genotypes) and the tray with its header
 * channels: what meiosis and the gametes' step show (the cylinders and a draw come later).
 */
export function parentsPoints(d: BoardDims): Vec3[] {
  const tray = trayEdges(d);
  const out: Vec3[] = [
    [tray.x0 - 0.6, 0, tray.z0],
    [tray.x1, 0, tray.z0],
    [tray.x0 - 0.6, 0, tray.z1],
    [tray.x1, 0, tray.z1],
  ];
  const c: Vec3 = [0, 0, 0];
  for (const p of [0, 1] as const) {
    parentCenter(d, p, c);
    out.push([c[0] - L.parentR, 0, c[2] - L.parentR], [c[0] + L.parentR, 0, c[2] + L.parentR]);
    out.push([c[0], c[1] + L.parentR + 0.5, c[2]]);
  }
  return out;
}

/**
 * Points of the tray with both header channels and their tags ("Bảng Punnett"): room on the left
 * for the mother's gamete tags, above the back channel for the father's.
 */
export function boardPoints(d: BoardDims): Vec3[] {
  const tray = trayEdges(d);
  const top = L.gameteY + L.gameteR + 0.95;
  const left = tray.x0 - 1.7;
  return [
    [left, 0, tray.z0],
    [tray.x1, 0, tray.z0],
    [left, 0, tray.z1],
    [tray.x1, 0, tray.z1],
    [tray.x0, top, tray.z0],
    [tray.x1, top, tray.z0],
    [tray.x0, top, tray.z1],
  ];
}
