import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setFourier, useFourierStore } from './store';
import { FourierBottom, FourierPanel, FourierStage } from './views';

/** A physics lesson drawn by its own view (it has no time evolution to step, only a sum to build). */
export const fourierSeries: ModuleView = {
  title: TITLE,
  Stage: FourierStage,
  Panel: FourierPanel,
  Bottom: FourierBottom,
  bottomTitle: L('Các hoạ âm', 'Harmonics'),
  state: bindStore(useFourierStore, ['wave', 'N', 'f1', 'showHarmonics'], setFourier),
};
