import { describe, expect, it } from 'vitest';
import { moleculeById, type Molecule } from '../data/molecules';
import { octetCounts, OCTET_MOLECULES, valenceTotal } from './octet';

const mol = (id: string): Molecule => {
  const m = moleculeById(id);
  if (!m) throw new Error(id);
  return m;
};
const byEl = (id: string, el: string) => octetCounts(mol(id)).find((c) => c.el === el);
const exceptions = (id: string) =>
  octetCounts(mol(id))
    .filter((c) => c.verdict !== 'ok')
    .map((c) => `${c.el}:${c.verdict}:${String(c.total)}`);

describe('octet rule (Bài 10): electrons around each atom from the structure data', () => {
  it('every listed species exists and its electron bookkeeping adds up', () => {
    for (const id of OCTET_MOLECULES) {
      const m = mol(id);
      const counts = octetCounts(m);
      const bonded = m.bonds.reduce((s, b) => s + b.order, 0);
      // Lone/unpaired electrons + 2 per shared pair = all valence electrons of the species.
      const nonbonding = counts.reduce((s, c) => s + c.nonbonding, 0);
      expect(nonbonding + 2 * bonded, id).toBe(valenceTotal(counts));
    }
  });

  it('textbook examples satisfy the octet (duet for H): Cl₂, H₂O, CO₂, N₂, NH₄⁺', () => {
    for (const id of ['cl2', 'h2o', 'co2', 'n2', 'nh3', 'ch4', 'c2h4', 'hcn', 'nh4', 'oh']) {
      expect(exceptions(id), id).toEqual([]);
    }
    expect(byEl('h2o', 'O')).toMatchObject({ valence: 6, shared: 4, lonePairs: 2, total: 8 });
    expect(byEl('h2o', 'H')).toMatchObject({ total: 2, target: 2, verdict: 'ok' });
    expect(byEl('n2', 'N')).toMatchObject({ bondOrder: 3, lonePairs: 1, total: 8 });
    // NH₄⁺: N⁺ shares 4 pairs, no lone pair; the ion has 8 valence electrons.
    expect(byEl('nh4', 'N')).toMatchObject({ charge: 1, nonbonding: 0, total: 8 });
    expect(valenceTotal(octetCounts(mol('nh4')))).toBe(8);
    expect(valenceTotal(octetCounts(mol('oh')))).toBe(8);
  });

  it('the exceptions are found by the count, not listed by hand', () => {
    expect(exceptions('becl2')).toEqual(['Be:deficient:4']);
    expect(exceptions('bf3')).toEqual(['B:deficient:6']);
    expect(exceptions('pcl5')).toEqual(['P:expanded:10']);
    expect(exceptions('sf6')).toEqual(['S:expanded:12']);
    expect(exceptions('no')).toEqual(['N:odd:7']);
    expect(byEl('no', 'N')).toMatchObject({ lonePairs: 1, unpaired: 1 });
    const flagged = OCTET_MOLECULES.filter((id) => exceptions(id).length > 0);
    expect(flagged).toEqual(['becl2', 'bf3', 'no', 'pcl5', 'sf6']);
  });
});
