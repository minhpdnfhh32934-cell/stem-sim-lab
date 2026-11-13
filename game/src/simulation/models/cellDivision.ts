import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** A stage of a division, with what one cell holds in it (n = the haploid number). */
export interface DivisionStage {
  readonly id: string;
  /** Cells at the end of the stage. */
  readonly cells: number;
  /** Chromosomes (centromeres) in one cell, as a multiple of n. */
  readonly chromosomes: number;
  /** Chromatids in one cell, as a multiple of n. */
  readonly chromatids: number;
  /** DNA in one cell, in C (the haploid DNA content). */
  readonly dna: number;
  /** Chromosomes condensed and visible (not chromatin, as in interphase and telophase). */
  readonly condensed: boolean;
}

const st = (
  id: string,
  cells: number,
  chromosomes: number,
  chromatids: number,
  dna: number,
  condensed: boolean,
): DivisionStage => ({ id, cells, chromosomes, chromatids, dna, condensed });

/** Mitosis: one diploid cell → two diploid cells, identical to it. */
export const MITOSIS: readonly DivisionStage[] = [
  st('g1', 1, 2, 2, 2, false),
  st('s', 1, 2, 4, 4, false),
  st('g2', 1, 2, 4, 4, false),
  st('prophase', 1, 2, 4, 4, true),
  st('metaphase', 1, 2, 4, 4, true),
  st('anaphase', 1, 4, 4, 4, true),
  st('telophase', 2, 2, 2, 2, false),
];

/** Meiosis: one diploid cell → four haploid cells, each a new combination. */
export const MEIOSIS: readonly DivisionStage[] = [
  st('g1', 1, 2, 2, 2, false),
  st('s', 1, 2, 4, 4, false),
  st('g2', 1, 2, 4, 4, false),
  st('prophase-1', 1, 2, 4, 4, true),
  st('metaphase-1', 1, 2, 4, 4, true),
  st('anaphase-1', 1, 2, 4, 4, true),
  st('telophase-1', 2, 1, 2, 2, false),
  st('prophase-2', 2, 1, 2, 2, true),
  st('metaphase-2', 2, 1, 2, 2, true),
  st('anaphase-2', 2, 2, 2, 2, true),
  st('telophase-2', 4, 1, 1, 1, false),
];

export const stagesOf = (division: number) => (division === 1 ? MEIOSIS : MITOSIS);

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  ['division', (d) => d === 0 || d === 1, '0 (mitosis) or 1 (meiosis)'],
  [
    'diploid',
    (n) => Number.isInteger(n) && n >= 2 && n <= 60 && n % 2 === 0,
    'an even whole number from 2 to 60',
  ],
  ['stageTime', (t) => t > 0 && t <= 5, 'above 0 and at most 5 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Cell division input "${id}" is missing`);
    if (!accepts(value))
      throw new Error(`Cell division input "${id}" must be ${rule}, got ${value}`);
  }
}

const TIME = 0;
const STAGE = 1;
const CELLS = 2;
const CHROMOSOMES = 3;
const CHROMATIDS = 4;
const DNA = 5;
const IDENTICAL = 6;

function show(state: Float64Array, inputs: Inputs, index: number): void {
  const stages = stagesOf(inputs.division ?? 0);
  const s = stages[index] ?? stages[0];
  const n = (inputs.diploid ?? NaN) / 2;
  if (!s) return;
  state[STAGE] = index;
  state[CELLS] = s.cells;
  state[CHROMOSOMES] = s.chromosomes * n;
  state[CHROMATIDS] = s.chromatids * n;
  state[DNA] = s.dna;
  state[IDENTICAL] = inputs.division === 1 ? 0 : 1;
}

/**
 * Cell division — mitosis and meiosis (a teaching model of the textbook stages): one diploid cell
 * with `diploid` chromosomes (2n) goes through interphase (G1, S: its DNA copied, G2) and then
 * divides once (mitosis: two cells of 2n, identical to it) or twice (meiosis: four cells of n, each
 * a new combination of the parents' chromosomes), one stage every `stageTime` s. The counts per
 * cell are exact: chromosomes counted by centromeres (a doubled chromosome is one, its two
 * sister chromatids are two), DNA in C (the haploid content). Stage lengths are not to scale.
 *
 * Variables: `time` (s), `stage` (index), `cells`, `chromosomes`, `chromatids`, `dna` (C) per
 * cell, `identical` (1 when the daughters are copies of the parent cell).
 */
export const cellDivisionModel: SimulationModel = {
  id: 'biology.cell-division',
  inputs: ['division', 'diploid', 'stageTime'],
  variables: ['time', 'stage', 'cells', 'chromosomes', 'chromatids', 'dna', 'identical'],
  predictions: ['cells', 'chromosomes', 'dna', 'peakChromosomes', 'identical'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    show(state, inputs, 0);
  },

  step(state, dt, inputs) {
    const stages = stagesOf(inputs.division ?? 0);
    const per = inputs.stageTime ?? NaN;
    const end = stages.length * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    state[TIME] = time + h;
    show(state, inputs, Math.min(stages.length - 1, Math.floor((time + h) / per + 1e-9)));
    return h;
  },

  isComplete: (state, inputs) =>
    (state[TIME] ?? 0) >= stagesOf(inputs.division ?? 0).length * (inputs.stageTime ?? NaN) - 1e-9,

  predict(inputs) {
    refuseInvalid(inputs);
    const stages = stagesOf(inputs.division ?? 0);
    const last = stages[stages.length - 1] as DivisionStage;
    const n = (inputs.diploid ?? NaN) / 2;
    return {
      cells: last.cells,
      chromosomes: last.chromosomes * n,
      dna: last.dna,
      peakChromosomes: Math.max(...stages.map((s) => s.chromosomes)) * n,
      identical: inputs.division === 1 ? 0 : 1,
    };
  },
};
