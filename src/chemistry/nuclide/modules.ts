import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { CompositionBottom, CompositionPanel, CompositionStage } from './CompositionViews';
import { IsotopeBottom, IsotopePanel, IsotopeStage } from './IsotopeViews';
import {
  selectIsotopeElement,
  setComposition,
  useCompositionStore,
  useIsotopeStore,
} from './store';

/** HH10 Bài 1 "Thành phần của nguyên tử". */
export const atomComposition: ModuleView = {
  title: L('Thành phần của nguyên tử', 'Composition of the atom'),
  Stage: CompositionStage,
  Panel: CompositionPanel,
  Bottom: CompositionBottom,
  bottomTitle: L('Khối lượng các hạt', 'Particle masses'),
  state: bindStore(useCompositionStore, ['z', 'n', 'electrons'], setComposition),
};

/** HH10 Bài 2 "Nguyên tố hóa học": isotopes and the average atomic mass. */
export const isotopes: ModuleView = {
  title: L('Nguyên tố hóa học và đồng vị', 'Chemical elements and isotopes'),
  Stage: IsotopeStage,
  Panel: IsotopePanel,
  Bottom: IsotopeBottom,
  bottomTitle: L('Các đồng vị tự nhiên', 'Natural isotopes'),
  state: bindStore(useIsotopeStore, ['z', 'average'], (p) => {
    selectIsotopeElement(p.z ?? useIsotopeStore.getState().z);
    if (typeof p.average === 'number' && Number.isFinite(p.average)) {
      useIsotopeStore.setState({ average: p.average });
    }
  }),
};
