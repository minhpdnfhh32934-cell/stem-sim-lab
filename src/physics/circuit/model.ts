/**
 * Direct-current circuit (VL11 KNTT Bài 23–25): a source of emf E and internal resistance r feeding
 * an external circuit of one to three resistors. Ideal wires, ammeters and voltmeters; E and r do
 * not change. `solveCircuit` uses the series/parallel formulas the textbook teaches; `nodalSolve`
 * is an independent check (Kirchhoff's current law at every node, a linear system) that never
 * uses those formulas.
 */
import type { Params } from '../types';

/** External circuit layouts (the `layout` choice). */
export const LAYOUT = {
  one: 0,
  series2: 1,
  series3: 2,
  parallel2: 3,
  parallel3: 4,
  /** R₁ nt (R₂ ∥ R₃) */
  seriesParallel: 5,
  /** (R₁ nt R₂) ∥ R₃ */
  parallelSeries: 6,
} as const;

/** How many resistors each layout uses. */
export const RESISTORS: Record<number, 1 | 2 | 3> = {
  [LAYOUT.one]: 1,
  [LAYOUT.series2]: 2,
  [LAYOUT.series3]: 3,
  [LAYOUT.parallel2]: 2,
  [LAYOUT.parallel3]: 3,
  [LAYOUT.seriesParallel]: 3,
  [LAYOUT.parallelSeries]: 3,
};

export interface Circuit {
  layout: number;
  /** Electromotive force E (V). */
  emf: number;
  /** Internal resistance r (Ω), ≥ 0. */
  r: number;
  /** R₁, R₂, R₃ (Ω); a layout uses the first RESISTORS[layout]. */
  R: [number, number, number];
}

export function circuitInput(p: Params): Circuit {
  const layout = Math.round(p.layout ?? LAYOUT.series2);
  return {
    layout: layout in RESISTORS ? layout : LAYOUT.series2,
    emf: p.emf ?? 12,
    r: p.rInt ?? 0,
    R: [p.R1 ?? 4, p.R2 ?? 6, p.R3 ?? 12],
  };
}

export const resistorCount = (c: Circuit): 1 | 2 | 3 => RESISTORS[c.layout] ?? 2;

export interface Part {
  R: number;
  I: number;
  U: number;
  P: number;
}

export interface CircuitResult {
  /** Resistance of the external circuit R_N. */
  RN: number;
  /** Current through the source (main branch). */
  I: number;
  /** Voltage across the source's terminals = across the external circuit. */
  U: number;
  /** Power delivered to the external circuit, U·I. */
  Pout: number;
  /** Power of the source, E·I. */
  Psource: number;
  /** Efficiency U/E. */
  H: number;
  /** I, U and P of R₁, R₂, R₃ in order (only the used ones). */
  parts: Part[];
}

const par = (a: number, b: number) => (a * b) / (a + b);
const part = (R: number, I: number): Part => ({ R, I, U: I * R, P: I * I * R });

function totals(c: Circuit, RN: number) {
  const I = c.emf / (RN + c.r);
  const U = I * RN;
  return { RN, I, U, Pout: U * I, Psource: c.emf * I, H: U / c.emf };
}

/** The textbook way: R_N from series/parallel rules, I = E/(R_N + r), then each resistor. */
export function solveCircuit(c: Circuit): CircuitResult {
  const [R1, R2, R3] = c.R;
  switch (c.layout) {
    case LAYOUT.one: {
      const t = totals(c, R1);
      return { ...t, parts: [part(R1, t.I)] };
    }
    case LAYOUT.series2: {
      const t = totals(c, R1 + R2);
      return { ...t, parts: [part(R1, t.I), part(R2, t.I)] };
    }
    case LAYOUT.series3: {
      const t = totals(c, R1 + R2 + R3);
      return { ...t, parts: [part(R1, t.I), part(R2, t.I), part(R3, t.I)] };
    }
    case LAYOUT.parallel2: {
      const t = totals(c, par(R1, R2));
      return { ...t, parts: [part(R1, t.U / R1), part(R2, t.U / R2)] };
    }
    case LAYOUT.parallel3: {
      const t = totals(c, 1 / (1 / R1 + 1 / R2 + 1 / R3));
      return { ...t, parts: [part(R1, t.U / R1), part(R2, t.U / R2), part(R3, t.U / R3)] };
    }
    case LAYOUT.seriesParallel: {
      const t = totals(c, R1 + par(R2, R3));
      const U23 = t.I * par(R2, R3);
      return { ...t, parts: [part(R1, t.I), part(R2, U23 / R2), part(R3, U23 / R3)] };
    }
    default: {
      // (R₁ nt R₂) ∥ R₃
      const t = totals(c, par(R1 + R2, R3));
      const I12 = t.U / (R1 + R2);
      return { ...t, parts: [part(R1, I12), part(R2, I12), part(R3, t.U / R3)] };
    }
  }
}

/**
 * The external circuit as resistors between nodes: node 0 is the − terminal, node 1 the +
 * terminal, node 2 (and 3) the junctions. [from, to] per resistor, in R₁, R₂, R₃ order.
 */
export function netlist(layout: number): { nodes: number; edges: [number, number][] } {
  switch (layout) {
    case LAYOUT.one:
      return { nodes: 2, edges: [[1, 0]] };
    case LAYOUT.series2:
      return {
        nodes: 3,
        edges: [
          [1, 2],
          [2, 0],
        ],
      };
    case LAYOUT.series3:
      return {
        nodes: 4,
        edges: [
          [1, 2],
          [2, 3],
          [3, 0],
        ],
      };
    case LAYOUT.parallel2:
      return {
        nodes: 2,
        edges: [
          [1, 0],
          [1, 0],
        ],
      };
    case LAYOUT.parallel3:
      return {
        nodes: 2,
        edges: [
          [1, 0],
          [1, 0],
          [1, 0],
        ],
      };
    case LAYOUT.seriesParallel:
      return {
        nodes: 3,
        edges: [
          [1, 2],
          [2, 0],
          [2, 0],
        ],
      };
    default:
      return {
        nodes: 3,
        edges: [
          [1, 2],
          [2, 0],
          [1, 0],
        ],
      };
  }
}

/** Solves A·x = b in place (Gaussian elimination with partial pivoting; tiny systems only). */
function linearSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i]?.[k] ?? 0) > Math.abs(A[p]?.[k] ?? 0)) p = i;
    [A[k], A[p]] = [A[p] ?? [], A[k] ?? []];
    [b[k], b[p]] = [b[p] ?? 0, b[k] ?? 0];
    const pivot = A[k]?.[k] ?? 0;
    for (let i = k + 1; i < n; i++) {
      const f = (A[i]?.[k] ?? 0) / pivot;
      for (let j = k; j < n; j++) (A[i] as number[])[j] = (A[i]?.[j] ?? 0) - f * (A[k]?.[j] ?? 0);
      b[i] = (b[i] ?? 0) - f * (b[k] ?? 0);
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i] ?? 0;
    for (let j = i + 1; j < n; j++) s -= (A[i]?.[j] ?? 0) * (x[j] ?? 0);
    x[i] = s / (A[i]?.[i] ?? 1);
  }
  return x;
}

/**
 * Node voltages from Kirchhoff's current law (node 0 = 0 V). With r > 0 the source is a current
 * E/r into node 1 with conductance 1/r to node 0 (Norton); with r = 0 node 1 is held at E.
 */
export function nodeVoltages(c: Circuit): number[] {
  const { nodes, edges } = netlist(c.layout);
  const fixed = c.r === 0;
  // Unknowns: nodes 1… (or 2… when node 1 is held at E).
  const first = fixed ? 2 : 1;
  const n = nodes - first;
  const V = new Array<number>(nodes).fill(0);
  if (fixed) V[1] = c.emf;
  if (n === 0) return V;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  const row = (node: number) => node - first;
  edges.forEach(([a, z], i) => {
    const g = 1 / (c.R[i] ?? 1);
    for (const [u, w] of [
      [a, z],
      [z, a],
    ] as const) {
      if (u < first) continue;
      (A[row(u)] as number[])[row(u)] = (A[row(u)]?.[row(u)] ?? 0) + g;
      if (w >= first) (A[row(u)] as number[])[row(w)] = (A[row(u)]?.[row(w)] ?? 0) - g;
      else b[row(u)] = (b[row(u)] ?? 0) + g * (V[w] ?? 0);
    }
  });
  if (!fixed) {
    (A[0] as number[])[0] = (A[0]?.[0] ?? 0) + 1 / c.r;
    b[0] = (b[0] ?? 0) + c.emf / c.r;
  }
  linearSolve(A, b).forEach((v, k) => (V[k + first] = v));
  return V;
}

/** The same quantities as `solveCircuit`, from the node voltages only. */
export function nodalSolve(c: Circuit): CircuitResult {
  const V = nodeVoltages(c);
  const { edges } = netlist(c.layout);
  const parts = edges.map(([a, z], i) => {
    const R = c.R[i] ?? 1;
    const U = (V[a] ?? 0) - (V[z] ?? 0);
    return { R, I: U / R, U, P: (U * U) / R };
  });
  const U = V[1] ?? 0;
  // Current leaving the + terminal into the external circuit.
  const I = edges.reduce((s, [a, z], i) => {
    const flow = ((V[a] ?? 0) - (V[z] ?? 0)) / (c.R[i] ?? 1);
    return s + (a === 1 ? flow : z === 1 ? -flow : 0);
  }, 0);
  return { RN: U / I, I, U, Pout: U * I, Psource: c.emf * I, H: U / c.emf, parts };
}
