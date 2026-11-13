import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

/** Standard atomic weights (IUPAC conventional values) of the elements the library uses. */
export const ATOMIC_MASS: Readonly<Record<string, number>> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  Al: 26.982,
  Cl: 35.45,
  Fe: 55.845,
  K: 39.098,
};

export interface Species {
  readonly formula: string;
  readonly atoms: Readonly<Record<string, number>>;
}
export interface Reaction {
  readonly reactants: readonly Species[];
  readonly products: readonly Species[];
}

const s = (formula: string, atoms: Record<string, number>): Species => ({ formula, atoms });

/** The library: reactions with known products (never an arbitrary set of formulas). */
export const REACTIONS: readonly Reaction[] = [
  {
    reactants: [s('CH₄', { C: 1, H: 4 }), s('O₂', { O: 2 })],
    products: [s('CO₂', { C: 1, O: 2 }), s('H₂O', { H: 2, O: 1 })],
  },
  { reactants: [s('H₂', { H: 2 }), s('O₂', { O: 2 })], products: [s('H₂O', { H: 2, O: 1 })] },
  { reactants: [s('N₂', { N: 2 }), s('H₂', { H: 2 })], products: [s('NH₃', { N: 1, H: 3 })] },
  {
    reactants: [s('C₃H₈', { C: 3, H: 8 }), s('O₂', { O: 2 })],
    products: [s('CO₂', { C: 1, O: 2 }), s('H₂O', { H: 2, O: 1 })],
  },
  {
    reactants: [s('Al', { Al: 1 }), s('Cl₂', { Cl: 2 })],
    products: [s('AlCl₃', { Al: 1, Cl: 3 })],
  },
  {
    reactants: [s('Fe₂O₃', { Fe: 2, O: 3 }), s('CO', { C: 1, O: 1 })],
    products: [s('Fe', { Fe: 1 }), s('CO₂', { C: 1, O: 2 })],
  },
  {
    reactants: [s('KClO₃', { K: 1, Cl: 1, O: 3 })],
    products: [s('KCl', { K: 1, Cl: 1 }), s('O₂', { O: 2 })],
  },
  {
    reactants: [s('C₂H₅OH', { C: 2, H: 6, O: 1 }), s('O₂', { O: 2 })],
    products: [s('CO₂', { C: 1, O: 2 }), s('H₂O', { H: 2, O: 1 })],
  },
];

export const molarMass = (sp: Species) =>
  Object.entries(sp.atoms).reduce((m, [el, n]) => m + (ATOMIC_MASS[el] ?? NaN) * n, 0);

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/**
 * The smallest whole-number coefficients that balance every element: the one-dimensional null
 * space of the element matrix (reactants +, products −), by exact rational elimination (numerator
 * and denominator kept as integers), scaled to integers and divided by their common factor.
 */
export function balance(reaction: Reaction): number[] {
  const species = [...reaction.reactants, ...reaction.products];
  const elements = [...new Set(species.flatMap((x) => Object.keys(x.atoms)))];
  const sign = (i: number) => (i < reaction.reactants.length ? 1 : -1);
  const m = elements.map((el) => species.map((x, i) => sign(i) * (x.atoms[el] ?? 0)));
  const cols = species.length;
  // Row-reduce with integers (fraction-free Gaussian elimination).
  const pivots: number[] = [];
  let row = 0;
  for (let c = 0; c < cols && row < m.length; c++) {
    const p = m.findIndex((r, i) => i >= row && (r[c] ?? 0) !== 0);
    if (p < 0) continue;
    [m[row], m[p]] = [m[p] as number[], m[row] as number[]];
    const pr = m[row] as number[];
    for (let i = 0; i < m.length; i++) {
      if (i === row) continue;
      const r = m[i] as number[];
      const f = r[c] ?? 0;
      if (f === 0) continue;
      const pv = pr[c] ?? 1;
      for (let k = 0; k < cols; k++) r[k] = (r[k] ?? 0) * pv - (pr[k] ?? 0) * f;
    }
    pivots.push(c);
    row++;
  }
  // One free column: set it, solve each pivot row for its pivot.
  const free = [...Array(cols).keys()].find((c) => !pivots.includes(c)) ?? cols - 1;
  const lcm = pivots.reduce((l, c, i) => {
    const pv = Math.abs((m[i] as number[])[c] ?? 1);
    return (l * pv) / gcd(l, pv);
  }, 1);
  const x = new Array<number>(cols).fill(0);
  x[free] = lcm;
  pivots.forEach((c, i) => {
    const r = m[i] as number[];
    x[c] = (-(r[free] ?? 0) * lcm) / (r[c] ?? 1);
  });
  const g = x.reduce((a, v) => gcd(a, Math.round(v)), 0) || 1;
  const sgn = (x.find((v) => v !== 0) ?? 1) < 0 ? -1 : 1;
  return x.map((v) => (sgn * Math.round(v)) / g);
}

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'reaction',
    (k) => Number.isInteger(k) && k >= 0 && k < REACTIONS.length,
    `a code from 0 to ${REACTIONS.length - 1}`,
  ],
  ['mass', (m) => m > 0 && m <= 1000, 'above 0 and at most 1000 g'],
  ['stepTime', (t) => t > 0 && t <= 5, 'above 0 and at most 5 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Balancing input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Balancing input "${id}" must be ${rule}, got ${value}`);
  }
}

/** Atoms out of balance (Σ over elements of |left − right|) for coefficients `x`. */
export function imbalance(reaction: Reaction, x: readonly number[]): number {
  const species = [...reaction.reactants, ...reaction.products];
  const elements = [...new Set(species.flatMap((sp) => Object.keys(sp.atoms)))];
  return elements.reduce((sum, el) => {
    let d = 0;
    species.forEach(
      (sp, i) =>
        (d += (i < reaction.reactants.length ? 1 : -1) * (x[i] ?? 0) * (sp.atoms[el] ?? 0)),
    );
    return sum + Math.abs(d);
  }, 0);
}

const TIME = 0;
const STEP = 1;
const IMBALANCE = 2;
const COEFF = 3; // four slots: a, b, c, d
const LEFT_MASS = 7;
const RIGHT_MASS = 8;

/**
 * Balancing equations and their masses — conservation of atoms: a teaching model over a fixed
 * library of reactions (`reaction`). The balanced equation has the smallest whole-number
 * coefficients that conserve every element (`balance`: the element matrix's null space, exact).
 * The run balances it as a student does by inspection: from all coefficients 1, one coefficient
 * is raised by one every `stepTime` s towards its final value, species by species, and the atoms
 * out of balance are counted after each step until none are. With `mass` g of the first reactant
 * the masses of every species follow from the coefficients and molar masses (IUPAC atomic
 * weights): the reactants' total equals the products'.
 *
 * Variables: `time` (s), `steps`, `imbalance` (atoms), `coefficientA`…`coefficientD` (0 where
 * the reaction has fewer species), `leftMass` and `rightMass` (g, at the coefficients so far, for
 * `mass` g of the first reactant's moles).
 */
export const balancingModel: SimulationModel = {
  id: 'chemistry.balancing',
  inputs: ['reaction', 'mass', 'stepTime'],
  variables: [
    'time',
    'steps',
    'imbalance',
    'coefficientA',
    'coefficientB',
    'coefficientC',
    'coefficientD',
    'leftMass',
    'rightMass',
  ],
  predictions: [
    'coefficientA',
    'coefficientB',
    'coefficientC',
    'coefficientD',
    'reactantMass',
    'productMass',
    'steps',
  ],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    derive(state, 0, inputs);
  },

  step(state, dt, inputs) {
    const reaction = REACTIONS[inputs.reaction ?? NaN];
    if (!reaction) return 0;
    const target = balance(reaction);
    const total = target.reduce((n, v) => n + v - 1, 0);
    const per = inputs.stepTime ?? NaN;
    const end = total * per;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    state[TIME] = t;
    derive(state, Math.min(total, Math.floor(t / per + 1e-9)), inputs);
    return h;
  },

  isComplete: (state, inputs) => {
    const reaction = REACTIONS[inputs.reaction ?? NaN];
    return !reaction || (state[STEP] ?? 0) >= balance(reaction).reduce((n, v) => n + v - 1, 0);
  },

  predict(inputs) {
    refuseInvalid(inputs);
    const reaction = REACTIONS[inputs.reaction ?? NaN];
    if (!reaction) return {};
    const x = balance(reaction);
    const species = [...reaction.reactants, ...reaction.products];
    const moles = (inputs.mass ?? NaN) / molarMass(species[0] as Species) / (x[0] ?? 1);
    const mass = (from: number, to: number) =>
      species
        .slice(from, to)
        .reduce((m, sp, i) => m + moles * (x[from + i] ?? 0) * molarMass(sp), 0);
    return {
      coefficientA: x[0] ?? 0,
      coefficientB: x[1] ?? 0,
      coefficientC: x[2] ?? 0,
      coefficientD: x[3] ?? 0,
      reactantMass: mass(0, reaction.reactants.length),
      productMass: mass(reaction.reactants.length, species.length),
      steps: x.reduce((n, v) => n + v - 1, 0),
    };
  },
};

/** The coefficients after `steps` raises (species in order), the imbalance and the two masses. */
function derive(state: Float64Array, steps: number, inputs: Inputs): void {
  const reaction = REACTIONS[inputs.reaction ?? NaN];
  if (!reaction) return;
  const target = balance(reaction);
  const x = target.map(() => 1);
  let left = steps;
  for (let i = 0; i < x.length && left > 0; i++) {
    const raise = Math.min(left, (target[i] ?? 1) - 1);
    x[i] = 1 + raise;
    left -= raise;
  }
  const species = [...reaction.reactants, ...reaction.products];
  const moles = (inputs.mass ?? NaN) / molarMass(species[0] as Species) / (target[0] ?? 1);
  state[STEP] = steps;
  state[IMBALANCE] = imbalance(reaction, x);
  for (let i = 0; i < 4; i++) state[COEFF + i] = x[i] ?? 0;
  let l = 0;
  let r = 0;
  species.forEach((sp, i) => {
    const m = moles * (x[i] ?? 0) * molarMass(sp);
    if (i < reaction.reactants.length) l += m;
    else r += m;
  });
  state[LEFT_MASS] = l;
  state[RIGHT_MASS] = r;
}
