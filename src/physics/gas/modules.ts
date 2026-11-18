import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setGas, useGasStore } from './store';
import { GasBottom, GasPanel, GasStage } from './views';

/** VL12 Bài 9–12: Boyle, Charles, the equation of state and the kinetic model of a gas. */
export const idealGas: ModuleView = {
  title: TITLE,
  Stage: GasStage,
  Panel: GasPanel,
  Bottom: GasBottom,
  bottomTitle: L('Các trạng thái và bảng số liệu của SGK', 'The states and the textbook’s tables'),
  state: bindStore(
    useGasStore,
    [
      'tab',
      'process',
      'unknown',
      'p1',
      'V1',
      't1',
      'p2',
      'V2',
      't2',
      'offset',
      'dataSet',
      'gasId',
      'T',
      'p',
    ],
    setGas,
  ),
};
