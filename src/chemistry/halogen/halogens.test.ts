import { describe, expect, it } from 'vitest';
import {
  bondEnthalpyFromFormation,
  evToKjPerMol,
  HALOGEN_ROWS,
  silverHalideReaction,
} from './halogens';

const col = <K extends keyof (typeof HALOGEN_ROWS)[number]>(k: K) => HALOGEN_ROWS.map((r) => r[k]);
const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > (xs[i - 1] ?? -Infinity));
const decreasing = (xs: number[]) => increasing([...xs].reverse());

describe('halogens F → I, the book’s values (HH10 Bài 21–22)', () => {
  it('rows F, Cl, Br, I with the book’s tables', () => {
    expect(col('symbol')).toEqual(['F', 'Cl', 'Br', 'I']);
    expect(col('radius_pm')).toEqual([72, 100, 114, 133]);
    expect(col('en_pauling')).toEqual([3.98, 3.16, 2.96, 2.66]);
    expect(col('melting_c')).toEqual([-219.6, -101.0, -7.3, 113.6]);
    expect(col('boiling_c')).toEqual([-188.1, -34.1, 59.2, 185.5]);
    expect(col('state')).toEqual(['gas', 'gas', 'liquid', 'solid']);
  });

  it('the trends the book describes', () => {
    expect(increasing(col('radius_pm'))).toBe(true);
    expect(decreasing(col('en_pauling'))).toBe(true);
    expect(increasing(col('melting_c'))).toBe(true);
    expect(increasing(col('boiling_c'))).toBe(true);
    const ie = col('ie_kj_mol').map((x) => x ?? NaN);
    expect(decreasing(ie)).toBe(true);
    const bonds = HALOGEN_ROWS.map((r) => r.hx.bond_energy_kj_mol);
    expect(bonds).toEqual([569, 432, 366, 299]);
    expect(decreasing(bonds)).toBe(true);
  });

  it('I₁ in kJ/mol from the NIST eV value (CODATA e·N_A)', () => {
    // 1 eV per particle = 96,485 kJ/mol.
    expect(evToKjPerMol(1)).toBeCloseTo(96.485, 3);
    const cl = HALOGEN_ROWS.find((r) => r.symbol === 'Cl');
    expect(cl?.ie_kj_mol).toBeCloseTo(12.9676 * 96.4853, 1);
    // The other sources, for the comparison column: Cordero covalent radius and CRC points.
    expect(cl?.other).toEqual({ radius_pm: 102, melting_c: -101.5, boiling_c: -34.04 });
  });

  it('Hess cross-check of the book’s bond energies stays within 2 kJ/mol', () => {
    const hess = HALOGEN_ROWS.map((r) => bondEnthalpyFromFormation(r.symbol));
    // CODATA: 217,998 + 121,301 − (−92,31) = 431,609 kJ/mol for H–Cl.
    expect(hess[1]).toBeCloseTo(431.609, 6);
    HALOGEN_ROWS.forEach((r, i) => {
      expect(Math.abs((hess[i] ?? 0) - r.hx.bond_energy_kj_mol), r.symbol).toBeLessThan(2);
    });
  });

  it('only the library’s AgCl test exists; the other halides are not in the library', () => {
    expect(silverHalideReaction('Cl')?.id).toBe('agcl');
    for (const x of ['F', 'Br', 'I']) expect(silverHalideReaction(x), x).toBeUndefined();
  });
});
