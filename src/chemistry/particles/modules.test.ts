import { beforeEach, describe, expect, it } from 'vitest';
import { resetEq, useEqStore } from './eqStore';
import { chemicalEquilibrium } from './modules';

const DEFAULT = { kf0: 1, kr0: 0.25, eaf: 50e3, ear: 70e3, T0: 298.15 };

function restore(state: Record<string, unknown>) {
  const binding = chemicalEquilibrium.state;
  if (!binding) throw new Error('module has no state binding');
  binding.set(state);
}

beforeEach(() => {
  resetEq({ systemId: 'a+b-c', kinetics: DEFAULT });
});

describe('chemical equilibrium module state', () => {
  it('a restored file keeps the activation energies inside the panel range', () => {
    restore({ kinetics: { ...DEFAULT, eaf: -10e3, ear: 5e6 } });
    expect(useEqStore.getState().kinetics).toMatchObject({ eaf: 0, ear: 300e3 });
  });

  it('"kinetics": null keeps the current kinetics', () => {
    restore({ kinetics: null, initial: null });
    expect(useEqStore.getState().kinetics).toEqual(DEFAULT);
    expect(useEqStore.getState().initial).toEqual({ A: 1, B: 1, C: 0 });
  });

  it('a partial or wrongly typed kinetics object is merged field by field', () => {
    restore({ kinetics: { eaf: 80e3, kf0: 'fast', ear: Number.NaN } });
    expect(useEqStore.getState().kinetics).toEqual({ ...DEFAULT, eaf: 80e3 });
  });
});
