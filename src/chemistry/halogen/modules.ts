import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { HalogenBottom, HalogenPanel, HalogenStage } from './HalogenViews';
import {
  HydrogenHalideBottom,
  HydrogenHalidePanel,
  HydrogenHalideStage,
} from './HydrogenHalideViews';
import { selectHalogen, selectHalogenProperty, useHalogenStore } from './store';

/** HH10 Bài 21 "Nhóm halogen". */
export const halogens: ModuleView = {
  title: L('Nhóm halogen', 'The halogens'),
  Stage: HalogenStage,
  Panel: HalogenPanel,
  Bottom: HalogenBottom,
  bottomTitle: L('Xu hướng từ F đến I', 'Trend from F to I'),
  state: bindStore(useHalogenStore, ['z', 'property'], (p) => {
    selectHalogen(p.z);
    selectHalogenProperty(p.property);
  }),
};

/** HH10 Bài 22 "Hydrogen halide · Muối halide". */
export const hydrogenHalides: ModuleView = {
  title: L('Hydrogen halide · Muối halide', 'Hydrogen halides · Halide salts'),
  Stage: HydrogenHalideStage,
  Panel: HydrogenHalidePanel,
  Bottom: HydrogenHalideBottom,
  bottomTitle: L('Hydrogen halide (SGK Bảng 22.1, 22.2)', 'Hydrogen halides (SGK Bảng 22.1, 22.2)'),
  state: bindStore(useHalogenStore, ['z'], (p) => {
    selectHalogen(p.z);
  }),
};
