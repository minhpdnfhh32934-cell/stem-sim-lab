/**
 * Steady DC circuits of two-terminal parts, by nodal analysis — the circuit bench's solver (pure,
 * deterministic; no three.js, DOM or Rapier). Every part is a conductance with, for a source, a
 * Norton current, so each node's equation is Kirchhoff's current law and no extra rows are needed.
 * Each connected group of parts is solved on its own, one of its nodes held at 0 V (a source's −
 * terminal when it has one): only potential differences have a meaning, and a group with no source
 * has every potential 0.
 *
 * - `resistor`: ohmic, R > 0 (wires, closed switches and meters are resistors of their own R).
 * - `source`: an EMF E with internal resistance r > 0, `a` its + terminal; with `limit` (A) it is a
 *   bench supply that holds its current at the limit (constant current) when the load would draw
 *   more, its terminal voltage then below E.
 * - `lamp`: a filament lamp rated `volts`/`watts`. Its hot resistance V²/P follows the empirical
 *   law of tungsten lamps, P ∝ V^1.6 (so R ∝ V^0.4), never below a cold resistance of a tenth of
 *   the rated one (tungsten at room temperature is about 1/10 to 1/15 of its working resistance).
 *   Solved by fixed-point iteration on R, which contracts (R grows slower than V).
 *
 * `amps[k]` is the current through part k from its `a` to its `b` terminal: a source delivering
 * power has a negative one (its current leaves by `a`). Nodes are numbered 0…nodeCount−1; a node no
 * part touches stays at 0 V.
 */
export type Part =
  | { readonly kind: 'resistor'; readonly a: number; readonly b: number; readonly ohms: number }
  | {
      readonly kind: 'source';
      readonly a: number;
      readonly b: number;
      readonly volts: number;
      readonly ohms: number;
      readonly limit?: number;
    }
  | {
      readonly kind: 'lamp';
      readonly a: number;
      readonly b: number;
      readonly volts: number;
      readonly watts: number;
    };

export interface Solution {
  /** Each node's potential (V), relative to its group's reference node. */
  readonly volts: Float64Array;
  /** Each part's current from `a` to `b` through it (A). */
  readonly amps: Float64Array;
  /** 1 for a supply holding its current limit. */
  readonly limited: Uint8Array;
  /** Each lamp's resistance as solved (Ω); NaN for other parts. */
  readonly ohms: Float64Array;
  /** False when the lamps or the limits had not settled after the iterations allowed. */
  readonly converged: boolean;
}

/** A lamp's resistance at the voltage `v` across it: R_rated·(|v|/V_rated)^0.4, at least R_rated/10. */
export function lampOhms(volts: number, watts: number, v: number): number {
  const hot = (volts * volts) / watts;
  return hot * Math.max(0.1, Math.pow(Math.abs(v) / volts, 0.4));
}

/** The output conductance of a supply in its current-limited mode (S): a 1 MΩ shunt. */
const LIMITED_SIEMENS = 1e-6;
const MAX_ITERATIONS = 200;
const TOLERANCE = 1e-9;

export function solveCircuit(nodeCount: number, parts: readonly Part[]): Solution {
  for (const p of parts) check(p, nodeCount);
  const volts = new Float64Array(nodeCount);
  const amps = new Float64Array(parts.length);
  const limited = new Uint8Array(parts.length);
  const ohms = new Float64Array(parts.length).fill(NaN);
  parts.forEach((p, k) => {
    if (p.kind === 'lamp') ohms[k] = lampOhms(p.volts, p.watts, p.volts);
  });

  const groups = connectedGroups(nodeCount, parts);
  let converged = false;
  for (let iteration = 0; iteration < MAX_ITERATIONS && !converged; iteration++) {
    for (const group of groups) solveGroup(group, parts, ohms, limited, volts);
    converged = true;
    parts.forEach((p, k) => {
      const v = (volts[p.a] ?? 0) - (volts[p.b] ?? 0);
      if (p.kind === 'lamp') {
        const next = lampOhms(p.volts, p.watts, v);
        const now = ohms[k] ?? next;
        if (Math.abs(next - now) > TOLERANCE * now) converged = false;
        ohms[k] = Math.sqrt(now * next); // damped in the logarithm: settles without overshoot
      } else if (p.kind === 'source' && p.limit !== undefined) {
        // Current out of + in the voltage mode, (E − v)/r; the limited mode is right while the
        // voltage it makes stays below E.
        const out = (p.volts - v) / p.ohms;
        const want = limited[k] ? (v > p.volts ? 0 : 1) : out > p.limit ? 1 : 0;
        if (want !== limited[k]) {
          limited[k] = want;
          converged = false;
        }
      }
    });
  }

  parts.forEach((p, k) => {
    const v = (volts[p.a] ?? 0) - (volts[p.b] ?? 0);
    if (p.kind === 'resistor') amps[k] = v / p.ohms;
    else if (p.kind === 'lamp') amps[k] = v / (ohms[k] ?? 1);
    else if (limited[k]) amps[k] = -(p.limit ?? 0) + v * LIMITED_SIEMENS;
    else amps[k] = (v - p.volts) / p.ohms;
  });
  return { volts, amps, limited, ohms, converged };
}

function check(p: Part, nodeCount: number): void {
  const node = (n: number) => Number.isInteger(n) && n >= 0 && n < nodeCount;
  if (!node(p.a) || !node(p.b)) throw new Error(`Circuit part ${p.kind}: node out of range`);
  const positive = (x: number) => x > 0 && x < Infinity;
  if (p.kind === 'resistor' && !positive(p.ohms))
    throw new Error(`Circuit resistor: R must be finite and above 0, got ${p.ohms}`);
  if (p.kind === 'source') {
    if (!positive(p.ohms))
      throw new Error(`Circuit source: r must be finite and above 0, got ${p.ohms}`);
    if (!Number.isFinite(p.volts)) throw new Error(`Circuit source: E must be finite`);
    if (p.limit !== undefined && !positive(p.limit))
      throw new Error(`Circuit source: the current limit must be above 0, got ${p.limit}`);
  }
  if (p.kind === 'lamp' && (!positive(p.volts) || !positive(p.watts)))
    throw new Error(`Circuit lamp: its rating must be above 0`);
}

interface Group {
  /** The group's nodes; nodes[0] is its reference (0 V). */
  readonly nodes: number[];
  /** The parts with both ends in this group. */
  readonly parts: number[];
}

/** Nodes joined by parts, each group with its reference first (a source's − terminal if any). */
function connectedGroups(nodeCount: number, parts: readonly Part[]): Group[] {
  const root = Array.from({ length: nodeCount }, (_, i) => i);
  const find = (n: number): number => {
    while (root[n] !== n) n = root[n] = root[root[n] ?? n] ?? n;
    return n;
  };
  for (const p of parts) root[find(p.a)] = find(p.b);
  const byRoot = new Map<number, Group>();
  const touched = new Set<number>();
  parts.forEach((p, k) => {
    const r = find(p.a);
    let group = byRoot.get(r);
    if (!group) byRoot.set(r, (group = { nodes: [], parts: [] }));
    group.parts.push(k);
    for (const n of [p.a, p.b]) {
      if (touched.has(n)) continue;
      touched.add(n);
      group.nodes.push(n);
    }
  });
  for (const group of byRoot.values()) {
    const source = group.parts.map((k) => parts[k]).find((p) => p?.kind === 'source');
    if (!source) continue;
    const at = group.nodes.indexOf(source.b);
    group.nodes.splice(at, 1);
    group.nodes.unshift(source.b);
  }
  return [...byRoot.values()];
}

/** One linear solve of a group, lamps at their current resistance, limits in their current mode. */
function solveGroup(
  group: Group,
  parts: readonly Part[],
  ohms: Float64Array,
  limited: Uint8Array,
  volts: Float64Array,
): void {
  const nodes = group.nodes;
  const n = nodes.length - 1; // the reference is not an unknown
  volts[nodes[0] ?? 0] = 0;
  if (n === 0) return;
  const index = new Map(nodes.map((node, i) => [node, i - 1])); // reference → −1
  const w = n + 1;
  const m = new Float64Array(n * w); // [G | I], row-major
  const at = (r: number, c: number) => m[r * w + c] ?? 0;
  const add = (r: number, c: number, x: number) => (m[r * w + c] = at(r, c) + x);
  const stamp = (a: number, b: number, g: number, i: number) => {
    // A conductance g from a to b and a current i pushed into a (out of b).
    const ia = index.get(a) ?? -1;
    const ib = index.get(b) ?? -1;
    if (ia >= 0) {
      add(ia, ia, g);
      add(ia, n, i);
    }
    if (ib >= 0) {
      add(ib, ib, g);
      add(ib, n, -i);
    }
    if (ia >= 0 && ib >= 0) {
      add(ia, ib, -g);
      add(ib, ia, -g);
    }
  };
  for (const k of group.parts) {
    const p = parts[k];
    if (!p) continue;
    if (p.kind === 'resistor') stamp(p.a, p.b, 1 / p.ohms, 0);
    else if (p.kind === 'lamp') stamp(p.a, p.b, 1 / (ohms[k] ?? 1), 0);
    else if (limited[k]) stamp(p.a, p.b, LIMITED_SIEMENS, p.limit ?? 0);
    else stamp(p.a, p.b, 1 / p.ohms, p.volts / p.ohms);
  }
  // Gaussian elimination with partial pivoting (G is symmetric positive definite: never singular).
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(at(r, c)) > Math.abs(at(pivot, c))) pivot = r;
    if (pivot !== c)
      for (let j = c; j < w; j++) {
        const t = at(c, j);
        m[c * w + j] = at(pivot, j);
        m[pivot * w + j] = t;
      }
    const d = at(c, c);
    for (let r = c + 1; r < n; r++) {
      const f = at(r, c) / d;
      if (f === 0) continue;
      for (let j = c; j < w; j++) add(r, j, -f * at(c, j));
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = at(r, n);
    for (let j = r + 1; j < n; j++) s -= at(r, j) * (volts[nodes[j + 1] ?? 0] ?? 0);
    volts[nodes[r + 1] ?? 0] = s / at(r, r);
  }
}
