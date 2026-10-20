/**
 * What the 3D view of "Đột biến điểm" shows, read from the lesson's own model (pure: no three.js,
 * no DOM). The mutation is the panel's (`mutationOf`), the mutated DNA is `mutate()`, the effect and
 * the first changed amino acid are `analyzeMutation`, and the mutated mRNA and protein are
 * `mutatedTranslation` — exactly what the 2D page reads, so both views always agree.
 *
 * Alignment (illustration, DATA_REVIEW MUT3D-*): the mutated helix is drawn under the normal one
 * with every unchanged base pair at the same place ("slot"). Inserted pairs loop out of the
 * helix (a bulge between their neighbours) and deleted pairs leave an empty stretch (a gap
 * marker), so the codon brackets of a frameshift are visibly shifted after the change.
 */
import {
  analyzeMutation,
  codingToMrna,
  complement,
  mutatedTranslation,
  translate,
  type Codon,
  type Mutation,
  type MutationEffect,
  type Translation,
} from '../dogma';

export type HelixId = 'normal' | 'mutated';

/** One of the two DNAs with its mRNA and protein. Indices are 0-based on its own strand. */
export interface Strand3D {
  /** Coding strand, 5′→3′. */
  coding: string;
  /** Template strand, 3′→5′ under it (`complement`). */
  template: string;
  /** mRNA, 5′→3′ (`codingToMrna`). */
  mrna: string;
  /** The translation the 2D page shows for this DNA. */
  t: Translation;
  /**
   * Slot of each base: where it is drawn along the DNA, in base pairs of the normal strand.
   * Normal DNA: its index. Mutated DNA: the same slot as the matching normal base; inserted bases
   * get fractional slots between their neighbours (they are drawn in the bulge).
   */
  slot: Float64Array;
  /** Codon index (in `t.codons`) of each position inside the reading frame, else −1. */
  codonOf: Int32Array;
}

export interface MutationModel3D {
  normal: Strand3D;
  mutated: Strand3D;
  m: Mutation;
  effect: MutationEffect;
  /** First changed amino acid (0-based, `analyzeMutation`), or −1. */
  firstChange: number;
  /**
   * Highlighted base pairs (outline and pulse), each on its own helix: the substituted pair or
   * the inserted pairs on the mutated helix, the deleted pairs on the normal helix.
   */
  marks: { helix: HelixId; index: number }[];
  /** Inserted bases on the mutated strand [from, to) (drawn as a bulge), or null. */
  bulge: { from: number; to: number } | null;
  /** Slots left empty on the mutated helix by a deletion [from, to) (gap marker), or null. */
  gap: { from: number; to: number } | null;
  /** Slot the site is centred on: both helices turn so that it faces the viewer. */
  site: number;
}

function strand3d(coding: string, t: Translation, slot: Float64Array): Strand3D {
  const codonOf = new Int32Array(coding.length).fill(-1);
  for (const c of t.codons)
    for (let k = 0; k < 3; k++) if (c.pos + k < coding.length) codonOf[c.pos + k] = c.index;
  return { coding, template: complement(coding), mrna: codingToMrna(coding), t, slot, codonOf };
}

/** Slots of the mutated strand's bases (see `Strand3D.slot`). */
export function mutatedSlots(m: Mutation, length: number): Float64Array {
  const out = new Float64Array(length);
  for (let j = 0; j < length; j++) {
    if (m.kind === 'deletion') out[j] = j < m.pos ? j : j + m.count;
    else if (m.kind === 'insertion') {
      const L = m.bases.length;
      if (j < m.pos) out[j] = j;
      else if (j < m.pos + L) out[j] = m.pos - 1 + (j - m.pos + 1) / (L + 1);
      else out[j] = j - L;
    } else out[j] = j;
  }
  return out;
}

/** The 3D model of a mutation of a coding strand (both DNAs, mRNAs, proteins and the marks). */
export function mutationModel3d(coding: string, m: Mutation): MutationModel3D {
  const a = analyzeMutation(coding, m);
  const mt = mutatedTranslation(coding, m);
  const normalSlots = Float64Array.from({ length: coding.length }, (_, i) => i);
  const normal = strand3d(coding, translate(codingToMrna(coding)), normalSlots);
  const mutated = strand3d(mt.coding, mt.t, mutatedSlots(m, mt.coding.length));
  let marks: MutationModel3D['marks'];
  let bulge: MutationModel3D['bulge'] = null;
  let gap: MutationModel3D['gap'] = null;
  let site: number;
  if (m.kind === 'substitution') {
    marks = [{ helix: 'mutated', index: m.pos }];
    site = m.pos;
  } else if (m.kind === 'insertion') {
    const L = m.bases.length;
    marks = Array.from({ length: L }, (_, k) => ({ helix: 'mutated' as const, index: m.pos + k }));
    bulge = { from: m.pos, to: m.pos + L };
    site = m.pos - 0.5;
  } else {
    marks = Array.from({ length: m.count }, (_, k) => ({
      helix: 'normal' as const,
      index: m.pos + k,
    }));
    gap = { from: m.pos, to: m.pos + m.count };
    site = m.pos + (m.count - 1) / 2;
  }
  return {
    normal,
    mutated,
    m,
    effect: a.effect,
    firstChange: a.firstChange,
    marks,
    bulge,
    gap,
    site,
  };
}

export const strandOf = (model: MutationModel3D, helix: HelixId): Strand3D =>
  helix === 'normal' ? model.normal : model.mutated;

/** Whether a base of the mutated strand is in the bulge (an inserted base). */
export function inBulge(model: MutationModel3D, j: number): boolean {
  const b = model.bulge;
  return b !== null && j >= b.from && j < b.to;
}

/** The codon a base belongs to on a helix (reading frame of that helix's translation). */
export function codonAt(model: MutationModel3D, helix: HelixId, i: number): Codon | null {
  const s = strandOf(model, helix);
  const c = s.codonOf[i] ?? -1;
  return c >= 0 ? (s.t.codons[c] ?? null) : null;
}

/** Three-letter names of a translation's amino acids (the 2D page's protein row). */
export function beadNames(t: Translation): string[] {
  return t.codons.filter((c) => !c.entry?.stop).map((c) => c.entry?.three ?? '?');
}

/** The protein as the 2D page writes it: three-letter names joined by "–". */
export function proteinText(t: Translation): string {
  return beadNames(t).join('–');
}

/**
 * Amino acids of a helix's chain (0-based) that differ from the other chain at the same number,
 * from firstChange on. A bead the other chain does not have (a lost or extra tail) differs.
 */
export function changedBeads(model: MutationModel3D, helix: HelixId): number[] {
  const from = model.firstChange;
  if (from < 0) return [];
  const own = beadNames(strandOf(model, helix).t);
  const other = beadNames(strandOf(model, helix === 'normal' ? 'mutated' : 'normal').t);
  const out: number[] = [];
  for (let k = from; k < own.length; k++) if (own[k] !== other[k]) out.push(k);
  return out;
}

/**
 * Codons of the mutated mRNA that are highlighted (the 2D page's rule): from the first changed
 * amino acid on, stop codons excepted.
 */
export function changedCodons(model: MutationModel3D): number[] {
  const from = model.firstChange;
  if (from < 0) return [];
  return model.mutated.t.codons
    .filter((c) => c.index >= from && !c.entry?.stop)
    .map((c) => c.index);
}

/** Slots spanned by a codon's bracket: its first and last base. */
export function codonSpan(
  model: MutationModel3D,
  helix: HelixId,
  c: number,
): { from: number; to: number } | null {
  const s = strandOf(model, helix);
  const codon = s.t.codons[c];
  if (!codon) return null;
  const a = s.slot[codon.pos];
  const b = s.slot[codon.pos + 2];
  return a === undefined || b === undefined ? null : { from: a, to: b };
}

/**
 * Slot of bead k on either chain: beads are aligned by amino acid number, under the normal
 * reading frame's codons (or the mutated one when the normal mRNA has no AUG), so amino acid k
 * of both chains sit one above the other.
 */
export function beadSlot(model: MutationModel3D, k: number): number {
  const ns = model.normal.t.start;
  const ms = model.mutated.t.start;
  const start = ns >= 0 ? ns : ms >= 0 ? (model.mutated.slot[ms] ?? 0) : 0;
  return start + 3 * k + 1;
}

/** Base pairs drawn: a window of at most `max` slots around the site (absolute slots). */
export function windowFor(n: number, site: number, max: number): { from: number; to: number } {
  const w = Math.max(1, Math.floor(max));
  if (n <= w) return { from: 0, to: n };
  const chunk = Math.max(1, Math.floor(w / 4));
  const ideal = site - w / 2;
  const from = Math.min(n - w, Math.max(0, Math.round(ideal / chunk) * chunk));
  return { from, to: from + w };
}

/** Whether a base at `slot` is drawn in the window [from, to) (a bulge base counts with its neighbours). */
export function slotShown(slot: number, win: { from: number; to: number }): boolean {
  return Math.ceil(slot) >= win.from && Math.floor(slot) < win.to;
}
