import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { EnthalpyBottom, EnthalpyPanel, EnthalpyStage } from './EnthalpyViews';
import { selectEnthalpyReaction, useEnthalpyStore } from './store';

/** HH10 Bài 17 "Biến thiên enthalpy trong các phản ứng hóa học". */
export const reactionEnthalpy: ModuleView = {
  title: L('Biến thiên enthalpy của phản ứng', 'Enthalpy change of a reaction'),
  Stage: EnthalpyStage,
  Panel: EnthalpyPanel,
  Bottom: EnthalpyBottom,
  bottomTitle: L('Nhiệt tạo thành chuẩn của các chất', 'Standard enthalpies of formation'),
  state: bindStore(useEnthalpyStore, ['id'], (p) => {
    selectEnthalpyReaction(p.id);
  }),
};
