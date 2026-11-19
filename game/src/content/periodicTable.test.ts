import { describe, expect, it } from 'vitest';
import elements from './elements.json';
import raw from './periodic-table.json';
import { parsePeriodicTable } from './periodicTable';

const table = parsePeriodicTable(raw);

describe('the hub’s periodic table (periodic-table.json)', () => {
  it('has the chemistry lens’s 118 elements, symbols and weights (elements.json)', () => {
    for (const e of elements.elements) {
      const shown = table.elements[e.z - 1];
      expect(shown?.symbol).toBe(e.symbol);
      const weight = (e as { weight?: number }).weight;
      if (weight !== undefined) {
        expect([e.symbol, Number(shown?.weight)]).toEqual([e.symbol, weight]);
      }
    }
  });

  it('a weight from CIAAW, or the mass number of an isotope for an element without one', () => {
    const none = table.elements.filter((e) => e.weight === null).map((e) => e.symbol);
    // CIAAW gives none for technetium, promethium and polonium onwards but thorium, protactinium
    // and uranium.
    expect(none.slice(0, 3)).toEqual(['Tc', 'Pm', 'Po']);
    expect(none).not.toContain('Th');
    expect(none).not.toContain('U');
    expect(none).toHaveLength(34);
    expect(table.elements[0]?.weight).toBe('1.0080'); // printed as CIAAW prints it
  });

  it('sorts the elements as a periodic table does (a sample of each kind)', () => {
    const of = (symbol: string) => table.elements.find((e) => e.symbol === symbol)?.category;
    expect(['Li', 'Na', 'K', 'Cs'].map(of)).toEqual(Array(4).fill('alkali-metal'));
    expect(['He', 'Ne', 'Ar', 'Xe', 'Rn'].map(of)).toEqual(Array(5).fill('noble-gas'));
    expect(['F', 'Cl', 'Br', 'I'].map(of)).toEqual(Array(4).fill('halogen'));
    expect(['La', 'Lu'].map(of)).toEqual(['lanthanide', 'lanthanide']);
    expect(['Ac', 'Lr'].map(of)).toEqual(['actinide', 'actinide']);
    expect(of('Fe')).toBe('transition-metal');
    // IUPAC's names (Phú, 2026-11-14: as the 2018 textbooks), not the American spellings.
    expect(table.elements[12]?.name).toBe('Aluminium');
    expect(table.elements[54]?.name).toBe('Caesium');
  });
});
