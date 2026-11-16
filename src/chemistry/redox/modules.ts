import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { RedoxBottom, RedoxPanel, RedoxStage } from './RedoxViews';
import { selectRedoxReaction, useRedoxStore } from './store';

/** HH10 Bài 15 "Phản ứng oxi hóa – khử". */
export const redox: ModuleView = {
  title: L('Phản ứng oxi hóa – khử', 'Redox reactions'),
  Stage: RedoxStage,
  Panel: RedoxPanel,
  Bottom: RedoxBottom,
  bottomTitle: L('Số oxi hóa của từng chất', 'Oxidation numbers of each species'),
  state: bindStore(useRedoxStore, ['id', 'equation'], (p) => {
    if (typeof p.equation === 'string') useRedoxStore.setState({ equation: p.equation });
    selectRedoxReaction(p.id);
  }),
};
