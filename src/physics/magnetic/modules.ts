import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setMagnetic, useMagneticStore } from './store';
import { MagneticBottom, MagneticPanel, MagneticStage } from './views';

/** VL12 Bài 15: the force on a current-carrying wire, F = BIL sinα, and measuring B. */
export const magneticForce: ModuleView = {
  title: TITLE,
  Stage: MagneticStage,
  Panel: MagneticPanel,
  Bottom: MagneticBottom,
  bottomTitle: L('Bảng 15.1 của SGK', 'The textbook’s Table 15.1'),
  state: bindStore(useMagneticStore, ['tab', 'B', 'I', 'L', 'alpha', 'reversed'], setMagnetic),
};
