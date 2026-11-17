/**
 * The SH12 KNTT lessons of #255 round 5 that have a module of their own (the descriptive ones are
 * guided lessons). Kept out of `modules.ts` so opening one does not load the other biology lessons.
 */
import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { ChromosomePanel, ChromosomeStage } from './chromosome/ChromosomeViews';
import { restoreChromosome, useChromosome } from './chromosome/store';
import { PYRAMID_TITLE, TOLERANCE_TITLE } from './ecology12/card';
import {
  PyramidPanel,
  PyramidStage,
  TolerancePanel,
  ToleranceStage,
} from './ecology12/Ecology12Views';
import { restorePyramid, restoreTolerance, usePyramid, useTolerance } from './ecology12/store';
import { EVOLUTION_TITLE } from './evolution/card';
import { EvolutionPanel, EvolutionStage } from './evolution/EvolutionViews';
import { restoreEvolution, useEvolution } from './evolution/store';
import { CHROMOSOME_TITLE, LINKAGE_TITLE, SEXLINKED_TITLE } from './heredityCards';
import { LinkagePanel, LinkageStage } from './linkage/LinkageViews';
import { restoreLinkage, useLinkage } from './linkage/store';
import { OPERON_TITLE } from './operon/card';
import { OperonPanel, OperonStage } from './operon/OperonViews';
import { restoreOperon, useOperon } from './operon/store';
import { SexLinkedPanel, SexLinkedStage } from './sexlinked/SexLinkedViews';
import { restoreSexLinked, useSexLinked } from './sexlinked/store';

/** Bài 3: the lac operon, switched by lactose, a damaged lacI or a damaged operator. */
export const lacOperon: ModuleView = {
  title: OPERON_TITLE,
  Stage: OperonStage,
  Panel: OperonPanel,
  state: bindStore(useOperon, ['lactose', 'lacI', 'operator'], restoreOperon),
};

/** Bài 10: XX – XY, Morgan's X-linked eye colour, forward and reciprocal crosses. */
export const sexLinkage: ModuleView = {
  title: SEXLINKED_TITLE,
  Stage: SexLinkedStage,
  Panel: SexLinkedPanel,
  state: bindStore(useSexLinked, ['mother', 'father'], restoreSexLinked),
};

/** Bài 11: complete linkage, crossing over, recombination frequency from cells or counts. */
export const geneLinkage: ModuleView = {
  title: LINKAGE_TITLE,
  Stage: LinkageStage,
  Panel: LinkagePanel,
  state: bindStore(useLinkage, ['tab', 'parent', 'cells', 'counts'], restoreLinkage),
};

/** Bài 12: structural and numerical chromosome mutations, Down syndrome by the mother's age. */
export const chromosomeMutation: ModuleView = {
  title: CHROMOSOME_TITLE,
  Stage: ChromosomeStage,
  Panel: ChromosomePanel,
  state: bindStore(
    useChromosome,
    ['tab', 'structure', 'twoN', 'numberType', 'aTwoN', 'bTwoN'],
    restoreChromosome,
  ),
};

/** Bài 19 and 22: cytochrome C (Bảng 19.1) and the geological timescale (Bảng 22.1). */
export const evolutionEvidence: ModuleView = {
  title: EVOLUTION_TITLE,
  Stage: EvolutionStage,
  Panel: EvolutionPanel,
  state: bindStore(useEvolution, ['tab', 'period'], restoreEvolution),
};

/** Bài 23: the law of tolerance with the book's temperature example. */
export const ecologicalFactors: ModuleView = {
  title: TOLERANCE_TITLE,
  Stage: ToleranceStage,
  Panel: TolerancePanel,
  state: bindStore(useTolerance, ['t'], restoreTolerance),
};

/** Bài 29: the ecological pyramids of Hình 29.6 and the efficiency between levels. */
export const ecosystemEnergy: ModuleView = {
  title: PYRAMID_TITLE,
  Stage: PyramidStage,
  Panel: PyramidPanel,
  state: bindStore(usePyramid, ['pyramid'], restorePyramid),
};
