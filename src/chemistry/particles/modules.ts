import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { EquilibriumBottom, EquilibriumPanel, EquilibriumStage } from './EquilibriumViews';
import { EA_MAX_KJ, K_MAX, resetEq, useEqStore } from './eqStore';
import type { Kinetics } from './equilibrium';
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
    // A hand-edited file (null or partial objects) is merged onto the current values field by
    // field, inside the panel's ranges (the energy diagram needs Eₐ ≥ 0).
    const cur = useEqStore.getState().kinetics;
    const k: Partial<Record<keyof Kinetics, unknown>> = p.kinetics ?? {};
    const num = (v: unknown, keep: number, lo: number, hi: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : keep;
    const kinetics: Kinetics = {
      kf0: num(k.kf0, cur.kf0, 0, K_MAX),
      kr0: num(k.kr0, cur.kr0, 1e-6, K_MAX),
      eaf: num(k.eaf, cur.eaf, 0, EA_MAX_KJ * 1000),
      ear: num(k.ear, cur.ear, 0, EA_MAX_KJ * 1000),
      T0: cur.T0,
    };
    const { initial, ...rest } = p;
    resetEq({ ...rest, kinetics, ...(initial ? { initial } : {}) });
  }),
};
