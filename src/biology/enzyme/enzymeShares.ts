/**
 * Numbers of the enzyme 3D view (pure, tested). The lesson's rate law is the rapid-equilibrium
 * Michaelis–Menten model with an inhibitor (`enzyme.ts`, `apparent`); the same assumptions give
 * how the enzyme is shared between its forms at a substrate concentration [S]:
 *
 *   s = [S]/Km, i = [I]/Ki
 *   none:            E : ES                 = 1 : s
 *   competitive:     E : ES : EI            = 1 : s : i
 *   noncompetitive:  E : ES : EI : ESI      = 1 : s : i : s·i
 *   uncompetitive:   E : ES : ESI           = 1 : s : s·i
 *
 * and v = Vmax·[ES]/[E]total in every case — the lesson's own rate (tested). The view draws a
 * fixed number of enzyme molecules split in these shares (rounded so they add up).
 */
import type { EnzymeParams } from './enzyme';

export interface EnzymeShares {
  /** Free enzyme. */
  E: number;
  /** Enzyme with substrate bound (the only form that makes product). */
  ES: number;
  /** Enzyme with inhibitor bound. */
  EI: number;
  /** Enzyme with both bound (non-/uncompetitive): makes no product. */
  ESI: number;
}

export function enzymeShares(p: EnzymeParams, S: number): EnzymeShares {
  const s = Math.max(0, S) / p.km;
  const i = p.kind === 'none' ? 0 : Math.max(0, p.inhibitor) / p.ki;
  const w = { E: 1, ES: s, EI: 0, ESI: 0 };
  if (p.kind === 'competitive') w.EI = i;
  if (p.kind === 'noncompetitive') {
    w.EI = i;
    w.ESI = s * i;
  }
  if (p.kind === 'uncompetitive') w.ESI = s * i;
  const total = w.E + w.ES + w.EI + w.ESI;
  return { E: w.E / total, ES: w.ES / total, EI: w.EI / total, ESI: w.ESI / total };
}

/**
 * Splits `n` molecules in the given shares, rounded so the counts add up to n exactly (largest
 * remainders first).
 */
export function splitCount(shares: EnzymeShares, n: number): EnzymeShares {
  const keys: (keyof EnzymeShares)[] = ['E', 'ES', 'EI', 'ESI'];
  const raw = keys.map((k) => shares[k] * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, k) => ({ k, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.k - b.k);
  for (const { k } of order) {
    if (left <= 0) break;
    out[k] = (out[k] ?? 0) + 1;
    left--;
  }
  return { E: out[0] ?? 0, ES: out[1] ?? 0, EI: out[2] ?? 0, ESI: out[3] ?? 0 };
}

/** Enzyme molecules drawn (illustrative number; the shares are the model's). */
export const ENZYMES_DRAWN = 24;
/** Most free substrate (or product, or inhibitor) molecules drawn. */
export const MOLECULES_MAX = 80;

/**
 * Concentration one drawn molecule stands for: the larger of the highest [S] shown and [I],
 * spread over MOLECULES_MAX molecules (the view says the value).
 */
export function perMolecule(sTop: number, inhibitor: number): number {
  return Math.max(1e-9, Math.max(sTop, inhibitor)) / MOLECULES_MAX;
}

export const moleculesFor = (c: number, per: number): number =>
  Math.max(0, Math.min(MOLECULES_MAX, Math.round(c / per)));
