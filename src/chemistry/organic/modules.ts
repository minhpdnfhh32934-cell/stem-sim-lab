import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { TITLE } from './card';
import { setOrganic, useOrganicStore } from './store';
import { OrganicBottom, OrganicPanel, OrganicStage } from './views';

/** HH11 Bài 10, 12, 13: functional groups and IR, molecular formula, isomers. */
export const organicBasics: ModuleView = {
  title: TITLE,
  Stage: OrganicStage,
  Panel: OrganicPanel,
  Bottom: OrganicBottom,
  bottomTitle: L('Bảng trong SGK', 'Tables in the textbook'),
  state: bindStore(useOrganicStore, ['tab', 'group', 'C', 'H', 'O', 'M', 'isomerSet'], setOrganic),
};
