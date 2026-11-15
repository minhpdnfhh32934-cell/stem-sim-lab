import { describe, expect, it } from 'vitest';
import { elementBySymbol } from '../data/elements';
import { IONS } from '../data/ions';
import { moleculeById, type Molecule } from '../data/molecules';
import { COVALENT_MOLECULES, covalentBonds, sigmaPiTotals } from './covalent';
import { OCTET_MOLECULES } from './octet';

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

  it('every Pauling value the four lessons use is the one of SGK Bảng 6.2 (tr. 37)', () => {
    // SGK Hóa học 10 KNTT, Bài 6, Bảng 6.2 (read on the NXBGD reader, 16/11/2026).
    const BOOK: Record<string, number> = {
      ...{ H: 2.2, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98 },
      ...{ Na: 0.93, Mg: 1.31, Al: 1.61, P: 2.19, S: 2.58, Cl: 3.16 },
      ...{ K: 0.82, Ca: 1.0, Se: 2.55, Br: 2.96, Rb: 0.82, Sr: 0.95, I: 2.66, Cs: 0.79, Ba: 0.89 },
    };
    const used = new Set([
      ...[...OCTET_MOLECULES, ...COVALENT_MOLECULES].flatMap((id) =>
        mol(id).atoms.map((a) => a.el),
      ),
      ...IONS.map((i) => i.element),
    ]);
    for (const el of used) {
      expect(BOOK[el], `${el} is in Bảng 6.2`).toBeDefined();
      expect(elementBySymbol(el)?.en_pauling, el).toBe(BOOK[el]);
    }
  });
});
