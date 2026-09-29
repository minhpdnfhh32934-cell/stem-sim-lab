import { z } from 'zod';
import raw from '@data/genetic_code.json';
import { loadDataset, ReviewStatusSchema, type Source } from '@/core/data/dataset';

const CodonSchema = z.object({
  codon: z.string().regex(/^[UCAG]{3}$/),
  aa: z.string().length(1),
  three: z.string(),
  name: z.string(),
  start: z.boolean(),
  stop: z.boolean(),
  review_status: ReviewStatusSchema,
});
export type CodonEntry = z.infer<typeof CodonSchema>;

const dataset = loadDataset('genetic_code', CodonSchema, raw);
export const GENETIC_CODE: readonly CodonEntry[] = dataset.items;
export const GENETIC_CODE_SOURCE: Source = dataset.source;
const BY_CODON = new Map(GENETIC_CODE.map((c) => [c.codon, c]));

export function codonEntry(codon: string): CodonEntry | undefined {
  return BY_CODON.get(codon);
}

export class SequenceError extends Error {
  override name = 'SequenceError';
}

const DNA_PAIR: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const RNA_OF_TEMPLATE: Record<string, string> = { A: 'U', T: 'A', G: 'C', C: 'G' };

/** Keeps A, T, G, C (case-insensitive); spaces, digits and "5'…3'" marks are ignored. */
export function cleanDna(input: string): string {
  const s = input.toUpperCase().replace(/5'|3'|[-\s\d,.]/g, '');
  const bad = /[^ATGC]/.exec(s);
  if (bad) throw new SequenceError(`invalid base "${bad[0]}"`);
  return s;
}

/** Complementary strand read 3'→5' under the given 5'→3' strand (A–T, G–C). */
export function complement(dna: string): string {
  return dna.replace(/./g, (b) => DNA_PAIR[b] ?? '?');
}

/**
 * Transcription: the RNA is complementary to the TEMPLATE strand (mạch mã gốc, read 3'→5')
 * and therefore has the same sequence as the CODING strand (mạch bổ sung) with U for T.
 * `templateStrand` is written 3'→5' left to right, aligned with the coding strand.
 */
export function transcribeTemplate(templateStrand3to5: string): string {
  return templateStrand3to5.replace(/./g, (b) => RNA_OF_TEMPLATE[b] ?? '?');
}

export function codingToMrna(coding5to3: string): string {
  return coding5to3.replace(/T/g, 'U');
}

export interface Codon {
  index: number;
  /** Position of the first base in the mRNA (0-based). */
  pos: number;
  codon: string;
  entry: CodonEntry | undefined;
}

export interface Translation {
  /** Start of the first AUG (0-based), or −1. */
  start: number;
  codons: Codon[];
  /** One-letter protein (no stop symbol). */
  protein: string;
  /** Codon index of the stop codon, or −1 when translation runs off the end. */
  stopIndex: number;
}

/** Translation from the first AUG to the first in-frame stop codon (standard code). */
export function translate(mrna: string, fromStart = true): Translation {
  const start = fromStart ? mrna.indexOf('AUG') : 0;
  if (start < 0) return { start: -1, codons: [], protein: '', stopIndex: -1 };
  const codons: Codon[] = [];
  let protein = '';
  let stopIndex = -1;
  for (let p = start, i = 0; p + 3 <= mrna.length; p += 3, i++) {
    const codon = mrna.slice(p, p + 3);
    const entry = codonEntry(codon);
    codons.push({ index: i, pos: p, codon, entry });
    if (entry?.stop) {
      stopIndex = i;
      break;
    }
    protein += entry?.aa ?? '?';
  }
  return { start, codons, protein, stopIndex };
}

export type Mutation =
  | { kind: 'substitution'; pos: number; base: string }
  | { kind: 'insertion'; pos: number; bases: string }
  | { kind: 'deletion'; pos: number; count: number };

/** Applies a point mutation to the CODING strand (0-based position). */
export function mutate(coding: string, m: Mutation): string {
  if (m.pos < 0 || m.pos > coding.length) throw new SequenceError('position out of range');
  switch (m.kind) {
    case 'substitution':
      if (m.pos >= coding.length) throw new SequenceError('position out of range');
      return coding.slice(0, m.pos) + m.base + coding.slice(m.pos + 1);
    case 'insertion':
      return coding.slice(0, m.pos) + m.bases + coding.slice(m.pos);
    case 'deletion':
      return coding.slice(0, m.pos) + coding.slice(m.pos + m.count);
  }
}

export type MutationEffect =
  | 'silent'
  | 'missense'
  | 'nonsense'
  | 'stopLoss'
  | 'startLoss'
  | 'frameshift'
  | 'inFrameIndel'
  | 'outsideCds'
  | 'none';

export interface MutationAnalysis {
  effect: MutationEffect;
  before: Translation;
  after: Translation;
  /** First changed amino-acid position (0-based) or −1. */
  firstChange: number;
}

/**
 * Consequence of a mutation for the protein (standard textbook categories). The coding
 * region is taken from the first AUG of the original sequence to its stop codon.
 */
export function analyzeMutation(coding: string, m: Mutation): MutationAnalysis {
  const before = translate(codingToMrna(coding));
  const mutated = mutate(coding, m);
  const afterFull = translate(codingToMrna(mutated));
  const firstChange = (() => {
    const a = before.protein;
    const b = afterFull.protein;
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
    return -1;
  })();
  if (before.start < 0) return { effect: 'none', before, after: afterFull, firstChange };
  const cdsEnd = before.stopIndex >= 0 ? before.start + 3 * (before.stopIndex + 1) : coding.length;
  if (m.pos < before.start || m.pos >= cdsEnd) {
    // Outside the coding region, unless it destroys/creates the start codon.
    const effect = afterFull.start !== before.start ? 'startLoss' : 'outsideCds';
    return { effect, before, after: afterFull, firstChange };
  }
  if (m.pos < before.start + 3)
    return { effect: 'startLoss', before, after: afterFull, firstChange };
  // Keep the original reading frame for the mutated sequence.
  const after = translate(codingToMrna(mutated).slice(before.start), false);
  const shifted = m.kind === 'insertion' ? m.bases.length : m.kind === 'deletion' ? m.count : 0;
  let effect: MutationEffect;
  if (shifted % 3 !== 0) effect = 'frameshift';
  else if (shifted !== 0) effect = 'inFrameIndel';
  else if (after.protein === before.protein && after.stopIndex === before.stopIndex)
    effect = 'silent';
  else if (after.stopIndex >= 0 && after.stopIndex < before.stopIndex) effect = 'nonsense';
  else if (
    before.stopIndex >= 0 &&
    after.stopIndex !== before.stopIndex &&
    after.protein.length > before.protein.length
  )
    effect = 'stopLoss';
  else effect = 'missense';
  return {
    effect,
    before,
    after: { ...after, start: before.start },
    firstChange: (() => {
      for (let i = 0; i < Math.max(before.protein.length, after.protein.length); i++)
        if (before.protein[i] !== after.protein[i]) return i;
      return -1;
    })(),
  };
}
