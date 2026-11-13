import { describe, expect, it } from 'vitest';
import { lampOhms, type Part, solveCircuit } from './circuitSolver';

// Each case against its analytic answer.
const R = (a: number, b: number, ohms: number): Part => ({ kind: 'resistor', a, b, ohms });
const E = (a: number, b: number, volts: number, ohms: number, limit?: number): Part =>
  limit === undefined
    ? { kind: 'source', a, b, volts, ohms }
    : { kind: 'source', a, b, volts, ohms, limit };

describe('solveCircuit', () => {
  it('a cell with internal resistance on a load: I = E/(R + r), U = E − I·r', () => {
    const s = solveCircuit(2, [E(1, 0, 4.5, 0.5), R(1, 0, 8.5)]);
    expect(s.amps[1]).toBeCloseTo(0.5, 12);
    expect(s.amps[0]).toBeCloseTo(-0.5, 12); // delivering: out of +
    expect(s.volts[1]! - s.volts[0]!).toBeCloseTo(4.25, 12);
  });

  it('series and parallel: the voltage divides as R, the current as 1/R', () => {
    // 12 V (r 1 mΩ) → 10 Ω → node 2 → (20 Ω ∥ 30 Ω = 12 Ω) → back.
    const s = solveCircuit(3, [E(1, 0, 12, 1e-3), R(1, 2, 10), R(2, 0, 20), R(2, 0, 30)]);
    const i = 12 / (10 + 12 + 1e-3);
    expect(s.amps[1]).toBeCloseTo(i, 9);
    expect(s.amps[2]).toBeCloseTo((i * 12) / 20, 9);
    expect(s.amps[3]).toBeCloseTo((i * 12) / 30, 9);
    expect(s.volts[2]! - s.volts[0]!).toBeCloseTo(i * 12, 9);
  });

  it('a balanced Wheatstone bridge carries no current through its middle', () => {
    // 100/200 on one side, 150/300 on the other: same ratio.
    const s = solveCircuit(4, [
      E(1, 0, 6, 0.01),
      R(1, 2, 100),
      R(2, 0, 200),
      R(1, 3, 150),
      R(3, 0, 300),
      R(2, 3, 47),
    ]);
    expect(Math.abs(s.amps[5]!)).toBeLessThan(1e-12);
  });

  it('two cells in parallel on a load (Millman), and groups apart are solved apart', () => {
    // 1.5 V r 0.2 and 1.2 V r 0.3 on 2 Ω: V = (1.5/0.2 + 1.2/0.3)/(1/0.2 + 1/0.3 + 1/2).
    const v = (1.5 / 0.2 + 1.2 / 0.3) / (1 / 0.2 + 1 / 0.3 + 1 / 2);
    const s = solveCircuit(5, [E(1, 0, 1.5, 0.2), E(1, 0, 1.2, 0.3), R(1, 0, 2), R(3, 4, 5)]);
    expect(s.volts[1]! - s.volts[0]!).toBeCloseTo(v, 12);
    expect(s.amps[3]).toBe(0); // a resistor on its own: no source, no current
    expect(s.volts[2]).toBe(0); // a node nothing touches
  });

  it('a bench supply on a short holds its current limit, its voltage falling', () => {
    // 12 V, 10 mΩ output, limit 3 A, on 0.05 Ω: it would give 200 A.
    const s = solveCircuit(2, [E(1, 0, 12, 0.01, 3), R(1, 0, 0.05)]);
    expect(s.limited[0]).toBe(1);
    expect(s.amps[1]).toBeCloseTo(3, 4);
    expect(s.volts[1]! - s.volts[0]!).toBeCloseTo(0.15, 4);
    // On 10 Ω it draws 1.2 A, under the limit: the voltage mode.
    const t = solveCircuit(2, [E(1, 0, 12, 0.01, 3), R(1, 0, 10)]);
    expect(t.limited[0]).toBe(0);
    expect(t.amps[1]).toBeCloseTo(12 / 10.01, 9);
  });

  it('a lamp at its rated voltage takes its rated power; at half, P ∝ V^1.6', () => {
    const lamp: Part = { kind: 'lamp', a: 1, b: 0, volts: 6, watts: 3 };
    const at = (v: number) => {
      const s = solveCircuit(2, [E(1, 0, v, 1e-6), lamp]);
      expect(s.converged).toBe(true);
      return (s.volts[1]! - s.volts[0]!) * s.amps[1]!;
    };
    expect(at(6)).toBeCloseTo(3, 4);
    expect(at(3)).toBeCloseTo(3 * Math.pow(0.5, 1.6), 4);
    expect(lampOhms(6, 3, 0)).toBeCloseTo(1.2, 12); // cold: a tenth of 12 Ω
  });

  it('a lamp in series with a resistor settles where its own law holds', () => {
    // 6 V, 6 V 3 W lamp, 10 Ω: I·(R_lamp(V_L) + 10) = 6.
    const s = solveCircuit(3, [
      E(1, 0, 6, 1e-6),
      R(1, 2, 10),
      { kind: 'lamp', a: 2, b: 0, volts: 6, watts: 3 },
    ]);
    expect(s.converged).toBe(true);
    const vl = s.volts[2]! - s.volts[0]!;
    expect(s.ohms[2]).toBeCloseTo(lampOhms(6, 3, vl), 6);
    expect(s.amps[2]! * (s.ohms[2]! + 10)).toBeCloseTo(6, 6);
  });

  it('refuses a zero resistance or a node that is not there', () => {
    expect(() => solveCircuit(2, [R(0, 1, 0)])).toThrow(/above 0/);
    expect(() => solveCircuit(2, [R(0, 2, 1)])).toThrow(/out of range/);
  });
});
