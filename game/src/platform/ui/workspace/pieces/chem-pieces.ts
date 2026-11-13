import type { PieceViewFactory } from '../types';
import { APPARATUS } from './chem-apparatus';
import { ELEMENTS } from './chem-elements';
import { INSTRUMENTS } from './chem-instruments';
import { VESSELS } from './chem-vessel';
import './chem.css';

/**
 * The Chemistry piece views by `kind`: the vessel shapes (conical-flask, beaker, volumetric-flask,
 * boiling-tube, evaporating-dish, cuvette, and `vessel` for a beaker), burette, pipette, reagent
 * rack, wash bottle, filter funnel, hot plate, balance, pH meter, colorimeter, timer, stopwatch,
 * thermometer, water bath, spotting tile, retort stand and the contextual periodic table.
 *
 * The host reads `pieces` from every module in `pieces/` (`registry.ts`), so nothing else needs
 * registering; to register by hand: `Object.assign(WORKSPACE_PIECES, CHEM_PIECES)`.
 */
export const CHEM_PIECES: Readonly<Record<string, PieceViewFactory>> = {
  ...VESSELS,
  ...APPARATUS,
  ...INSTRUMENTS,
  ...ELEMENTS,
};

export const pieces = CHEM_PIECES;
