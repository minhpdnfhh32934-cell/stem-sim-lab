import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setEm, useEmStore } from './store';
import { EmBottom, EmPanel, EmStage } from './views';

/** VL11 Bài 11: an EM wave and the spectrum; no time evolution to step, only λ ↔ f to read. */
export const emWave: ModuleView = {
  title: TITLE,
  Stage: EmStage,
  Panel: EmPanel,
  Bottom: EmBottom,
  bottomTitle: L('Thang sóng điện từ (Bảng 11.1)', 'The electromagnetic spectrum (Table 11.1)'),
  state: bindStore(useEmStore, ['lambda', 'given', 'lUnit', 'fUnit'], setEm),
};
