import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/**
 * The start of the human β-globin gene (HBB), coding strand 5′→3′: codons 0–10 (Met, then
 * Val1 His2 Leu3 Thr4 Pro5 Glu6 Glu7 Lys8 Ser9 Ala10 — numbered without the Met, as the
 * sickle-cell mutation Glu6Val is). A fragment: its protein goes on past it.
 */
export const GENE = 'ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCC';

/** The standard genetic code (NCBI table 1), codons in TCAG order; '*' a stop codon. */
const CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const ORDER = 'TCAG';

/** The amino acid (one-letter) a DNA coding-strand codon codes for; '*' for a stop. */
export function aminoAcid(codon: string): string {
  let i = 0;
  for (let k = 0; k < codon.length; k++) i = i * 4 + ORDER.indexOf(codon.charAt(k));
  return CODE[i] ?? '?';
}

/** The mutations: none, the sickle-cell substitution, a silent one, a nonsense one, a frameshift. */

export const MUTATIONS: readonly ((gene: string) => string)[] = [
  (g) => g,
  (g) => `${g.slice(0, 19)}T${g.slice(20)}`, // GAG → GTG at codon 6: Glu → Val (sickle cell)
  (g) => `${g.slice(0, 20)}A${g.slice(21)}`, // GAG → GAA: still Glu (silent)
  (g) => `${g.slice(0, 18)}T${g.slice(19)}`, // GAG → TAG: a stop (nonsense)
  (g) => `${g.slice(0, 9)}A${g.slice(9)}`, // one base added after codon 2: the frame shifts
];

/** The protein a coding strand gives: codon by codon from the first, up to a stop or the end. */
export function translate(dna: string): string {
  let protein = '';
  for (let i = 0; i + 3 <= dna.length; i += 3) {
    const aa = aminoAcid(dna.slice(i, i + 3));
    if (aa === '*') break;
    protein += aa;
  }
  return protein;
}

/** The codons read, the stop included: what the ribosome moves over. */
export function codonsRead(dna: string): number {
  for (let i = 0; i + 3 <= dna.length; i += 3)
    if (aminoAcid(dna.slice(i, i + 3)) === '*') return i / 3 + 1;
  return Math.floor(dna.length / 3);
}

/** mRNA: the coding strand with U for T. */
export const mRNA = (dna: string) => dna.replaceAll('T', 'U');

/**
 * The effect on the protein against the normal one: 0 the same protein; 1 one amino acid changed
 * (missense); 2 cut short, the rest unchanged (nonsense); 3 changed from a point on (frameshift).
 */
export function effectOf(normal: string, mutant: string): number {
  if (mutant === normal) return 0;
  if (mutant.length < normal.length && normal.startsWith(mutant)) return 2;
  let changed = 0;
  for (let i = 0; i < Math.max(normal.length, mutant.length); i++)
    if (normal[i] !== mutant[i]) changed++;
  return mutant.length === normal.length && changed === 1 ? 1 : 3;
}

export function changedCount(normal: string, mutant: string): number {
  let changed = 0;
  for (let i = 0; i < Math.min(normal.length, mutant.length); i++)
    if (normal[i] !== mutant[i]) changed++;
  return changed;
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'mutation',
    (k) => Number.isInteger(k) && k >= 0 && k < MUTATIONS.length,
    `a code from 0 to ${MUTATIONS.length - 1}`,
  ],
  ['stepTime', (t) => t > 0 && t <= 5, 'above 0 and at most 5 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Protein synthesis input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Protein synthesis input "${id}" must be ${rule}, got ${value}`);
  }
}

const geneOf = (inputs: Inputs) => (MUTATIONS[inputs.mutation ?? NaN] ?? ((g: string) => g))(GENE);

const TIME = 0;
const TRANSCRIBED = 1;
const TRANSLATED = 2;
const CHANGED = 3;
const EFFECT = 4;

/**
 * Protein synthesis and point mutations: transcription then translation of a gene fragment (the
 * start of human β-globin) with the standard genetic code. The mRNA is copied from the DNA at
 * 6 bases per `stepTime` s; then a ribosome reads it one codon per `stepTime` s from the start
 * codon, adding one amino acid each, until a stop codon or the fragment's end. A mutation changes
 * the DNA: the sickle-cell substitution (Glu6Val), a silent one, a nonsense one or a one-base
 * insertion (frameshift). Timing is a picture's; the sequences and the code are exact.
 *
 * Variables: `time` (s), `transcribed` (bases of mRNA), `translated` (amino acids), `changed`
 * (amino acids differing from the normal protein so far), `effect` (0 none, 1 missense,
 * 2 nonsense, 3 frameshift — known once translation ends).
 */
export const proteinSynthesisModel: SimulationModel = {
  id: 'biology.protein-synthesis',
  inputs: ['mutation', 'stepTime'],
  variables: ['time', 'transcribed', 'translated', 'changed', 'effect'],
  predictions: ['length', 'changed', 'effect', 'bases'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const dna = geneOf(inputs);
    const per = inputs.stepTime ?? NaN;
    const copying = (dna.length / 6) * per;
    const end = copying + codonsRead(dna) * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    state[TRANSCRIBED] = Math.min(dna.length, Math.floor((t / per) * 6 + 1e-9));
    const protein = translate(dna);
    const read =
      t <= copying ? 0 : Math.min(codonsRead(dna), Math.floor((t - copying) / per + 1e-9));
    const made = Math.min(protein.length, read);
    state[TRANSLATED] = made;
    const normal = translate(GENE);
    state[CHANGED] = changedCount(normal.slice(0, made), protein.slice(0, made));
    state[EFFECT] = t >= end - 1e-9 ? effectOf(normal, protein) : 0;
    return h;
  },

  isComplete: (state, inputs) => {
    const dna = geneOf(inputs);
    const per = inputs.stepTime ?? NaN;
    return (state[TIME] ?? 0) >= (dna.length / 6) * per + codonsRead(dna) * per - 1e-9;
  },

  predict(inputs) {
    refuseInvalid(inputs);
    const dna = geneOf(inputs);
    const normal = translate(GENE);
    const protein = translate(dna);
    return {
      length: protein.length,
      changed: changedCount(normal, protein),
      effect: effectOf(normal, protein),
      bases: dna.length,
    };
  },
};
