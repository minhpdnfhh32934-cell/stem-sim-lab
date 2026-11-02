import { describe, expect, it } from 'vitest';
import { useEqStore } from './eqStore';
import { chemicalEquilibrium } from './modules';

describe('chemical equilibrium module state', () => {
  it('a restored file keeps the activation energies inside the panel range', () => {
    const state = chemicalEquilibrium.state;
    if (!state) throw new Error('module has no state binding');
    const kinetics = { ...useEqStore.getState().kinetics, eaf: -10e3, ear: 5e6 };
    state.set({ kinetics });
    expect(useEqStore.getState().kinetics).toMatchObject({ eaf: 0, ear: 300e3 });
  });
});
