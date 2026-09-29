import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { EquilibriumBottom, EquilibriumPanel, EquilibriumStage } from './EquilibriumViews';
import { resetEq, useEqStore } from './eqStore';
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
    resetEq(p);
  }),
};
