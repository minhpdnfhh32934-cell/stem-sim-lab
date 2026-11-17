import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, TITLE } from './card';
import { setInduction, useInductionStore } from './store';
import { InductionBottom, InductionPanel, InductionStage } from './views';

/** VL12 Bài 16–17: magnetic flux, Faraday's and Lenz's laws, the AC generator. */
export const induction: ModuleView = {
  title: TITLE,
  Stage: InductionStage,
  Panel: InductionPanel,
  Bottom: InductionBottom,
  bottomTitle: L('Từ thông và suất điện động trong một chu kì', 'Flux and e.m.f. over one period'),
  state: bindStore(
    useInductionStore,
    [
      'tab',
      'B1',
      'B2',
      'alpha1',
      'alpha2',
      'S',
      'N',
      'dt',
      'gN',
      'gB',
      'gS',
      'f',
      'alpha0',
      't',
      'threePhase',
    ],
    setInduction,
  ),
};
