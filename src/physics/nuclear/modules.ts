import { bindStore } from '@/modules/binding';
import type { ModuleView } from '@/modules/types';
import { L as LD, TITLE as DECAY_TITLE } from './decay/card';
import { setDecay, useDecayStore } from './decay/store';
import { DecayBottom, DecayPanel, DecayStage } from './decay/views';
import { L, TITLE } from './nucleus/card';
import { setNucleus, useNucleusStore } from './nucleus/store';
import { NucleusBottom, NucleusPanel, NucleusStage } from './nucleus/views';

/** VL12 Bài 21–22: the nucleus, nuclear reactions, mass defect and binding energy. */
export const nucleus: ModuleView = {
  title: TITLE,
  Stage: NucleusStage,
  Panel: NucleusPanel,
  Bottom: NucleusBottom,
  bottomTitle: L('Bảng 21.1 của SGK', 'The textbook’s Table 21.1'),
  state: bindStore(useNucleusStore, ['tab', 'symbol', 'reaction', 'massOf', 'fuelKg'], setNucleus),
};

/** VL12 Bài 23: the decay law, activity, randomness and radiation safety. */
export const radioactivity: ModuleView = {
  title: DECAY_TITLE,
  Stage: DecayStage,
  Panel: DecayPanel,
  Bottom: DecayBottom,
  bottomTitle: LD('Bảng 23.2 của SGK', 'The textbook’s Table 23.2'),
  state: bindStore(
    useDecayStore,
    ['tab', 'source', 'T', 'unit', 't', 'N0', 'leftPct', 'after', 'seed', 'dose1', 'd1', 'd2'],
    setDecay,
  ),
};
