import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { PeriodTrendBottom, PeriodTrendPanel, PeriodTrendStage } from './PeriodTrendViews';
import { selectPeriod3Element, usePeriodTrendStore } from './store';

/** HH10 Bài 7 "Xu hướng biến đổi thành phần và một số tính chất của hợp chất trong một chu kì". */
export const periodTrends: ModuleView = {
  title: L('Oxide và hydroxide trong chu kì 3', 'Oxides and hydroxides across period 3'),
  Stage: PeriodTrendStage,
  Panel: PeriodTrendPanel,
  Bottom: PeriodTrendBottom,
  bottomTitle: L('Tính acid – base (SGK Bảng 7.2)', 'Acid–base character (SGK Bảng 7.2)'),
  state: bindStore(usePeriodTrendStore, ['z'], (p) => {
    selectPeriod3Element(p.z);
  }),
};
