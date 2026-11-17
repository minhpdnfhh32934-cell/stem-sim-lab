import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { IA_TITLE, IIA_TITLE, TM_TITLE } from './card';
import { IaBottom, IaPanel, IaStage, IiaBottom, IiaPanel, IiaStage } from './sblockViews';
import { setIa, setIia, setTm, useIaStore, useIiaStore, useTmStore } from './store';
import { L } from './text';
import { TmBottom, TmPanel, TmStage } from './transitionViews';

/** HH12 Bài 24: group IA, Bảng 24.1–24.3. */
export const groupIA: ModuleView = {
  title: IA_TITLE,
  Stage: IaStage,
  Panel: IaPanel,
  Bottom: IaBottom,
  bottomTitle: L('Bảng 24.1–24.3 của SGK', 'The textbook’s Tables 24.1–24.3'),
  state: bindStore(useIaStore, ['prop'], setIa),
};

/** HH12 Bài 25: group IIA, trends, solubility (Bảng 25.4), thermal stability. */
export const groupIIA: ModuleView = {
  title: IIA_TITLE,
  Stage: IiaStage,
  Panel: IiaPanel,
  Bottom: IiaBottom,
  bottomTitle: L('Bảng 25.1–25.3 của SGK', 'The textbook’s Tables 25.1–25.3'),
  state: bindStore(useIiaStore, ['tab', 'prop', 'metal', 'anion', 'salt'], setIia),
};

/** HH12 Bài 27: first-row transition metals, ions, the FeSO₄ titration. */
export const transitionMetals: ModuleView = {
  title: TM_TITLE,
  Stage: TmStage,
  Panel: TmPanel,
  Bottom: TmBottom,
  bottomTitle: L('Bảng 27.1, 27.2 của SGK', 'The textbook’s Tables 27.1, 27.2'),
  state: bindStore(useTmStore, ['tab', 'prop', 'metal', 'charge', 'v'], setTm),
};
