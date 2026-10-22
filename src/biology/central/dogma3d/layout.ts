/**
 * Where things go in the 3D view of "ADN → mARN → Protein" (pure maths, no three.js). The helix
 * follows the B-DNA proportions of `bdna.ts`; everything else — how wide the bubble opens, where
 * the mRNA, the ribosome, the tRNAs and the chain sit, how they move — is illustration
 * (DATA_REVIEW DOG3D-6). Positions are written into `out` vectors: nothing is allocated per frame.
 *
 * Axes: the DNA runs along +x (base pair i at x = i · 0,34 nm, coding strand 5′ → 3′ left to
 * right), y is up. The open strands, the mRNA and the translation machinery are drawn below the
 * helix so the mRNA lines up under the DNA it was copied from.
 */
import { RADIUS, RISE, TWIST } from './bdna';
import { STEP, type DogmaModel3D, type DogmaMoment } from './binding';

export type Vec3 = [number, number, number];

/** Illustrative layout (scene units; the helix itself is 1 unit = 1 nm). */
export const LAYOUT = {
  /** RNA–DNA hybrid behind the active site (bases). */
  hybrid: 8,
  /** Open bases upstream of the hybrid and downstream of the active site. */
  behind: 1,
  ahead: 3,
  /** Width (bases) of the edges where the helix unwinds and winds up again. */
  edge: 2.5,
  /** The open strands: coding strand above, template strand below with its bases facing down. */
  codingOpenY: 2,
  templateOpenY: -1,
  /** Length of an unpaired base (a half rung). */
  stick: 0.8,
  /** mRNA backbone while paired with the template, then on its line under the DNA. */
  mrnaHybridY: -2.6,
  mrnaLineY: -3.4,
  /** Bases over which the new mRNA leaves the template. */
  exit: 5,
  /** tRNA (local to the codon's middle base on the mRNA line). */
  trnaArmY: -1.62,
  trnaBodyBottom: -3.4,
  trnaAcceptorY: -3.8,
  /** Ruler of positions above the helix. */
  rulerY: 2.75,
} as const;

/** x of base pair i (absolute index). */
export const xOf = (i: number): number => i * RISE;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** First and last fully open base (continuous) of the bubble, from the polymerase position. */
export function bubbleSpan(mo: DogmaMoment): { lo: number; hi: number } {
  // Once the polymerase lets go, the bubble closes (and the DNA rests) where transcription ended.
  const k = mo.phase === 'transcription' ? mo.polymerase : mo.made;
  return { lo: k - LAYOUT.hybrid - LAYOUT.behind, hi: k + LAYOUT.ahead };
}

/** How open base pair i is (0 helix … 1 flat and apart). */
export function opening(i: number, mo: DogmaMoment): number {
  if (mo.bubble <= 0) return 0;
  const { lo, hi } = bubbleSpan(mo);
  const e = LAYOUT.edge;
  let o: number;
  if (i < lo) o = 1 - (lo - i) / e;
  else if (i > hi) o = 1 - (i - hi) / e;
  else o = 1;
  return clamp01(o) * mo.bubble;
}

/** ∫ of the bubble's opening profile (before `bubble` scales it) from −∞ to x. */
function openArea(x: number, lo: number, hi: number): number {
  const e = LAYOUT.edge;
  if (x <= lo - e) return 0;
  if (x <= lo) return (x - lo + e) ** 2 / (2 * e);
  if (x <= hi) return e / 2 + (x - lo);
  if (x <= hi + e) {
    const d = x - hi;
    return e / 2 + (hi - lo) + d - (d * d) / (2 * e);
  }
  return e + (hi - lo);
}

/**
 * Angle of base pair i around the axis (coding strand; the template strand is opposite). The
 * helix turns 36° per base pair; where it is open it does not turn at all, so the open stretch
 * lies flat (coding strand up) and the edges unwind smoothly — no pair ever jumps. The picture
 * keeps the polymerase still: the DNA on both sides turns about its axis as the bubble moves
 * along it (illustrative motion, DATA_REVIEW DOG3D-6), and rests once transcription is over.
 */
export function helixAngle(i: number, mo: DogmaMoment): number {
  const { lo, hi } = bubbleSpan(mo);
  const open = mo.bubble > 0 ? mo.bubble * openArea(i, lo, hi) : 0;
  // The fully open stretch is at angle 0: subtract the turn the helix had reached at `lo`.
  return TWIST * (i - open - (lo - LAYOUT.edge / 2));
}

/**
 * The parts of the helix that turn as one rigid piece at a moment (the backbone tubes are drawn
 * once at rest and turned): every base pair i ≤ `left` sits where the resting helix (pair i at
 * angle TWIST · i, closed) puts it, turned by `leftTurn` about the axis; every pair i ≥ `right`
 * likewise by `rightTurn`. The pairs between move on their own (the bubble and its edges).
 * Without a bubble the whole helix is one piece (`left` = +∞).
 */
export interface RigidSpan {
  left: number;
  right: number;
  leftTurn: number;
  rightTurn: number;
}

export function rigidSpan(mo: DogmaMoment, out: RigidSpan): RigidSpan {
  const { lo, hi } = bubbleSpan(mo);
  if (mo.bubble <= 0) {
    out.left = Infinity;
    out.right = Infinity;
    out.leftTurn = helixAngle(0, mo);
    out.rightTurn = out.leftTurn;
    return out;
  }
  out.left = Math.floor(lo - LAYOUT.edge);
  out.right = Math.ceil(hi + LAYOUT.edge);
  out.leftTurn = helixAngle(out.left, mo) - TWIST * out.left;
  out.rightTurn = helixAngle(out.right, mo) - TWIST * out.right;
  return out;
}

/**
 * The DNA steps back while the ribosome works (illustration, DATA_REVIEW DOG3D-11): smaller,
 * higher and further back, so the ribosome holds the middle of the picture and the DNA stays in
 * view as context above it. Scaled about the left end of the drawn stretch.
 */
export const CONTEXT = { scale: 0.5, up: -0.35, back: -1.8 } as const;

/** 0 … 1: how far the DNA has stepped back (over the first codon's arrival; 0 before). */
export function recede(mo: DogmaMoment): number {
  if (mo.phase !== 'translation') return 0;
  if (mo.step > 0) return 1;
  return smooth(mo.f / STEP.ARRIVE);
}

/** Where the DNA is drawn: world = (x0 + (x − x0) · k, y · k + dy, z · k + dz). */
export interface DnaPlace {
  k: number;
  x0: number;
  dy: number;
  dz: number;
}

export function dnaPlace(mo: DogmaMoment, x0: number, out: DnaPlace): DnaPlace {
  const r = recede(mo);
  out.k = 1 - (1 - CONTEXT.scale) * r;
  out.x0 = x0;
  out.dy = CONTEXT.up * r;
  out.dz = CONTEXT.back * r;
  return out;
}

/** A DNA point (layout coordinates) where it is drawn now (in place). */
export function placeDna(p: DnaPlace, v: Vec3): Vec3 {
  v[0] = p.x0 + (v[0] - p.x0) * p.k;
  v[1] = v[1] * p.k + p.dy;
  v[2] = v[2] * p.k + p.dz;
  return v;
}

/**
 * The k-th free nucleotide on its way to the active site (k = 0 is the next one; illustration of
 * the order only, DATA_REVIEW DOG3D-12): it reaches the site just as the polymerase adds it.
 * Returns how far it still is (in steps, > 0), or 0 when it is not drawn.
 */
export function nucleotidePose(mo: DogmaMoment, k: number, out: Vec3): number {
  if (mo.phase !== 'transcription' || mo.bubble <= 0) return 0;
  const j = mo.made + k;
  const d = k + 1 - (mo.polymerase - mo.made);
  if (d <= 0 || d > 3) return 0;
  const x = xOf(j);
  const y = LAYOUT.mrnaHybridY + LAYOUT.stick * 0.35;
  setVec(out, x + 0.22 * d, y - 0.3 * d, 0.7 * d);
  return d;
}

function setVec(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Backbone point and base tip of one strand at base pair i: at angle `ang` (the template strand
 * opposite), opened by `e`. In the helix (e = 0) both tips meet on the axis (the pair); opening
 * moves the strands apart — coding strand up, template strand down with its bases turned over
 * to face the mRNA below.
 */
export function strandPose(
  i: number,
  strand: 'coding' | 'template',
  e: number,
  ang: number,
  back: Vec3,
  tip: Vec3,
): void {
  const x = xOf(i);
  const s = smooth(e);
  const a = ang + (strand === 'template' ? Math.PI : 0);
  const rEnd = strand === 'coding' ? LAYOUT.codingOpenY : -LAYOUT.templateOpenY;
  const r = lerp(RADIUS, rEnd, s);
  setVec(back, x, r * Math.cos(a), r * Math.sin(a));
  // Coding bases keep pointing at the axis; template bases turn over to face down.
  const dir = a + Math.PI + (strand === 'template' ? s * Math.PI : 0);
  const len = lerp(RADIUS, LAYOUT.stick, s);
  setVec(tip, x, back[1] + len * Math.cos(dir), back[2] + len * Math.sin(dir));
}

/** `strandPose` of base pair i at a moment; returns how open it is. */
export function dnaPose(
  i: number,
  strand: 'coding' | 'template',
  mo: DogmaMoment,
  back: Vec3,
  tip: Vec3,
): number {
  const e = opening(i, mo);
  strandPose(i, strand, e, helixAngle(i, mo), back, tip);
  return e;
}

/**
 * Backbone point and base tip of mRNA base j at a moment, or false when it is not made yet. Paired
 * with the template inside the bubble (bases up), it then leaves for its line under the DNA,
 * turning its bases down (towards the ribosome and the tRNAs).
 */
export function mrnaPose(j: number, mo: DogmaMoment, back: Vec3, tip: Vec3): boolean {
  if (j >= mo.made) return false;
  let s = 1;
  if (mo.phase !== 'translation') {
    const lead = mo.polymerase - LAYOUT.hybrid + mo.release * (LAYOUT.hybrid + LAYOUT.exit + 2);
    s = clamp01((lead - j) / LAYOUT.exit);
  }
  const u = smooth(s);
  const x = xOf(j);
  setVec(back, x, lerp(LAYOUT.mrnaHybridY, LAYOUT.mrnaLineY, u), 0.6 * Math.sin(Math.PI * u));
  const dir = u * Math.PI;
  setVec(tip, x, back[1] + LAYOUT.stick * Math.cos(dir), back[2] + LAYOUT.stick * Math.sin(dir));
  return true;
}

// ─── Translation ─────────────────────────────────────────────────────────────────────────────

/** x of the middle base of codon c (codon −1: the three bases before the first one). */
export function codonX(m: DogmaModel3D, c: number): number {
  const first = m.t.codons[0];
  if (!first) return 0;
  const pos = m.t.codons[c]?.pos ?? first.pos + 3 * c;
  return xOf(pos + 1);
}

export interface RibosomePose {
  /** Centre x (between the codon being read and the one before it). */
  x: number;
  /** 0 … 1 (assembles on the first codon, falls apart after the stop codon). */
  opacity: number;
  /** Subunits move apart after a stop codon (y offsets). */
  smallLift: number;
  largeDrop: number;
}

const centreOf = (m: DogmaModel3D, s: number) => (codonX(m, s) + codonX(m, s - 1)) / 2;

export function ribosomePose(m: DogmaModel3D, mo: DogmaMoment, out: RibosomePose): RibosomePose {
  out.smallLift = 0;
  out.largeDrop = 0;
  if (mo.phase !== 'translation') {
    out.x = centreOf(m, 0);
    out.opacity = 0;
    return out;
  }
  const s = mo.step;
  const move = smooth(mo.f / STEP.MOVE);
  out.x = s === 0 ? centreOf(m, 0) : lerp(centreOf(m, s - 1), centreOf(m, s), move);
  out.opacity = s === 0 ? move : 1;
  if (s === m.t.stopIndex && mo.f > STEP.JOIN) {
    const v = smooth((mo.f - STEP.JOIN) / (1 - STEP.JOIN));
    out.opacity = 1 - 0.7 * v;
    out.smallLift = 0.9 * v;
    out.largeDrop = 1.1 * v;
  }
  return out;
}

export interface TrnaPose {
  /** Codon index the tRNA reads, or −1 when this slot is empty. */
  codon: number;
  /** Where its anticodon arm's middle is (the codon's middle base, on the mRNA line). */
  at: Vec3;
  opacity: number;
  /** It still carries its amino acid (not yet joined to the chain). */
  carries: boolean;
}

const ENTRY: Vec3 = [2.4, -4.5, 2.5];
const LEAVE: Vec3 = [-2.6, -4, 2.4];

/**
 * The (at most two) tRNAs at a moment: slot 0 reads the current codon (comes in, then stays),
 * slot 1 the codon before it (stays, then leaves). No tRNA comes for a stop codon.
 */
export function trnaPoses(m: DogmaModel3D, mo: DogmaMoment, out: [TrnaPose, TrnaPose]): void {
  const [cur, prev] = out;
  cur.codon = -1;
  prev.codon = -1;
  if (mo.phase !== 'translation') return;
  const s = mo.step;
  const y = LAYOUT.mrnaLineY;
  const c = m.t.codons[s];
  if (c && !c.entry?.stop && mo.f > STEP.MOVE) {
    const u = smooth((mo.f - STEP.MOVE) / (STEP.ARRIVE - STEP.MOVE));
    cur.codon = s;
    setVec(cur.at, codonX(m, s) + ENTRY[0] * (1 - u), y + ENTRY[1] * (1 - u), ENTRY[2] * (1 - u));
    cur.opacity = u;
    cur.carries = mo.f < STEP.ARRIVE;
  }
  const p = m.t.codons[s - 1];
  if (p && !p.entry?.stop) {
    const v = mo.f > STEP.JOIN ? smooth((mo.f - STEP.JOIN) / (1 - STEP.JOIN)) : 0;
    prev.codon = s - 1;
    setVec(prev.at, codonX(m, s - 1) + LEAVE[0] * v, y + LEAVE[1] * v, LEAVE[2] * v);
    prev.opacity = 1 - v;
    prev.carries = false;
    if (v >= 1) prev.codon = -1;
  }
}

/** Where a docked tRNA holds its amino acid (the chain's newest bead). */
export function acceptorAt(m: DogmaModel3D, c: number, out: Vec3): Vec3 {
  return setVec(out, codonX(m, c), LAYOUT.mrnaLineY + LAYOUT.trnaAcceptorY, 0);
}

/**
 * Offset of the chain's k-th bead (0 = newest) from the newest one: a gentle curve down and to
 * the left, out of the large subunit (no folding).
 */
export function chainOffset(k: number, out: Vec3): Vec3 {
  if (k <= 0) return setVec(out, 0, 0, 0);
  const y = -0.4 * Math.min(k, 2) + (k > 2 ? 0.16 * Math.sin(0.85 * (k - 2)) - 0.05 * (k - 2) : 0);
  return setVec(out, -0.5 * k, y, 0.3 * Math.sin(0.7 * k));
}

const _a: Vec3 = [0, 0, 0];
const _b: Vec3 = [0, 0, 0];

/**
 * Position of the chain's bead k (0 = newest) at a moment, for a chain of the amino acids of
 * `chainAt`. While an amino acid joins, the older beads move from the previous tRNA to hang one
 * place further from the new one; after the stop codon the chain drifts away from the ribosome.
 */
export function beadPose(m: DogmaModel3D, mo: DogmaMoment, k: number, out: Vec3): Vec3 {
  const s = mo.step;
  const stop = s === m.t.stopIndex;
  const joined = mo.f >= STEP.ARRIVE && !stop;
  if (!joined) {
    // The newest bead is the previous codon's amino acid, held by the tRNA before.
    acceptorAt(m, s - 1, _a);
    chainOffset(k, _b);
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (stop && mo.f >= STEP.ARRIVE) {
      const v = smooth((mo.f - STEP.ARRIVE) / (1 - STEP.ARRIVE));
      dx = -1.6 * v;
      dy = -2.6 * v;
      dz = 1.8 * v;
    }
    return setVec(out, _a[0] + _b[0] + dx, _a[1] + _b[1] + dy, _a[2] + _b[2] + dz);
  }
  acceptorAt(m, s, _a);
  if (k === 0) return setVec(out, _a[0], _a[1], _a[2]);
  // Older beads: from (previous acceptor + offset(k − 1)) to (new acceptor + offset(k)).
  const v = smooth((mo.f - STEP.ARRIVE) / (STEP.JOIN - STEP.ARRIVE));
  chainOffset(k, _b);
  const toX = _a[0] + _b[0];
  const toY = _a[1] + _b[1];
  const toZ = _a[2] + _b[2];
  acceptorAt(m, s - 1, _a);
  chainOffset(k - 1, _b);
  return setVec(
    out,
    lerp(_a[0] + _b[0], toX, v),
    lerp(_a[1] + _b[1], toY, v),
    lerp(_a[2] + _b[2], toZ, v),
  );
}
