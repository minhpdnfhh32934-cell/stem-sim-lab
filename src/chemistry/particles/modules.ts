import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { EquilibriumBottom, EquilibriumPanel, EquilibriumStage } from './EquilibriumViews';
import { GasBottom } from './GasBottom';
import { GasPanel } from './GasPanel';
import { CollisionStage, MaxwellStage } from './views';

export const maxwellBoltzmann: ModuleView = {
  title: L('Phân bố Maxwell–Boltzmann', 'Maxwell–Boltzmann distribution'),
  Stage: MaxwellStage,
  Panel: GasPanel,
  Bottom: GasBottom,
  bottomTitle: L('Phân bố tốc độ', 'Speed distribution'),
};
export const collisionTheory: ModuleView = {
  title: L('Thuyết va chạm', 'Collision theory'),
  Stage: CollisionStage,
  Panel: GasPanel,
  Bottom: GasBottom,
  bottomTitle: L('Số hạt theo thời gian', 'Particles over time'),
};
export const chemicalEquilibrium: ModuleView = {
  title: L('Cân bằng hóa học', 'Chemical equilibrium'),
  Stage: EquilibriumStage,
  Panel: EquilibriumPanel,
  Bottom: EquilibriumBottom,
  bottomTitle: L('Nồng độ theo thời gian', 'Concentrations over time'),
};
