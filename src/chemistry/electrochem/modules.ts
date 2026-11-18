import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { EC_TITLE, L, METAL_TITLE } from './card';
import { setMetal, useMetalStore } from './metalStore';
import { MetalPanel, MetalStage } from './metalViews';
import { setElectrochem, useElectrochemStore } from './store';
import { ElectrochemBottom, ElectrochemPanel, ElectrochemStage } from './views';

/** HH12 Bài 15: Bảng 15.1, the α rule, the Galvanic cell. */
export const electrodePotential: ModuleView = {
  title: EC_TITLE,
  Stage: ElectrochemStage,
  Panel: ElectrochemPanel,
  Bottom: ElectrochemBottom,
  bottomTitle: L('Bảng 15.1 của SGK', 'The textbook’s Table 15.1'),
  state: bindStore(useElectrochemStore, ['tab', 'a', 'b', 'x', 'y'], setElectrochem),
};

/** HH12 Bài 19: physical properties, and metals with water, dilute acids and salt solutions. */
export const metalProperties: ModuleView = {
  title: METAL_TITLE,
  Stage: MetalStage,
  Panel: MetalPanel,
  Bottom: ElectrochemBottom,
  bottomTitle: L('Bảng 15.1 của SGK', 'The textbook’s Table 15.1'),
  state: bindStore(useMetalStore, ['tab', 'metal', 'reagent', 'salt'], setMetal),
};
