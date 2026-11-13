import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/**
 * Human chromosome lengths (Mb) in the GRCh38 reference assembly: 1–22, then X and Y. Their sizes
 * order the karyogram; the drawing scales them.
 */
export const LENGTHS_MB: Readonly<Record<string, number>> = {
  '1': 248.96,
  '2': 242.19,
  '3': 198.3,
  '4': 190.21,
  '5': 181.54,
  '6': 170.81,
  '7': 159.35,
  '8': 145.14,
  '9': 138.39,
  '10': 133.8,
  '11': 135.09,
  '12': 133.28,
  '13': 114.36,
  '14': 107.04,
  '15': 101.99,
  '16': 90.34,
  '17': 83.26,
  '18': 80.37,
  '19': 58.62,
  '20': 64.44,
  '21': 46.71,
  '22': 50.82,
  X: 156.04,
  Y: 57.23,
};

export interface Karyotype {
  readonly formula: string;
  /** Copies of each autosome that differ from two, by chromosome. */
  readonly autosomes: Readonly<Record<string, number>>;
  readonly sex: string;
}

const NORMAL: Karyotype = { formula: '46,XX', autosomes: {}, sex: 'XX' };

/** The karyotypes shown: normal, and the common aneuploidies (ISCN notation). */
export const KARYOTYPES: readonly Karyotype[] = [
  NORMAL,
  { formula: '46,XY', autosomes: {}, sex: 'XY' },
  { formula: '47,XY,+21', autosomes: { '21': 3 }, sex: 'XY' }, // Down syndrome
  { formula: '47,XX,+18', autosomes: { '18': 3 }, sex: 'XX' }, // Edwards syndrome
  { formula: '47,XY,+13', autosomes: { '13': 3 }, sex: 'XY' }, // Patau syndrome
  { formula: '45,X', autosomes: {}, sex: 'X' }, // Turner syndrome
  { formula: '47,XXY', autosomes: {}, sex: 'XXY' }, // Klinefelter syndrome
];

/** Every chromosome of a karyotype, in karyogram order (pairs 1–22, then the sex chromosomes). */
export function chromosomesOf(k: Karyotype): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 22; i++) {
    const id = String(i);
    for (let c = 0; c < (k.autosomes[id] ?? 2); c++) out.push(id);
  }
  for (let i = 0; i < k.sex.length; i++) out.push(k.sex.charAt(i));
  return out;
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'karyotype',
    (k) => Number.isInteger(k) && k >= 0 && k < KARYOTYPES.length,
    `a code from 0 to ${KARYOTYPES.length - 1}`,
  ],
  ['sortTime', (t) => t > 0 && t <= 30, 'above 0 and at most 30 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Karyotype input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Karyotype input "${id}" must be ${rule}, got ${value}`);
  }
}

const karyotypeOf = (inputs: Inputs) => KARYOTYPES[inputs.karyotype ?? NaN] ?? NORMAL;

const TIME = 0;
const SORTED = 1;
const COUNTED = 2;
const AUTOSOMES = 3;
const X = 4;
const Y = 5;

/**
 * A human karyotype: the chromosomes of one cell in metaphase, photographed and arranged in pairs
 * by size (a karyogram). The run sorts the spread into pairs over `sortTime` s, counting them one
 * by one; the counts — total, autosomes, X and Y — are exact for the chosen karyotype (`karyotype`:
 * normal female and male, trisomies 21, 18 and 13, Turner 45,X and Klinefelter 47,XXY). Lengths
 * from the GRCh38 assembly.
 *
 * Variables: `time` (s), `sorted` (0–1 of the way to the karyogram), `counted`, `autosomes`,
 * `x`, `y` (counted so far).
 */
export const karyotypeModel: SimulationModel = {
  id: 'biology.karyotype',
  inputs: ['karyotype', 'sortTime'],
  variables: ['time', 'sorted', 'counted', 'autosomes', 'x', 'y'],
  predictions: ['chromosomes', 'autosomes', 'x', 'y'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const per = inputs.sortTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < per)) return 0;
    const h = Math.min(dt, per - time);
    const t = time + h;
    state[TIME] = t;
    state[SORTED] = t / per;
    const all = chromosomesOf(karyotypeOf(inputs));
    const counted = Math.min(all.length, Math.floor((t / per) * all.length + 1e-9));
    let auto = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < counted; i++) {
      const c = all[i];
      if (c === 'X') x++;
      else if (c === 'Y') y++;
      else auto++;
    }
    state[COUNTED] = counted;
    state[AUTOSOMES] = auto;
    state[X] = x;
    state[Y] = y;
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.sortTime ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const all = chromosomesOf(karyotypeOf(inputs));
    return {
      chromosomes: all.length,
      autosomes: all.filter((c) => c !== 'X' && c !== 'Y').length,
      x: all.filter((c) => c === 'X').length,
      y: all.filter((c) => c === 'Y').length,
    };
  },
};
