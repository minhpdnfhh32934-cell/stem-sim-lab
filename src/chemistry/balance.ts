import { FormulaError, parseFormula, type ParsedFormula } from './formula';

/**
 * Chemical equation balancing by linear algebra (MASTER_PROMPT §6.3): conservation of each
 * element and of charge gives a homogeneous system A·x = 0; the balanced coefficients are
 * the smallest positive integer vector of its null space. Exact rational arithmetic
 * (BigInt), so there is no rounding.
 */

class Frac {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d = 1n) {
    if (d === 0n) throw new RangeError('division by zero');
    const g = gcd(n < 0n ? -n : n, d < 0n ? -d : d) || 1n;
    const sign = d < 0n ? -1n : 1n;
    this.n = (sign * n) / g;
    this.d = (sign * d) / g;
  }
  static of(x: number): Frac {
    return new Frac(BigInt(x));
  }
  add(o: Frac): Frac {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac): Frac {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    return new Frac(this.n * o.d, this.d * o.n);
  }
  isZero(): boolean {
    return this.n === 0n;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}
const lcm = (a: bigint, b: bigint) => (a / gcd(a, b)) * b;

/** Null space basis of an integer matrix (rows × cols), exact. */
export function nullSpace(matrix: number[][], cols: number): Frac[][] {
  const m = matrix.map((row) => Array.from({ length: cols }, (_, j) => Frac.of(row[j] ?? 0)));
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < m.length; c++) {
    let p = r;
    while (p < m.length && m[p]?.[c]?.isZero()) p++;
    if (p === m.length) continue;
    [m[r], m[p]] = [m[p] ?? [], m[r] ?? []];
    const row = m[r] ?? [];
    const pv = row[c] ?? Frac.of(1);
    for (let j = 0; j < cols; j++) row[j] = (row[j] ?? Frac.of(0)).div(pv);
    for (let i = 0; i < m.length; i++) {
      if (i === r) continue;
      const f = m[i]?.[c];
      if (!f || f.isZero()) continue;
      const target = m[i] ?? [];
      for (let j = 0; j < cols; j++)
        target[j] = (target[j] ?? Frac.of(0)).sub(f.mul(row[j] ?? Frac.of(0)));
    }
    pivots.push(c);
    r++;
  }
  const free = Array.from({ length: cols }, (_, j) => j).filter((j) => !pivots.includes(j));
  return free.map((f) => {
    const v = Array.from({ length: cols }, () => Frac.of(0));
    v[f] = Frac.of(1);
    pivots.forEach((pc, i) => {
      v[pc] = Frac.of(0).sub(m[i]?.[f] ?? Frac.of(0));
    });
    return v;
  });
}

/** Scales a rational vector to the smallest integers (sign kept). */
function toIntegers(v: Frac[]): bigint[] {
  const den = v.reduce((acc, x) => lcm(acc, x.d), 1n);
  const ints = v.map((x) => (x.n * den) / x.d);
  const g = ints.reduce((acc, x) => gcd(acc, x < 0n ? -x : x), 0n) || 1n;
  return ints.map((x) => x / g);
}

export interface Species {
  text: string;
  formula: ParsedFormula;
  /** Coefficient written by the user (null when omitted). */
  given: number | null;
}

export interface ParsedEquation {
  reactants: Species[];
  products: Species[];
  reversible: boolean;
}

export class EquationError extends Error {
  override name = 'EquationError';
}

const ARROW = /\s*(?:<=>|⇌|<->|->|→|⟶|=>)\s*/;

/**
 * "Fe + O2 -> Fe2O3" (also "→", "⇌", or "=" when no other arrow is used, since "=" may
 * also be a double bond). Species are separated by " + " (with spaces).
 */
export function parseEquation(input: string): ParsedEquation {
  const parts = ARROW.test(input) ? input.split(ARROW) : input.split(/\s*=\s*/);
  if (parts.length !== 2) throw new EquationError('need exactly one arrow (->, →, = or ⇌)');
  const reversible = /<=>|⇌|<->/.test(input);
  const side = (s: string): Species[] =>
    s
      .split(/\s\+\s|^\+\s|\s\+$/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((text) => {
        const m = /^(\d+)\s*(.+)$/.exec(text);
        // "2H2O" → coefficient 2 unless the whole thing is a formula starting with a digit.
        const given = m ? Number(m[1]) : null;
        const body = m?.[2] ?? text;
        try {
          return { text: body, formula: parseFormula(body), given };
        } catch (e) {
          throw new EquationError(e instanceof FormulaError ? e.message : String(e));
        }
      });
  const reactants = side(parts[0] ?? '');
  const products = side(parts[1] ?? '');
  if (!reactants.length || !products.length) throw new EquationError('both sides need species');
  return { reactants, products, reversible };
}

export type BalanceResult =
  | { kind: 'balanced'; coefficients: number[] }
  | { kind: 'impossible'; reason: 'noSolution' | 'negative' }
  | { kind: 'ambiguous'; dimension: number };

/** Conservation matrix: one row per element and one for charge; products negative. */
export function conservationMatrix(eq: ParsedEquation): { rows: number[][]; labels: string[] } {
  const all = [...eq.reactants, ...eq.products];
  const elements = [...new Set(all.flatMap((s) => [...s.formula.counts.keys()]))];
  const sign = (i: number) => (i < eq.reactants.length ? 1 : -1);
  const rows = elements.map((el) => all.map((s, i) => sign(i) * (s.formula.counts.get(el) ?? 0)));
  const labels = [...elements];
  if (all.some((s) => s.formula.charge !== 0)) {
    rows.push(all.map((s, i) => sign(i) * s.formula.charge));
    labels.push('charge');
  }
  return { rows, labels };
}

export function balance(eq: ParsedEquation): BalanceResult {
  const n = eq.reactants.length + eq.products.length;
  const { rows } = conservationMatrix(eq);
  const basis = nullSpace(rows, n);
  if (basis.length === 0) return { kind: 'impossible', reason: 'noSolution' };
  if (basis.length > 1) return { kind: 'ambiguous', dimension: basis.length };
  const ints = toIntegers(basis[0] ?? []);
  const allPos = ints.every((x) => x > 0n);
  const allNeg = ints.every((x) => x < 0n);
  if (!allPos && !allNeg) return { kind: 'impossible', reason: 'negative' };
  return { kind: 'balanced', coefficients: ints.map((x) => Number(allNeg ? -x : x)) };
}

/** Checks coefficients against conservation of every element and of charge. */
export function checkCoefficients(
  eq: ParsedEquation,
  coefficients: number[],
): {
  ok: boolean;
  unbalanced: string[];
} {
  const { rows, labels } = conservationMatrix(eq);
  const unbalanced = rows
    .map(
      (row, i) =>
        [labels[i] ?? '?', row.reduce((s, a, j) => s + a * (coefficients[j] ?? 0), 0)] as const,
    )
    .filter(([, sum]) => sum !== 0)
    .map(([label]) => label);
  return { ok: unbalanced.length === 0, unbalanced };
}
