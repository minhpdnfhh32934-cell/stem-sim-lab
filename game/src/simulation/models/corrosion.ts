import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const DAYS = 0;
const RUST = 1;
const ZINC = 2;

/**
 * The tubes of the classic rusting experiment, each an iron nail in its own conditions, with
 * the pace the school experiment shows as a relative rate (1: in tap water open to the air).
 * The ORDER is the established result (rusting needs both water and oxygen; salt speeds it up;
 * contact with a less reactive metal speeds the iron's corrosion; zinc in contact corrodes
 * instead of the iron). The NUMBERS are illustrative, chosen only to show that order — not
 * measured rates.
 */
export const TUBES = [
  { conditions: 'water and air', rate: 1, zinc: false },
  { conditions: 'dry air (calcium chloride)', rate: 0, zinc: false },
  { conditions: 'boiled water under oil (no air)', rate: 0, zinc: false },
  { conditions: 'salt water and air', rate: 2.5, zinc: false },
  { conditions: 'wrapped in copper, water and air', rate: 2, zinc: false },
  { conditions: 'wrapped in zinc, water and air', rate: 0, zinc: true },
] as const;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'tube',
    (k) => Number.isInteger(k) && k >= 0 && k < TUBES.length,
    `a code from 0 to ${TUBES.length - 1}`,
  ],
  ['days', (d) => d > 0 && d <= 30, 'above 0 and at most 30 days'],
  ['timeConstant', (t) => t > 0 && t <= 100, 'above 0 and at most 100 days'],
  ['dayLength', (s) => s > 0 && s <= 10, 'above 0 and at most 10 s a day'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Corrosion input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Corrosion input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The rust index after `days` (0 bright, 1 covered): 1 − e^(−rate·days/τ). */
function rustAfter(inputs: Inputs, days: number): number {
  const tube = TUBES[inputs.tube ?? NaN];
  return tube ? 1 - Math.exp((-tube.rate * days) / (inputs.timeConstant ?? NaN)) : NaN;
}

/**
 * Conditions for rusting: a qualitative teaching model. Six tubes each hold an iron nail
 * (`tube`): in water open to the air; in dry air over calcium chloride; in boiled water under a
 * layer of oil; in salt water; wrapped with copper; wrapped with zinc. Over `days` days (each shown
 * in `dayLength` s) the nail's surface rusts as 1 − e^(−r·t/τ) with the tube's relative rate r and
 * a stated teaching time constant τ (`timeConstant`). Where zinc touches the nail, the zinc
 * corrodes instead (sacrificial protection) by the same law at rate 1. Only the order of the
 * tubes is the experiment's result; the rates and τ are illustrative (see `TUBES`).
 *
 * Variables: `days` (d), `rust` the nail's rust index (0–1), `zincCorroded` the zinc's (0–1).
 */
export const corrosionModel: SimulationModel = {
  id: 'chemistry.corrosion',
  inputs: ['tube', 'days', 'timeConstant', 'dayLength'],
  variables: ['days', 'rust', 'zincCorroded'],
  predictions: ['rust', 'zincCorroded', 'rate'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
  },

  step(state, dt, inputs) {
    const end = inputs.days ?? NaN;
    const days = state[DAYS] ?? 0;
    if (!(days < end)) return 0;
    const per = inputs.dayLength ?? NaN;
    const d = Math.min(dt / per, end - days);
    const t = days + d;
    state[DAYS] = t;
    state[RUST] = rustAfter(inputs, t);
    state[ZINC] = TUBES[inputs.tube ?? NaN]?.zinc
      ? 1 - Math.exp(-t / (inputs.timeConstant ?? NaN))
      : 0;
    return d * per;
  },

  isComplete: (state, inputs) => (state[DAYS] ?? 0) >= (inputs.days ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const tube = TUBES[inputs.tube ?? NaN];
    const days = inputs.days ?? NaN;
    return {
      rust: rustAfter(inputs, days),
      zincCorroded: tube?.zinc ? 1 - Math.exp(-days / (inputs.timeConstant ?? NaN)) : 0,
      rate: tube?.rate ?? NaN,
    };
  },
};
