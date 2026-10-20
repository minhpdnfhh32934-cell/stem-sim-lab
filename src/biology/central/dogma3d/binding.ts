/**
 * What the 3D view of "ADN → mARN → Protein" shows at each moment, read from the lesson's own
 * model (pure: no three.js, no DOM). Every base, codon, anticodon and amino acid comes from
 * `parseInput` → `complement` / `codingToMrna` / `translate` (standard genetic code, translation
 * from the first AUG) and `anticodon`; only the timing of the animation is illustration
 * (DATA_REVIEW DOG3D-*).
 *
 * The clock: transcription adds the mRNA bases one by one (positions 0 … mRNA length), the
 * polymerase lets go, then translation reads one codon per step — the 2D view's `step`, so both
 * views stay on the same codon when the learner switches.
 */
import {
  anticodon,
  codingToMrna,
  complement,
  translate,
  type Codon,
  type CodonEntry,
  type Translation,
} from '../dogma';

export interface DogmaModel3D {
  /** Coding strand, 5′→3′ (the lesson's `parseInput`). */
  coding: string;
  /** Template strand, 3′→5′ under the coding strand (`complement`). */
  template: string;
  /** mRNA, 5′→3′ (`codingToMrna`). */
  mrna: string;
  /** Translation from the first AUG (`translate`). */
  t: Translation;
  /** Codon index (in `t.codons`) of each mRNA position inside the reading frame, else −1. */
  codonOf: Int32Array;
}

export function dogmaModel3d(coding: string): DogmaModel3D {
  const mrna = codingToMrna(coding);
  const t = translate(mrna);
  const codonOf = new Int32Array(coding.length).fill(-1);
  for (const c of t.codons) for (let k = 0; k < 3; k++) codonOf[c.pos + k] = c.index;
  return { coding, template: complement(coding), mrna, t, codonOf };
}

/** Base pair i (0-based): the coding strand's base and its partner on the template strand. */
export function rungAt(m: DogmaModel3D, i: number): { base: string; pair: string } {
  return { base: m.coding[i] ?? '', pair: m.template[i] ?? '' };
}

/** The mRNA made when transcription has reached position k (0 … length). */
export function mrnaAt(m: DogmaModel3D, k: number): string {
  return m.mrna.slice(0, Math.max(0, Math.min(m.mrna.length, Math.floor(k))));
}

/** The codon a base of the mRNA (or of the DNA pair at the same position) belongs to. */
export function codonAt(m: DogmaModel3D, i: number): Codon | null {
  const c = m.codonOf[i] ?? -1;
  return c >= 0 ? (m.t.codons[c] ?? null) : null;
}

/** The anticodon of a codon of the reading frame, or null for a stop codon (no tRNA reads it). */
export function anticodonOf(c: Codon): string | null {
  return c.entry?.stop ? null : anticodon(c.codon);
}

/** Amino acid of a codon (dataset entry), or null for a stop codon. */
export function aminoAcidOf(c: Codon): CodonEntry | null {
  return c.entry && !c.entry.stop ? c.entry : null;
}

// ─── Clock ───────────────────────────────────────────────────────────────────────────────────

/** Illustrative timing (DATA_REVIEW DOG3D-7): seconds at 1× speed. */
export const TIMING = {
  /** Seconds per mRNA base, at most … */
  perBase: 0.3,
  /** … and about this long for the whole transcription (long sequences go faster) … */
  transcriptionMax: 24,
  /** … but never faster than this per base. */
  perBaseMin: 0.12,
  /** The polymerase lets go and the mRNA leaves the DNA. */
  release: 1.6,
  /** One codon of translation. */
  perCodon: 1.8,
} as const;

/**
 * Shares of one translation step: the ribosome moves on to the codon (0 → MOVE), the tRNA with
 * the matching anticodon comes in (→ ARRIVE), its amino acid joins the chain (→ JOIN), the
 * previous tRNA leaves (→ 1). KEY is the moment that stands for the step (the 2D view's step).
 */
export const STEP = { MOVE: 0.2, ARRIVE: 0.55, JOIN: 0.8, KEY: 0.9 } as const;

export interface DogmaClock {
  /** Base pairs (= mRNA length). */
  n: number;
  /** Codons read in translation (the 2D view's steps), 0 without an AUG. */
  steps: number;
  perBase: number;
  /** End of transcription (the last base is added). */
  txEnd: number;
  /** Start of translation (after the polymerase has let go). */
  tlStart: number;
  perCodon: number;
  total: number;
}

export function dogmaClock(m: DogmaModel3D): DogmaClock {
  const n = m.mrna.length;
  const perBase =
    n > 0
      ? Math.max(TIMING.perBaseMin, Math.min(TIMING.perBase, TIMING.transcriptionMax / n))
      : TIMING.perBase;
  const txEnd = n * perBase;
  const tlStart = txEnd + TIMING.release;
  const steps = m.t.codons.length;
  return {
    n,
    steps,
    perBase,
    txEnd,
    tlStart,
    perCodon: TIMING.perCodon,
    total: tlStart + steps * TIMING.perCodon,
  };
}

export type DogmaPhase = 'transcription' | 'release' | 'translation';

/** One moment of the run (what the scene, the caption and the part card read). */
export interface DogmaMoment {
  phase: DogmaPhase;
  /** mRNA bases made (0 … n): the transcription position. */
  made: number;
  /** Where the polymerase is, in bases (continuous; the next base it adds). */
  polymerase: number;
  /** 0 … 1: the polymerase is there (fades while it lets go). */
  polymeraseOn: number;
  /** 0 … 1: how open the transcription bubble is. */
  bubble: number;
  /** 0 … 1: the last bases of the mRNA leaving the DNA (release). */
  release: number;
  /** Translation: the codon being read (the 2D view's step); −1 before translation. */
  step: number;
  /** Progress within the step, 0 … 1. */
  f: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function momentAt(c: DogmaClock, time: number): DogmaMoment {
  const t = Math.min(c.total, Math.max(0, time));
  if (t < c.txEnd) {
    const pos = t / c.perBase;
    return {
      phase: 'transcription',
      made: Math.min(c.n, Math.floor(pos)),
      polymerase: pos,
      polymeraseOn: 1,
      bubble: 1,
      release: 0,
      step: -1,
      f: 0,
    };
  }
  if (t < c.tlStart || c.steps === 0) {
    const u = clamp01((t - c.txEnd) / (c.tlStart - c.txEnd));
    return {
      phase: 'release',
      made: c.n,
      polymerase: c.n + u * 3,
      polymeraseOn: 1 - u,
      bubble: 1 - u,
      release: u,
      step: -1,
      f: 0,
    };
  }
  const x = (t - c.tlStart) / c.perCodon;
  const step = Math.min(c.steps - 1, Math.floor(x));
  return {
    phase: 'translation',
    made: c.n,
    polymerase: c.n + 3,
    polymeraseOn: 0,
    bubble: 0,
    release: 1,
    step,
    f: clamp01(x - step),
  };
}

/** The 2D view's step at a time (0 before translation: the 2D page opens on the first codon). */
export function stepAt(c: DogmaClock, time: number): number {
  const m = momentAt(c, time);
  return m.phase === 'translation' ? m.step : 0;
}

/** The moment that stands for a step (the tRNA in place, its amino acid in the chain). */
export function keyTime(c: DogmaClock, step: number): number {
  if (c.steps === 0) return c.total;
  const s = Math.min(c.steps - 1, Math.max(0, Math.round(step)));
  return c.tlStart + (s + STEP.KEY) * c.perCodon;
}

/**
 * Time to show when the 3D view opens on a 2D step: the 3D time it had when it still shows that
 * step (the learner's place in transcription is kept), otherwise the step's key moment.
 */
export function syncedTime(c: DogmaClock, t3d: number, step: number): number {
  const t = Math.min(c.total, Math.max(0, t3d));
  if (c.steps === 0) return t;
  const s = Math.min(c.steps - 1, Math.max(0, step));
  return stepAt(c, t) === s ? t : keyTime(c, s);
}

/**
 * Moments the "previous / next step" buttons go to: the start, the finished mRNA, then each
 * codon's key moment.
 */
export function stepMoments(c: DogmaClock): number[] {
  const out = [0, c.tlStart];
  for (let s = 0; s < c.steps; s++) out.push(keyTime(c, s));
  return out;
}

/**
 * Codon indices whose amino acids are in the chain at a moment: every codon read so far, the
 * current one once its amino acid has joined (from ARRIVE), never a stop codon.
 */
export function chainAt(m: DogmaModel3D, mo: DogmaMoment): number[] {
  if (mo.phase !== 'translation') return [];
  const out: number[] = [];
  const last = mo.f >= STEP.ARRIVE ? mo.step : mo.step - 1;
  for (let i = 0; i <= last; i++) if (!m.t.codons[i]?.entry?.stop) out.push(i);
  return out;
}

/**
 * Codon index of the newest amino acid in the chain at a moment (−1 when the chain is empty).
 * The chain is codons 0 … newest (a stop codon can only be the last codon read), so it holds
 * newest + 1 amino acids — what `chainAt` lists, without allocating.
 */
export function chainNewest(m: DogmaModel3D, mo: DogmaMoment): number {
  if (mo.phase !== 'translation') return -1;
  const last = mo.f >= STEP.ARRIVE ? mo.step : mo.step - 1;
  return m.t.codons[last]?.entry?.stop ? last - 1 : last;
}

/** The chain after a step, as the 2D view shows it: codons 0 … step without the stop codon. */
export function chainAfterStep(m: DogmaModel3D, step: number): Codon[] {
  return m.t.codons.slice(0, Math.max(0, step + 1)).filter((c) => !c.entry?.stop);
}

/** The stop codon is being read now: no tRNA comes, the chain is let go. */
export function releasing(m: DogmaModel3D, mo: DogmaMoment): boolean {
  return mo.phase === 'translation' && mo.step === m.t.stopIndex;
}

/** The position (0-based, on the DNA / mRNA) the view is about at a moment. */
export function activeIndex(m: DogmaModel3D, mo: DogmaMoment): number {
  if (mo.phase === 'transcription') return Math.min(m.mrna.length - 1, Math.max(0, mo.made));
  if (mo.phase === 'release') return Math.max(0, m.mrna.length - 1);
  const c = m.t.codons[mo.step];
  return c ? c.pos + 1 : 0;
}

// ─── Window ──────────────────────────────────────────────────────────────────────────────────

/**
 * Base pairs drawn for a long sequence: at most `max` around the active position, moved in
 * quarter-window jumps (rarely re-laid out). Indices stay the model's own (absolute, 0-based):
 * [from, to).
 */
export function windowFor(n: number, active: number, max: number): { from: number; to: number } {
  const w = Math.max(1, Math.floor(max));
  if (n <= w) return { from: 0, to: n };
  const chunk = Math.max(1, Math.floor(w / 4));
  const ideal = active - w / 2;
  const from = Math.min(n - w, Math.max(0, Math.round(ideal / chunk) * chunk));
  return { from, to: from + w };
}
