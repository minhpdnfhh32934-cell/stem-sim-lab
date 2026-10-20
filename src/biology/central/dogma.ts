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

/**
 * Prime marks accepted after 5/3: ASCII ' and `, the prime ′, the typographic quotes ’ ‘ that
 * Word and phone keyboards insert, and the acute accent ´.
 */
const PRIMES = "'′’‘`´";
const END_MARK = new RegExp(`([53])[${PRIMES}]`, 'g');
const BASE_CHAR = /[ATGCUX]/i;

export type StrandDirection = '5to3' | '3to5';

/**
 * Direction of a typed strand from its 5′/3′ end marks ("5'-ATG-3'" → 5to3), or null when it
 * has none. A single mark is enough (a leading 5′ or a trailing 3′ means 5′→3′). Marks inside
 * the sequence or two marks with the same number are rejected instead of being guessed.
 */
export function strandDirection(input: string): StrandDirection | null {
  const first = input.search(BASE_CHAR);
  let last = -1;
  for (let i = input.length - 1; i >= 0; i--) {
    if (BASE_CHAR.test(input[i] ?? '')) {
      last = i;
      break;
    }
  }
  let lead: string | null = null;
  let trail: string | null = null;
  for (const m of input.matchAll(END_MARK)) {
    const at = m.index;
    if (first < 0 || at < first) {
      if (lead !== null) throw new SequenceError('two 5′/3′ marks at the start');
      lead = m[1] ?? null;
    } else if (at > last) {
      if (trail !== null) throw new SequenceError('two 5′/3′ marks at the end');
      trail = m[1] ?? null;
    } else throw new SequenceError('5′/3′ marks must be at the ends of the strand');
  }
  if (lead !== null && lead === trail) throw new SequenceError('conflicting 5′/3′ marks');
  if (lead === '5' || trail === '3') return '5to3';
  if (lead === '3' || trail === '5') return '3to5';
  return null;
}

/** Keeps A, T, G, C (case-insensitive); spaces, digits and "5'…3'" marks are ignored. */
export function cleanDna(input: string): string {
  const s = input
    .toUpperCase()
    .replace(END_MARK, '')
    .replace(/[-\s\d,.]/g, '')
    .replace(/X/g, 'C') // Vietnamese texts write cytosine as X (xitôzin)
    .replace(/U/g, 'T');
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

const RNA_PAIR: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' };

/**
 * The tRNA anticodon that pairs with an mRNA codon, base by base (A–U, G–C), written in the
 * codon's order (the anticodon itself runs 3′→5′ under the codon's 5′→3′). Wobble pairing is
 * not modelled: this is the strictly complementary anticodon.
 */
export function anticodon(codon: string): string {
  return codon.replace(/./g, (b) => RNA_PAIR[b] ?? b);
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
  return translateFrom(mrna, fromStart ? mrna.indexOf('AUG') : 0);
}

/** Translation in the reading frame that starts at `start` (positions are absolute). */
export function translateFrom(mrna: string, start: number): Translation {
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
  | 'startGain'
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
  const S = before.start;
  if (S < 0) return { effect: 'none', before, after: afterFull, firstChange };
  const cdsEnd = before.stopIndex >= 0 ? S + 3 * (before.stopIndex + 1) : coding.length;
  // Does the mutation hit the bases of the start codon [S, S+3)? An insertion exactly at S goes
  // in front of the A and leaves the ATG intact.
  const touchesStart =
    m.kind === 'substitution'
      ? m.pos >= S && m.pos < S + 3
      : m.kind === 'insertion'
        ? m.pos > S && m.pos < S + 3
        : m.pos < S + 3 && m.pos + m.count > S;
  if (touchesStart && mutated.slice(S, S + 3) !== 'ATG')
    return { effect: 'startLoss', before, after: afterFull, firstChange };
  const upstream = !touchesStart && (m.kind === 'insertion' ? m.pos <= S : m.pos < S);
  if (upstream || m.pos >= cdsEnd) {
    // An upstream indel only moves the AUG: it is now expected at S + shift. A different first
    // AUG means the change created a new start codon in front of the old one.
    const shift = !upstream
      ? 0
      : m.kind === 'insertion'
        ? m.bases.length
        : m.kind === 'deletion'
          ? -m.count
          : 0;
    const effect = afterFull.start === S + shift ? 'outsideCds' : 'startGain';
    return { effect, before, after: afterFull, firstChange };
  }
  // Keep the original reading frame for the mutated sequence.
  const after = translateFrom(codingToMrna(mutated), before.start);
  const shifted = m.kind === 'insertion' ? m.bases.length : m.kind === 'deletion' ? m.count : 0;
  let effect: MutationEffect;
  if (shifted % 3 !== 0) effect = 'frameshift';
  else if (shifted !== 0) effect = 'inFrameIndel';
  else if (after.protein === before.protein && after.stopIndex === before.stopIndex)
    effect = 'silent';
  else if (after.stopIndex >= 0 && (before.stopIndex < 0 || after.stopIndex < before.stopIndex))
    effect = 'nonsense';
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
    after,
    firstChange: (() => {
      for (let i = 0; i < Math.max(before.protein.length, after.protein.length); i++)
        if (before.protein[i] !== after.protein[i]) return i;
      return -1;
    })(),
  };
}

/**
 * The mutated sequence and its translation, exactly as `analyzeMutation` reads it: the original
 * reading frame for a change inside the coding region, otherwise the first AUG of the mutated
 * mRNA (outside the CDS, start loss, start gain, no start). Reusing `after` keeps the view's
 * "mutated protein" row and the effect note from ever disagreeing.
 */
export function mutatedTranslation(
  coding: string,
  m: Mutation,
): { coding: string; mrna: string; t: Translation } {
  const mc = mutate(coding, m);
  return { coding: mc, mrna: codingToMrna(mc), t: analyzeMutation(coding, m).after };
}
