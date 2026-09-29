import { C } from '@/core/constants';
import { dopri5 } from '@/core/ode';

/**
 * Homogeneous reversible reaction with elementary mass-action kinetics:
 *   r = k_f·Π[reactant]^ν − k_r·Π[product]^ν,   d[X]/dt = ν_X·r (products +, reactants −).
 * At equilibrium Q = K = k_f/k_r (concentration units). Temperature changes both rate
 * constants by the Arrhenius law, so ΔH = Eₐ,f − Eₐ,r and K(T) follows van 't Hoff.
 */
export interface Term {
  species: string;
  nu: number;
}

export interface EquilibriumSystem {
  id: string;
  reactants: Term[];
  products: Term[];
}

export const SYSTEMS: EquilibriumSystem[] = [
  { id: 'a-b', reactants: [{ species: 'A', nu: 1 }], products: [{ species: 'B', nu: 1 }] },
  {
    id: 'a+b-c',
    reactants: [
      { species: 'A', nu: 1 },
      { species: 'B', nu: 1 },
    ],
    products: [{ species: 'C', nu: 1 }],
  },
  { id: '2a-b', reactants: [{ species: 'A', nu: 2 }], products: [{ species: 'B', nu: 1 }] },
  {
    id: 'a+b-c+d',
    reactants: [
      { species: 'A', nu: 1 },
      { species: 'B', nu: 1 },
    ],
    products: [
      { species: 'C', nu: 1 },
      { species: 'D', nu: 1 },
    ],
  },
];

export interface Kinetics {
  /** Rate constants at the reference temperature T0. */
  kf0: number;
  kr0: number;
  /** Activation energies (J/mol). */
  eaf: number;
  ear: number;
  T0: number;
}

export function speciesOf(s: EquilibriumSystem): string[] {
  return [...new Set([...s.reactants, ...s.products].map((t) => t.species))];
}

/** Arrhenius: k(T) = k(T0)·exp(−Eₐ/R·(1/T − 1/T0)). */
export function rateConstants(k: Kinetics, T: number): { kf: number; kr: number } {
  const f = (k0: number, ea: number) => k0 * Math.exp((-ea / C.R) * (1 / T - 1 / k.T0));
  return { kf: f(k.kf0, k.eaf), kr: f(k.kr0, k.ear) };
}

export function equilibriumConstant(k: Kinetics, T: number): number {
  const { kf, kr } = rateConstants(k, T);
  return kf / kr;
}

/** Reaction quotient Q = Π[P]^ν / Π[R]^ν (Infinity when a reactant is 0). */
export function quotient(s: EquilibriumSystem, c: Record<string, number>): number {
  const prod = (terms: Term[]) => terms.reduce((p, t) => p * (c[t.species] ?? 0) ** t.nu, 1);
  const den = prod(s.reactants);
  return den === 0 ? Infinity : prod(s.products) / den;
}

/** Le Chatelier from Q vs K: which way the reaction runs next. */
export function shiftDirection(q: number, K: number, rtol = 1e-3): 'forward' | 'backward' | 'none' {
  if (!Number.isFinite(q)) return 'backward';
  if (Math.abs(q - K) <= rtol * K) return 'none';
  return q < K ? 'forward' : 'backward';
}

/**
 * Integrates the kinetics from `c0` over `duration` at temperature T; returns samples
 * (every `dtSample`) and the final concentrations. DOPRI5 with tight tolerances.
 */
export function integrate(
  s: EquilibriumSystem,
  k: Kinetics,
  T: number,
  c0: Record<string, number>,
  t0: number,
  duration: number,
  dtSample: number,
): { t: number[]; c: Record<string, number>[]; final: Record<string, number> } {
  const names = speciesOf(s);
  const idx = new Map(names.map((n, i) => [n, i]));
  const { kf, kr } = rateConstants(k, T);
  const f = (_t: number, y: Float64Array, dy: Float64Array) => {
    let rf = kf;
    for (const r of s.reactants) rf *= Math.max(0, y[idx.get(r.species) ?? 0] ?? 0) ** r.nu;
    let rr = kr;
    for (const p of s.products) rr *= Math.max(0, y[idx.get(p.species) ?? 0] ?? 0) ** p.nu;
    const rate = rf - rr;
    dy.fill(0);
    for (const r of s.reactants) {
      const i = idx.get(r.species) ?? 0;
      dy[i] = (dy[i] ?? 0) - r.nu * rate;
    }
    for (const p of s.products) {
      const i = idx.get(p.species) ?? 0;
      dy[i] = (dy[i] ?? 0) + p.nu * rate;
    }
  };
  const y = Float64Array.from(names.map((n) => c0[n] ?? 0));
  const ts: number[] = [t0];
  const cs: Record<string, number>[] = [{ ...c0 }];
  let t = t0;
  let cur = y;
  const steps = Math.max(1, Math.round(duration / dtSample));
  for (let i = 1; i <= steps; i++) {
    const t1 = t0 + (duration * i) / steps;
    const r = dopri5(f, cur, t, t1, { rtol: 1e-9, atol: 1e-12 });
    cur = Float64Array.from(r.y);
    t = t1;
    ts.push(t);
    cs.push(Object.fromEntries(names.map((n, j) => [n, Math.max(0, cur[j] ?? 0)])));
  }
  return { t: ts, c: cs, final: cs[cs.length - 1] ?? { ...c0 } };
}

/** "A + B ⇌ C" */
export function equationOf(s: EquilibriumSystem): string {
  const side = (t: EquilibriumSystem['reactants']) =>
    t.map((x) => `${x.nu > 1 ? String(x.nu) : ''}${x.species}`).join(' + ');
  return `${side(s.reactants)} ⇌ ${side(s.products)}`;
}
