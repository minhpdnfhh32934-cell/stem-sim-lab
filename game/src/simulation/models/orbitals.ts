import type { SimulationModel } from '../SimulationModel';

type Inputs = Readonly<Record<string, number>>;

const TIME = 0;
const RADIUS = 1;
const DENSITY = 2;
const INSIDE = 3;
const PEAK = 4;
const MEAN = 5;
const NODES = 6;
const PEAK_DENSITY = 7;
const LAST_SIGN = 8;

/** The Bohr radius a₀ (pm), CODATA 2018: 52.917 721 090 3 pm. */
export const BOHR_PM = 52.9177210903;

/** The hydrogen orbitals the table shows: n, l. */
export const ORBITALS = [
  { label: '1s', n: 1, l: 0 },
  { label: '2s', n: 2, l: 0 },
  { label: '2p', n: 2, l: 1 },
  { label: '3s', n: 3, l: 0 },
  { label: '3p', n: 3, l: 1 },
  { label: '3d', n: 3, l: 2 },
] as const;

/** The hydrogen radial function R_nl(ρ), ρ = r/a₀, in a₀^(−3/2) (the standard closed forms). */
export function radial(n: number, l: number, rho: number): number {
  const e = Math.exp(-rho / n);
  if (n === 1) return 2 * e;
  if (n === 2 && l === 0) return (1 / (2 * Math.SQRT2)) * (2 - rho) * e;
  if (n === 2) return (1 / (2 * Math.sqrt(6))) * rho * e;
  if (l === 0) return (2 / (81 * Math.sqrt(3))) * (27 - 18 * rho + 2 * rho * rho) * e;
  if (l === 1) return (8 / (27 * Math.sqrt(6))) * rho * (1 - rho / 6) * e;
  return (4 / (81 * Math.sqrt(30))) * rho * rho * e;
}

/** The radial probability density P(ρ) = ρ²·R² (per a₀): the chance of the electron at r, per a₀. */
export const radialDensity = (n: number, l: number, rho: number) => (rho * radial(n, l, rho)) ** 2;

const DOMAIN: readonly (readonly [string, (value: number) => boolean, string])[] = [
  [
    'orbital',
    (k) => Number.isInteger(k) && k >= 0 && k < ORBITALS.length,
    `a code from 0 to ${ORBITALS.length - 1}`,
  ],
  ['maxRadius', (r) => r >= 5 && r <= 60, 'from 5 to 60 a₀'],
  ['scanTime', (t) => t > 0 && t <= 120, 'above 0 and at most 120 s'],
];

function refuseInvalid(inputs: Inputs): void {
  for (const [id, accepts, rule] of DOMAIN) {
    const value = inputs[id];
    if (value === undefined) throw new Error(`Orbitals input "${id}" is missing`);
    if (!accepts(value)) throw new Error(`Orbitals input "${id}" must be ${rule}, got ${value}`);
  }
}

/** The radius (a₀) where P is largest, by a fine scan then a golden-section refinement. */
export function mostProbableRadius(n: number, l: number): number {
  let best = 0;
  let at = 0;
  for (let rho = 0; rho <= 40; rho += 0.001) {
    const p = radialDensity(n, l, rho);
    if (p > best) [best, at] = [p, rho];
  }
  let lo = Math.max(0, at - 0.001);
  let hi = at + 0.001;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) {
    const a = hi - g * (hi - lo);
    const b = lo + g * (hi - lo);
    if (radialDensity(n, l, a) > radialDensity(n, l, b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
}

/**
 * Atomic orbitals of hydrogen — where the electron is likely to be: a teaching model from the
 * exact solutions of the Schrödinger equation for hydrogen. For the chosen orbital (`orbital`:
 * 1s, 2s, 2p, 3s, 3p, 3d) the run scans the distance r from the nucleus outwards to `maxRadius`
 * a₀ over `scanTime` s, reading the radial probability density P(r) = r²·R_nl(r)², the chance of
 * finding the electron inside r (the integral of P, by the trapezium rule over the scan's steps),
 * the peak passed so far (the most probable radius), the mean radius so far (∫r·P) and the
 * radial nodes crossed (where R changes sign). Theory: the most probable radius (a₀ for 1s, 4a₀
 * for 2p, 9a₀ for 3d), ⟨r⟩ = (a₀/2)·(3n² − l(l + 1)), n − l − 1 radial and l angular nodes.
 * Hydrogen only (one electron); a₀ = 52.918 pm.
 *
 * Variables: `time` (s), `radius` r (pm), `density` P (per a₀), `inside` (% of the electron
 * within r), `peakRadius` and `meanRadius` (pm), `radialNodes` crossed, `peakDensity`, `sign`.
 */
export const orbitalsModel: SimulationModel = {
  id: 'chemistry.orbitals',
  inputs: ['orbital', 'maxRadius', 'scanTime'],
  variables: [
    'time',
    'radius',
    'density',
    'inside',
    'peakRadius',
    'meanRadius',
    'radialNodes',
    'peakDensity',
    'sign',
  ],
  predictions: ['peakRadius', 'meanRadius', 'radialNodes', 'angularNodes'],

  init(inputs, state) {
    refuseInvalid(inputs);
    state.fill(0);
    const { n, l } = ORBITALS[inputs.orbital ?? NaN] ?? { n: 1, l: 0 };
    state[LAST_SIGN] = Math.sign(radial(n, l, 1e-9)) || 1;
  },

  step(state, dt, inputs) {
    const end = inputs.scanTime ?? NaN;
    const time = state[TIME] ?? 0;
    if (!(time < end)) return 0;
    const h = Math.min(dt, end - time);
    const t = time + h;
    const { n, l } = ORBITALS[inputs.orbital ?? NaN] ?? { n: 1, l: 0 };
    const max = inputs.maxRadius ?? NaN;
    const rho0 = (max * time) / end;
    const rho = (max * t) / end;
    const p0 = radialDensity(n, l, rho0);
    const p = radialDensity(n, l, rho);
    const area = ((p0 + p) / 2) * (rho - rho0); // the trapezium over this step
    const meanArea = ((rho0 * p0 + rho * p) / 2) * (rho - rho0);
    const inside = (state[INSIDE] ?? 0) / 100 + area;
    state[TIME] = t;
    state[RADIUS] = rho * BOHR_PM;
    state[DENSITY] = p;
    state[INSIDE] = 100 * inside;
    state[MEAN] = (state[MEAN] ?? 0) + meanArea * BOHR_PM;
    if (p >= (state[PEAK_DENSITY] ?? 0)) {
      state[PEAK_DENSITY] = p;
      state[PEAK] = rho * BOHR_PM;
    }
    const sign = Math.sign(radial(n, l, rho));
    if (sign !== 0 && sign !== state[LAST_SIGN]) {
      state[NODES] = (state[NODES] ?? 0) + 1;
      state[LAST_SIGN] = sign;
    }
    return h;
  },

  isComplete: (state, inputs) => (state[TIME] ?? 0) >= (inputs.scanTime ?? NaN),

  predict(inputs) {
    refuseInvalid(inputs);
    const { n, l } = ORBITALS[inputs.orbital ?? NaN] ?? { n: 1, l: 0 };
    return {
      peakRadius: mostProbableRadius(n, l) * BOHR_PM,
      meanRadius: ((3 * n * n - l * (l + 1)) / 2) * BOHR_PM,
      radialNodes: n - l - 1,
      angularNodes: l,
    };
  },
};
