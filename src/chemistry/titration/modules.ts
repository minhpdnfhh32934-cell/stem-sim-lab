import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { setTitration, useTitrationStore } from './store';
import { TitrationBottom, TitrationPanel, TitrationStage } from './TitrationViews';

export const acidBaseTitration: ModuleView = {
  title: L('Chuẩn độ acid – base', 'Acid–base titration'),
  Stage: TitrationStage,
  Panel: TitrationPanel,
  Bottom: TitrationBottom,
  bottomTitle: L('Đường cong chuẩn độ', 'Titration curve'),
  // Restored files go through the same validation as the controls.
  state: bindStore(useTitrationStore, ['ca', 'va', 'cb', 'vb', 'indicator'], setTitration),
};
