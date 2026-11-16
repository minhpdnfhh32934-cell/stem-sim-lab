import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { TITLE } from './card';
import { setNs, useNsStore } from './store';
import { NsBottom, NsPanel, NsStage } from './views';

/** HH11 Bài 4–8: the oxidation-number axes of N and S, the lessons' substances and reactions. */
export const nitrogenSulfur: ModuleView = {
  title: TITLE,
  Stage: NsStage,
  Panel: NsPanel,
  Bottom: NsBottom,
  bottomTitle: L('Phản ứng trong SGK', 'Reactions in the textbook'),
  state: bindStore(useNsStore, ['element', 'selected', 'extraN', 'extraS'], setNs),
};
