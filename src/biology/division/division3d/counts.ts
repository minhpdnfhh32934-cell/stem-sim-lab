/**
 * Counts shown by a 3D division stage, read from the bookkeeping model (`countsOf`), never typed
 * in. The only choice made here is how many of the model's cells one DRAWN cell holds:
 *  - 1: the model's cells as they are (interphase … anaphase, and cytokinesis: per daughter cell);
 *  - 2: the telophase convention of the 3D views — the model lists telophase as its future
 *    daughter cells, while the 3D picture shows them still in one cell with two nuclei (one
 *    set each) until cytokinesis. Consecutive model cells are paired: [0, 1] → cell 0, [2, 3] →
 *    cell 1 (meiosis II telophase: two cells with two nuclei each).
 */
import { countsOf, type StageState } from '../division';
import type { Counts3D } from './types';

export function countsFromModel(
  s: StageState,
  merge: 1 | 2,
  nuclei: { from: number; to: number },
): Counts3D {
  if (merge === 2) {
    // One drawn cell holding two of the model's sets (all drawn cells of a stage are alike).
    const sets = s.cells.slice(0, 2).map((cell) => countsOf({ stage: s.stage, cells: [cell] }));
    const sum = (k: 'chromosomes' | 'chromatids' | 'centromeres' | 'dnaMolecules') =>
      sets.reduce((a, c) => a + c[k], 0);
    return {
      cells: Math.max(1, Math.ceil(s.cells.length / 2)),
      nuclei,
      chromosomes: sum('chromosomes'),
      state: sets.some((c) => c.state === 'double') ? 'double' : 'single',
      chromatids: sum('chromatids'),
      centromeres: sum('centromeres'),
      dnaMolecules: sum('dnaMolecules'),
      perNucleus: sets[0]?.chromosomes ?? 0,
    };
  }
  const c = countsOf(s);
  return {
    cells: c.cells,
    nuclei,
    chromosomes: c.chromosomes,
    state: c.state,
    chromatids: c.chromatids,
    centromeres: c.centromeres,
    dnaMolecules: c.dnaMolecules,
  };
}
