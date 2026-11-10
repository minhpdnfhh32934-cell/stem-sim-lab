import { describe, expect, it } from 'vitest';
import { dopri5 } from '@/core/ode/dopri5';
import { EngineRunner } from '@/core/sim/runner';
import { CHALLENGES, optimum, startParams } from '@/learn/challenges';
import { CE, CircuitEngine } from './engine';
import {
  LAYOUT,
  RESISTORS,
  circuitInput,
  netlist,
  nodalSolve,
  nodeVoltages,
  solveCircuit,
  type Circuit,
} from './model';
import { dcCircuit } from './scenes';

const LAYOUTS = Object.values(LAYOUT);
/** A few circuits per layout, with and without internal resistance (deterministic values). */
function circuits(): Circuit[] {
  const out: Circuit[] = [];
  for (const layout of LAYOUTS) {
    for (const [emf, r, R1, R2, R3] of [
      [12, 0, 4, 6, 12],
      [9, 1.5, 2.5, 47, 0.5],
      [24, 0.2, 100, 33, 68],
    ] as const) {
      out.push({ layout, emf, r, R: [R1, R2, R3] });
    }
  }
  return out;
}
const close = (a: number, b: number, rel = 1e-12) => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));
};

describe('DC circuit model (VL11 Bài 23–25)', () => {
  it('every layout uses 1–3 resistors and has a matching netlist', () => {
    for (const layout of LAYOUTS) {
      expect(netlist(layout).edges).toHaveLength(RESISTORS[layout] ?? 0);
    }
  });

  it('series/parallel formulas agree with nodal analysis (Kirchhoff, a linear system)', () => {
    for (const c of circuits()) {
      const a = solveCircuit(c);
      const b = nodalSolve(c);
      for (const k of ['RN', 'I', 'U', 'Pout', 'Psource', 'H'] as const) close(a[k], b[k]);
      a.parts.forEach((p, i) => {
        close(p.I, b.parts[i]?.I ?? Number.NaN);
        close(p.U, b.parts[i]?.U ?? Number.NaN);
      });
    }
  });

  it('power balance: Σ Pₖ + I²r = E·I, and U = E − I·r', () => {
    for (const c of circuits()) {
      const s = solveCircuit(c);
      close(s.parts.reduce((t, p) => t + p.P, 0) + s.I * s.I * c.r, c.emf * s.I);
      close(s.U, c.emf - s.I * c.r);
    }
  });

  it('DOPRI5: small capacitors at the nodes charge to the nodal voltages', () => {
    for (const c of circuits()) {
      const { nodes, edges } = netlist(c.layout);
      const fixed = c.r === 0;
      const first = fixed ? 2 : 1;
      const n = nodes - first;
      if (n === 0) continue;
      const V = (y: ArrayLike<number>, node: number) =>
        node === 0 ? 0 : node < first ? c.emf : (y[node - first] ?? 0);
      // C·dV/dt = current into the node; C = 1 mF keeps every time constant below 0.2 s.
      const C = 1e-3;
      const res = dopri5(
        (_t, y, dy) => {
          for (let k = 0; k < n; k++) dy[k] = 0;
          edges.forEach(([a, z], i) => {
            const flow = (V(y, a) - V(y, z)) / (c.R[i] ?? 1);
            if (a >= first) dy[a - first] = (dy[a - first] ?? 0) - flow / C;
            if (z >= first) dy[z - first] = (dy[z - first] ?? 0) + flow / C;
          });
          if (!fixed) dy[0] = (dy[0] ?? 0) + (c.emf - V(y, 1)) / c.r / C;
        },
        new Array<number>(n).fill(0),
        0,
        20,
      );
      const exact = nodeVoltages(c);
      for (let k = 0; k < n; k++) close(res.y[k] ?? 0, exact[k + first] ?? 0, 1e-6);
    }
  });

  it('the engine holds the steady state the solution reports', () => {
    const p = { ...dcCircuit.defaults, layout: LAYOUT.seriesParallel, rInt: 1 };
    const e = new CircuitEngine();
    e.reset(p);
    const run = new EngineRunner(e, 1000);
    const st = new Float64Array(4);
    const s = solveCircuit(circuitInput(p));
    for (let i = 0; i < 30; i++) {
      run.frame(1 / 60, 1);
      e.readState(st);
      expect(st[CE.I]).toBe(s.I);
      expect(st[CE.U]).toBe(s.U);
    }
  });
});

describe('DC circuit scene', () => {
  it('defaults: 12 V, r = 0, 4 Ω + 6 Ω in series → I = 1,2 A, U = 12 V; every answer is cross-checked', () => {
    const sol = dcCircuit.solve(dcCircuit.defaults, 'vi');
    const by = (id: string) => sol.answers.find((a) => a.id === id);
    close(by('I')?.value ?? 0, 1.2);
    close(by('U')?.value ?? 0, 12);
    for (const a of sol.answers) close(a.value, a.check ?? Number.NaN, 1e-12);
  });

  it('refuses R ≤ 0 for a used resistor and r < 0; an unused resistor is not checked', () => {
    expect(dcCircuit.validate?.({ ...dcCircuit.defaults, R2: 0 })).toHaveLength(1);
    expect(dcCircuit.validate?.({ ...dcCircuit.defaults, rInt: -1 })).toHaveLength(1);
    expect(dcCircuit.validate?.({ ...dcCircuit.defaults, layout: LAYOUT.one, R2: 0 })).toEqual([]);
  });

  it('only the used resistors are shown and pickable', () => {
    const p = { ...dcCircuit.defaults, layout: LAYOUT.one };
    expect(dcCircuit.params.filter((d) => d.when?.(p) ?? true).map((d) => d.key)).toEqual([
      'layout',
      'emf',
      'R1',
      'rInt',
    ]);
    expect(dcCircuit.bodies.filter((b) => b.active?.(p) ?? true).map((b) => b.id)).toEqual(['R1']);
  });

  it('challenge: the external power is largest when R₁ is within one slider step of r', () => {
    const c = CHALLENGES.find((x) => x.id === 'dcCircuit.maxPower');
    if (!c) throw new Error('no challenge');
    const best = optimum(dcCircuit, c, startParams(dcCircuit, c));
    const r = best.params.rInt ?? 0;
    expect(r).toBeGreaterThan(0);
    expect(Math.abs((best.params.R1 ?? 0) - r)).toBeLessThanOrEqual(0.5);
    // P_max = E²/(4r).
    close(best.value, (12 * 12) / (4 * r), 1e-3);
  });
});
