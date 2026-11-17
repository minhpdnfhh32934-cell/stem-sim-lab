import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L, REACTIONS_TITLE, STRUCTURE_TITLE } from './card';
import { setComplex, setComplexReaction, useComplexReactionStore, useComplexStore } from './store';
import {
  ColourBottom,
  ReactionsPanel,
  ReactionsStage,
  StructurePanel,
  StructureStage,
} from './views';

/** HH12 Bài 28: central atom, ligands, charge, geometry (3D where the book states it). */
export const complexStructure: ModuleView = {
  title: STRUCTURE_TITLE,
  Stage: StructureStage,
  Panel: StructurePanel,
  Bottom: ColourBottom,
  bottomTitle: L('Màu sắc của phức chất', 'Colours of complexes'),
  state: bindStore(useComplexStore, ['id', 'labels'], setComplex),
};

/** HH12 Bài 29: signs of complex formation, ligand substitution, uses. */
export const complexReactions: ModuleView = {
  title: REACTIONS_TITLE,
  Stage: ReactionsStage,
  Panel: ReactionsPanel,
  Bottom: ColourBottom,
  bottomTitle: L('Màu sắc của phức chất', 'Colours of complexes'),
  state: bindStore(useComplexReactionStore, ['tab', 'substitution'], setComplexReaction),
};
