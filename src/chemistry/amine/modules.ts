import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { AminoAcidBottom, AminoAcidPanel, AminoAcidStage } from './aminoAcidViews';
import { AA_TITLE, AMINE_TITLE, L } from './card';
import { setAmine, setAminoAcid, useAmineStore, useAminoAcidStore } from './store';
import { AmineBottom, AminePanel, AmineStage } from './views';

/** HH12 Bài 8: amine names and isomers, Bảng 8.1, reactions. */
export const amine: ModuleView = {
  title: AMINE_TITLE,
  Stage: AmineStage,
  Panel: AminePanel,
  Bottom: AmineBottom,
  bottomTitle: L('Bảng 8.1 của SGK', 'The textbook’s Table 8.1'),
  state: bindStore(useAmineStore, ['tab', 'n', 'pick'], setAmine),
};

/** HH12 Bài 9: amino acids, glycine in an electric field, peptides. */
export const aminoAcidPeptide: ModuleView = {
  title: AA_TITLE,
  Stage: AminoAcidStage,
  Panel: AminoAcidPanel,
  Bottom: AminoAcidBottom,
  bottomTitle: L('Bảng 9.1 của SGK', 'The textbook’s Table 9.1'),
  state: bindStore(useAminoAcidStore, ['tab', 'aa', 'pH', 'sequence'], setAminoAcid),
};
