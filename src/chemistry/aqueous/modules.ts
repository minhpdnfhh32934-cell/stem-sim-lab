import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { TITLE } from './card';
import { setAqueous, useAqueousStore } from './store';
import { AqueousBottom, AqueousPanel, AqueousStage } from './views';

/** HH11 Bài 2: pH, Kw and indicators; the titration has its own lesson (acidBaseTitration). */
export const aqueousEquilibrium: ModuleView = {
  title: TITLE,
  Stage: AqueousStage,
  Panel: AqueousPanel,
  Bottom: AqueousBottom,
  bottomTitle: L('Chất chỉ thị và khoảng pH', 'Indicators and pH ranges'),
  state: bindStore(useAqueousStore, ['given', 'pH', 'solute', 'c'], setAqueous),
};
