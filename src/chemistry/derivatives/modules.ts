import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { CA_TITLE, HAP_TITLE } from './card';
import { setCa, setHap, useCaStore, useHapStore } from './store';
import { CaBottom, CaPanel, CaStage, HapBottom, HapPanel, HapStage } from './views';

/** HH11 Chương 5, Bài 19–21: halogen derivatives, alcohols, phenol. */
export const halideAlcoholPhenol: ModuleView = {
  title: HAP_TITLE,
  Stage: HapStage,
  Panel: HapPanel,
  Bottom: HapBottom,
  bottomTitle: L('Bảng và phản ứng trong SGK', 'Tables and reactions in the textbook'),
  state: bindStore(useHapStore, ['tab', 'elimination'], setHap),
};

/** HH11 Chương 6, Bài 23–24: carbonyl compounds, carboxylic acids. */
export const carbonylAcid: ModuleView = {
  title: CA_TITLE,
  Stage: CaStage,
  Panel: CaPanel,
  Bottom: CaBottom,
  bottomTitle: L('Bảng và phản ứng trong SGK', 'Tables and reactions in the textbook'),
  state: bindStore(useCaStore, ['tab', 'series', 'acid', 'C'], setCa),
};
