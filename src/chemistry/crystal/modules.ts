import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L } from '../common';
import { selectCrystal, useCrystalStore } from './store';
import { CrystalPanel, CrystalStage } from './views';

export const crystalStructure: ModuleView = {
  title: L('Tinh thể kim loại và NaCl', 'Metal crystals and NaCl'),
  Stage: CrystalStage,
  Panel: CrystalPanel,
  state: bindStore(useCrystalStore, ['id'], (p) => {
    selectCrystal(p.id);
  }),
};
