import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setEster, useEsterStore } from './store';
import { EsterBottom, EsterPanel, EsterStage } from './views';

/** HH12 Bài 1 (and the saponification of Bài 2): ester names and isomers, reactions, fats. */
export const esterLipid: ModuleView = {
  title: TITLE,
  Stage: EsterStage,
  Panel: EsterPanel,
  Bottom: EsterBottom,
  bottomTitle: L('Nhiệt độ sôi theo SGK', 'Boiling points from the textbook'),
  state: bindStore(
    useEsterStore,
    ['tab', 'acyl', 'alkyl', 'n', 'acidG', 'alcoholG', 'esterG', 'fa1', 'fa2', 'fa3', 'fatG'],
    setEster,
  ),
};
