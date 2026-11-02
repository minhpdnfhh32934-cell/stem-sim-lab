import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { EquilibriumBottom, EquilibriumPanel, EquilibriumStage } from './EquilibriumViews';
import { EA_MAX_KJ, resetEq, useEqStore } from './eqStore';
import { GasBottom } from './GasBottom';
import { resetGas, useGasStore } from './gasStore';
import { GasPanel } from './GasPanel';
import { CollisionStage, MaxwellStage } from './views';

const gasState = bindStore(useGasStore, ['gas', 'T', 'n', 'start', 'eaKJ', 'reversible'], (p) => {
  useGasStore.setState(p);
  resetGas();
});

export const maxwellBoltzmann: ModuleView = {
  title: L('Phân bố Maxwell–Boltzmann', 'Maxwell–Boltzmann distribution'),
  Stage: MaxwellStage,
  Panel: GasPanel,
  Bottom: GasBottom,
  bottomTitle: L('Phân bố tốc độ', 'Speed distribution'),
  state: gasState,
};
export const collisionTheory: ModuleView = {
  title: L('Thuyết va chạm', 'Collision theory'),
  Stage: CollisionStage,
  Panel: GasPanel,
  Bottom: GasBottom,
  bottomTitle: L('Số hạt theo thời gian', 'Particles over time'),
  state: gasState,
};
export const chemicalEquilibrium: ModuleView = {
  title: L('Cân bằng hóa học', 'Chemical equilibrium'),
  Stage: EquilibriumStage,
  Panel: EquilibriumPanel,
  Bottom: EquilibriumBottom,
  bottomTitle: L('Nồng độ theo thời gian', 'Concentrations over time'),
  state: bindStore(useEqStore, ['systemId', 'kinetics', 'T', 'initial'], (p) => {
    // A hand-edited file keeps Eₐ in the panel's range (the energy diagram needs Eₐ ≥ 0).
    const ea = (v: number) => (Number.isFinite(v) ? Math.min(EA_MAX_KJ * 1000, Math.max(0, v)) : 0);
    const k = p.kinetics;
    resetEq(k ? { ...p, kinetics: { ...k, eaf: ea(k.eaf), ear: ea(k.ear) } } : p);
  }),
};
