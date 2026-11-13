import { describe, expect, it } from 'vitest';
import {
  atomicStructureModel as model,
  filling,
  position,
  shells,
  unpaired,
} from './atomicStructure';

// Configurations as any data book gives them: O 1s² 2s² 2p⁴ (2, 6; two unpaired), Na 2, 8, 1,
// Fe [Ar] 3d⁶ 4s² (2, 8, 14, 2; four unpaired), Cr [Ar] 3d⁵ 4s¹ (six unpaired), Cu [Ar] 3d¹⁰ 4s¹.

const run = (z: number) => {
  const inputs = { atomicNumber: z, electronTime: 0.25 };
  const state = new Float64Array(model.variables.length);
  model.init(inputs, state);
  for (let i = 0; i < 1e5 && !model.isComplete?.(state, inputs); i++)
    model.step(state, 0.05, inputs);
  return Object.fromEntries(model.variables.map((v, i) => [v, state[i] ?? NaN]));
};

describe('atomic structure', () => {
  it('fills by the n + l rule, with chromium’s and copper’s exceptions', () => {
    expect(filling(8, 8)).toEqual([2, 2, 4, 0, 0, 0, 0, 0]);
    expect(filling(26, 26)).toEqual([2, 2, 6, 2, 6, 2, 6, 0]);
    expect(filling(24, 24)).toEqual([2, 2, 6, 2, 6, 1, 5, 0]);
    expect(filling(29, 29)).toEqual([2, 2, 6, 2, 6, 1, 10, 0]);
    expect(filling(35, 35)).toEqual([2, 2, 6, 2, 6, 2, 10, 5]);
  });

  it('counts shells and unpaired electrons (Hund)', () => {
    expect(shells(filling(11, 11))).toEqual([2, 8, 1, 0]);
    expect(shells(filling(26, 26))).toEqual([2, 8, 14, 2]);
    expect(unpaired(filling(8, 8))).toBe(2);
    expect(unpaired(filling(7, 7))).toBe(3);
    expect(unpaired(filling(26, 26))).toBe(4);
    expect(unpaired(filling(24, 24))).toBe(6);
    expect(unpaired(filling(10, 10))).toBe(0);
  });

  it('places each element in its period and group', () => {
    const where = (z: number) => position(z);
    expect(where(1)).toEqual({ period: 1, group: 1 });
    expect(where(2)).toEqual({ period: 1, group: 18 });
    expect(where(6)).toEqual({ period: 2, group: 14 });
    expect(where(17)).toEqual({ period: 3, group: 17 });
    expect(where(20)).toEqual({ period: 4, group: 2 });
    expect(where(26)).toEqual({ period: 4, group: 8 });
    expect(where(29)).toEqual({ period: 4, group: 11 });
    expect(where(30)).toEqual({ period: 4, group: 12 });
    expect(where(35)).toEqual({ period: 4, group: 17 });
    expect(where(36)).toEqual({ period: 4, group: 18 });
  });

  it('puts the electrons in one by one, ending in the ground state', () => {
    const end = run(17);
    expect(end.electrons).toBe(17);
    expect([end.shellK, end.shellL, end.shellM, end.shellN]).toEqual([2, 8, 7, 0]);
    expect(end.outerElectrons).toBe(7);
    expect(end.time).toBeCloseTo(17 * 0.25, 9);
    expect(model.predict!({ atomicNumber: 17, electronTime: 0.25 }).group).toBe(17);
  });
});
