import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setThermal, useThermalStore } from './store';
import { ThermalBottom, ThermalPanel, ThermalStage } from './views';

/** VL12 Bài 2–6: internal energy and the first law, temperature scales, specific and latent heats. */
export const heatAndPhase: ModuleView = {
  title: TITLE,
  Stage: ThermalStage,
  Panel: ThermalPanel,
  Bottom: ThermalBottom,
  bottomTitle: L('Các giai đoạn và bảng số liệu của SGK', 'The stages and the textbook’s tables'),
  state: bindStore(
    useThermalStore,
    ['tab', 'preset', 'm', 't0', 'P', 'eff', 'target', 't1', 'tau', 'value', 'unit', 'A', 'Q'],
    setThermal,
  ),
};
