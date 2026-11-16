import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { TITLE } from './card';
import { setHc, useHcStore } from './store';
import { HcBottom, HcPanel, HcStage } from './views';

/** HH11 Bài 15–17: alkanes, alkenes, alkynes and arenes. */
export const hydrocarbons: ModuleView = {
  title: TITLE,
  Stage: HcStage,
  Panel: HcPanel,
  Bottom: HcBottom,
  bottomTitle: L('Bảng và phản ứng trong SGK', 'Tables and reactions in the textbook'),
  state: bindStore(useHcStore, ['cls', 'n'], setHc),
};
