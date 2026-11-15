import { describe, expect, it } from 'vitest';
import { moleculeById, type Molecule } from '../data/molecules';
import { COVALENT_MOLECULES, covalentBonds, sigmaPiTotals } from './covalent';

const mol = (id: string): Molecule => {
  const m = moleculeById(id);
  if (!m) throw new Error(id);
  return m;
};
const totals = (id: string) => sigmaPiTotals(covalentBonds(mol(id)));

describe('covalent bond (Bài 12): σ/π counts and bond type from Δχ', () => {
  it('σ and π from the bond orders of the structure data', () => {
    expect(totals('h2')).toEqual({ sigma: 1, pi: 0 });
    expect(totals('o2')).toEqual({ sigma: 1, pi: 1 });
    expect(totals('n2')).toEqual({ sigma: 1, pi: 2 });
    expect(totals('co2')).toEqual({ sigma: 2, pi: 2 });
    // SGK Bài 12 question 4: C₂H₄ has 5 σ and 1 π.
    expect(totals('c2h4')).toEqual({ sigma: 5, pi: 1 });
    expect(totals('c2h2')).toEqual({ sigma: 3, pi: 2 });
    expect(totals('hcn')).toEqual({ sigma: 2, pi: 2 });
    expect(totals('ch3cooh')).toEqual({ sigma: 7, pi: 1 });
    for (const id of COVALENT_MOLECULES) {
      for (const r of covalentBonds(mol(id))) expect(r.sigma + r.pi, id).toBe(r.order);
    }
  });

  it('bond types of the SGK examples (Bảng 12.1 thresholds)', () => {
    const only = (id: string) => [...new Set(covalentBonds(mol(id)).map((r) => r.type))];
    expect(only('h2')).toEqual(['nonpolar']);
    expect(only('cl2')).toEqual(['nonpolar']);
    expect(covalentBonds(mol('hcl'))[0]).toMatchObject({ deltaEn: 0.96, type: 'polar' });
    expect(covalentBonds(mol('co2'))[0]).toMatchObject({ deltaEn: 0.89, type: 'polar' });
    // C–H: 2,55 − 2,20 = 0,35, non-polar by the table.
    expect(only('ch4')).toEqual(['nonpolar']);
  });

  it('HF is flagged: the table says "ion" (Δχ = 1,78), the book lists it as an exception', () => {
    expect(covalentBonds(mol('hf'))[0]).toMatchObject({
      deltaEn: 1.78,
      type: 'ionic',
      thresholdException: true,
    });
    const flagged = COVALENT_MOLECULES.filter((id) =>
      covalentBonds(mol(id)).some((r) => r.thresholdException),
    );
    expect(flagged).toEqual(['hf']);
  });
});
