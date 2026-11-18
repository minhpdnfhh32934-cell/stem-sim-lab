import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { ElementDetails } from './ElementDetails';
import { PeriodicModuleStage } from './PeriodicModuleStage';
import { usePeriodicStore } from './store';
import { TrendBottom } from './TrendBottom';

const view: ModuleView = {
  title: L('Bảng tuần hoàn', 'Periodic table'),
  Stage: PeriodicModuleStage,
  Panel: ElementDetails,
  Bottom: TrendBottom,
  bottomTitle: L('Xu hướng tuần hoàn', 'Periodic trend'),
  state: bindStore(usePeriodicStore, ['selected', 'colorBy']),
};
export default view;
