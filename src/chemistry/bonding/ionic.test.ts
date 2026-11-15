import { describe, expect, it } from 'vitest';
import { configString, elementBySymbol } from '../data/elements';
import { IONS, IONS_SECOND_SOURCE, IONS_SOURCE } from '../data/ions';
import { valenceElectrons } from '../data/molecules';
import {
  ANIONS,
  CATIONS,
  ionConfiguration,
  ionicCompound,
  ionLabel,
  nobleGasReached,
} from './ionic';

const el = (s: string) => {
  const e = elementBySymbol(s);
  if (!e) throw new Error(s);
  return e;
};

describe('ionic bond (Bài 11): ion table, configurations and charge balance', () => {
  it('the ion table keeps groups 1, 2, 13 and 15–17, metals positive, non-metals negative', () => {
    expect(CATIONS.length + ANIONS.length).toBe(IONS.length);
    for (const i of IONS) {
      const e = el(i.element);
      expect([1, 2, 13, 15, 16, 17], i.element).toContain(e.group);
      if (e.group === 1 || e.group === 2 || e.group === 13) expect(i.charge).toBe(e.group % 10);
      else expect(i.charge).toBe((e.group ?? 0) - 18);
      expect(['metalloid'], i.element).not.toContain(e.category);
    }
    expect(IONS.map((i) => i.element)).not.toContain('As');
    expect(IONS.map((i) => i.element)).not.toContain('Fr');
  });

  it('the textbook first (Bài 11): the ions it prints, the rest by its rule (OpenStax list)', () => {
    const book = IONS.filter((i) => i.source === 'sgk');
    expect(book.map((i) => i.element).sort()).toEqual(
      ['Al', 'Be', 'Br', 'Ca', 'Cl', 'F', 'K', 'Li', 'Mg', 'Na', 'O', 'S'].sort(),
    );
    for (const i of book) expect(i.book, i.element).toMatch(/^Bài 11 tr. 5[12]/);
    expect(IONS.find((i) => i.element === 'Al')?.book).toBe('Bài 11 tr. 51: Al → Al³⁺ + 3e');
    expect(
      IONS.filter((i) => i.source === 'openstax')
        .map((i) => i.element)
        .sort(),
    ).toEqual(['Ba', 'Cs', 'I', 'N', 'P', 'Rb', 'Se', 'Sr'].sort());
    // The book's rule (Bài 11 tr. 51, Bảng 10.1): a metal of group nA gives n electrons, a
    // non-metal of group nA takes 8 − n. Every ion of the table follows it.
    for (const i of IONS) {
      const v = valenceElectrons(i.element) ?? NaN;
      expect(i.charge, i.element).toBe(v <= 3 ? v : v - 8);
    }
    expect(IONS_SOURCE.citation).toContain('Bài 11 tr. 51');
    expect(IONS_SECOND_SOURCE.citation).toContain('OpenStax');
  });

  it('configurations before and after, as SGK writes them for Na⁺ and Cl⁻', () => {
    expect(configString(ionConfiguration(el('Na'), 1))).toBe('1s² 2s² 2p⁶');
    expect(configString(ionConfiguration(el('Cl'), -1))).toBe('1s² 2s² 2p⁶ 3s² 3p⁶');
    expect(configString(ionConfiguration(el('Al'), 3))).toBe('1s² 2s² 2p⁶');
    expect(nobleGasReached(el('Na'), 1)?.symbol).toBe('Ne');
    expect(nobleGasReached(el('Cl'), -1)?.symbol).toBe('Ar');
    // The atom's own configuration is not changed by the ion computation.
    expect(configString(el('Na').configuration)).toBe('1s² 2s² 2p⁶ 3s¹');
  });

  it('every ion of the table reaches the configuration of a noble gas (from the data table)', () => {
    for (const i of IONS) {
      const gas = nobleGasReached(el(i.element), i.charge);
      expect(gas?.group, `${i.element} ${String(i.charge)}`).toBe(18);
    }
  });

  it('formula from charge balance: x·a = y·b = lcm(a, b)', () => {
    const f = (m: string, x: string) => ionicCompound(m, x).formula;
    expect(f('Na', 'Cl')).toBe('NaCl');
    expect(f('Ca', 'Cl')).toBe('CaCl₂');
    expect(f('Mg', 'O')).toBe('MgO');
    expect(f('Al', 'O')).toBe('Al₂O₃');
    expect(f('Mg', 'N')).toBe('Mg₃N₂');
    expect(f('Li', 'O')).toBe('Li₂O');
    const alo = ionicCompound('Al', 'O');
    expect(alo).toMatchObject({ cations: 2, anions: 3, electrons: 6 });
    for (const c of CATIONS)
      for (const a of ANIONS) {
        const k = ionicCompound(c.element, a.element);
        expect(k.cations * k.cationCharge + k.anions * k.anionCharge).toBe(0);
      }
  });

  it('Δχ with the SGK thresholds: NaCl ionic (2,23), AlI₃ leans covalent', () => {
    expect(ionicCompound('Na', 'Cl')).toMatchObject({ deltaEn: 2.23, bondType: 'ionic' });
    expect(ionicCompound('Al', 'I').bondType).toBe('polar');
  });

  it('ion labels', () => {
    expect(ionLabel('Al', 3)).toBe('Al³⁺');
    expect(ionLabel('Cl', -1)).toBe('Cl⁻');
    expect(ionLabel('O', -2)).toBe('O²⁻');
  });
});
