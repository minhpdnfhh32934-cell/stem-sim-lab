/**
 * The SH10 KNTT lessons of #255 round 1g, each a ModuleView: Bài 4 (cellElements), Bài 5
 * (biomolecules), Bài 21 (microbeGrowth), Bài 24 (virusStructure). Kept out of `modules.ts` so
 * opening one of them does not load the other biology lessons.
 */
import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { BiomoleculePanel, BiomoleculeStage } from './biomolecules/BiomoleculeViews';
import { restoreBiomolecules, useBiomolecules } from './biomolecules/store';
import { L } from './common';
import { ElementsPanel, ElementsStage } from './elements/ElementsViews';
import { restoreElements, useElements } from './elements/store';
import { GrowthPanel, GrowthStage } from './microbes/GrowthViews';
import { restoreGrowth, useGrowth } from './microbes/store';
import { VirusBottom, VirusPanel, VirusStage } from './virus/VirusViews';
import { restoreVirus, useVirus } from './virus/store';

// Files and history entries are untrusted: each restore* drops values the controls cannot show.
export const cellElements: ModuleView = {
  title: L('Các nguyên tố hóa học và nước', 'Chemical elements and water'),
  Stage: ElementsStage,
  Panel: ElementsPanel,
  state: bindStore(useElements, ['view', 'mass', 'dT'], restoreElements),
};
export const biomolecules: ModuleView = {
  title: L('Các phân tử sinh học', 'Biological molecules'),
  Stage: BiomoleculeStage,
  Panel: BiomoleculePanel,
  state: bindStore(useBiomolecules, ['group', 'molecule'], restoreBiomolecules),
};
export const microbeGrowth: ModuleView = {
  title: L('Sinh trưởng của quần thể vi khuẩn', 'Growth of a bacterial population'),
  Stage: GrowthStage,
  Panel: GrowthPanel,
  state: bindStore(useGrowth, ['view', 'n0', 'g', 't', 'scale', 'phase'], restoreGrowth),
};
export const virusStructure: ModuleView = {
  title: L('Khái quát về virus', 'Viruses: an overview'),
  Stage: VirusStage,
  Panel: VirusPanel,
  Bottom: VirusBottom,
  bottomTitle: L('Năm giai đoạn nhân lên', 'Five stages of multiplication'),
  state: bindStore(useVirus, ['enveloped', 'stage'], restoreVirus),
};
